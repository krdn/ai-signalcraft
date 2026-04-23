// YouTube 통합 수집기 — 영상 검색 + 댓글 + 자막을 하나의 collect()에서 처리
import { getYoutubeClient, YoutubeApiKeyMissingError } from '../utils/youtube-client';
import { getInnertubeClient } from '../utils/youtube-innertube';
import { QuotaTracker } from '../utils/youtube-quota';
import { fetchTranscript } from '../utils/youtube-transcript';
import { splitIntoDaysKst, KST_OFFSET_MS } from '../utils/community-parser';
import type { Collector, CollectionOptions, CollectionStats } from './base';
import type { YoutubeVideo } from './youtube-videos';
import type { YoutubeComment } from './youtube-comments';

// 기본값
const DEFAULT_MAX_ITEMS = 50;
const DEFAULT_MAX_COMMENTS = 100;
const SEARCH_PAGE_SIZE = 50;
const COMMENTS_PAGE_SIZE = 100;
// 쿼터 임계값 — search 1회(100유닛) 미만이면 fallback 전환
const QUOTA_FALLBACK_THRESHOLD = 150;

/**
 * YoutubeCollector — 통합 수집기
 *
 * 하나의 collect()에서 영상 검색 → 댓글 수집 → 자막 수집을 일체형으로 처리.
 * Data API v3를 주력으로 사용하되, 쿼터 소진 시 youtubei.js InnerTube로 자동 전환.
 */
export class YoutubeCollector implements Collector<YoutubeVideo> {
  readonly source = 'youtube';
  private quota = new QuotaTracker();
  private stats: CollectionStats | null = null;
  private fallbackActive = false;
  private collectionStartDate: string | null = null;

  async *collect(options: CollectionOptions): AsyncGenerator<YoutubeVideo[], void, unknown> {
    this.quota.reset();
    this.fallbackActive = false;
    this.collectionStartDate = options.startDate;
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const maxComments = options.maxComments ?? DEFAULT_MAX_COMMENTS;
    const commentOrder = options.commentOrder ?? 'relevance';
    const collectTranscript = options.collectTranscript !== false;
    const days = splitIntoDaysKst(options.startDate, options.endDate);
    const perDayLimit = options.maxItemsPerDay ?? Math.max(1, Math.floor(maxItems / days.length));
    const skipUrlSet = new Set(options.reusePlan?.skipUrls ?? []);
    // 댓글 재수집 대상 URL + since 맵
    const refetchSpecs = options.reusePlan?.refetchCommentsFor ?? [];
    const refetchUrlToSince = new Map<string, string | null>(
      refetchSpecs.map((s) => [s.url, s.lastCommentsFetchedAt]),
    );
    const refetchSet = new Set(refetchSpecs.map((s) => s.url));
    const perDayCount: Record<string, number> = {};
    let totalCollected = 0;
    let endReason: CollectionStats['endReason'] = 'completed';
    let lastPage = 0;
    let perDayCapSkip = 0;
    let outOfRange = 0;

    // 댓글 재수집 대상이 있으면 먼저 처리 (since 기반 증분)
    if (refetchSet.size > 0) {
      yield* this.refetchCommentsOnly(
        [...refetchSet],
        maxComments,
        commentOrder,
        refetchUrlToSince,
      );
    }

    for (const day of days) {
      const dayKey = toKstDayKey(day);
      perDayCount[dayKey] = 0;
      let collectedThisDay = 0;
      let pageToken: string | undefined;
      let page = 0;

      while (collectedThisDay < perDayLimit) {
        if (totalCollected >= maxItems) {
          endReason = 'maxItemsReached';
          break;
        }
        page++;
        lastPage = Math.max(lastPage, page);

        let videos: YoutubeVideo[];
        let nextToken: string | undefined;

        try {
          const result = await this.searchVideos(
            options.keyword,
            day,
            pageToken,
            Math.min(perDayLimit - collectedThisDay, SEARCH_PAGE_SIZE),
          );
          videos = result.videos;
          nextToken = result.nextPageToken;
        } catch (err) {
          // 구성 오류(API 키 미설정)는 quota 소진과 구분해 failed로 전파.
          if (err instanceof YoutubeApiKeyMissingError) throw err;
          endReason = 'quotaExhausted';
          break;
        }

        if (videos.length === 0) {
          if (!nextToken) break;
          pageToken = nextToken;
          continue;
        }

        // skipUrls 필터
        const filtered = videos.filter((v) => !skipUrlSet.has(v.url));
        // KST 일자 일치 검사
        const expectedKstDay = Math.floor((day.getTime() + KST_OFFSET_MS) / 86400000);
        const sameDay = filtered.filter((v) => {
          if (!v.publishedAt) return true;
          const k = Math.floor((v.publishedAt.getTime() + KST_OFFSET_MS) / 86400000);
          if (k !== expectedKstDay) {
            outOfRange++;
            return false;
          }
          return true;
        });

        // perDayLimit cap
        const room = perDayLimit - collectedThisDay;
        const accepted = sameDay.slice(0, room);
        if (sameDay.length > room) perDayCapSkip += sameDay.length - room;

        // 댓글 + 자막 수집
        for (const video of accepted) {
          if (video.commentCount > 0) {
            video.comments = await this.collectComments(video.sourceId, maxComments, commentOrder);
          }
          if (collectTranscript) {
            const transcript = await fetchTranscript(video.sourceId);
            if (transcript) {
              video.transcript = transcript.text;
              video.transcriptLang = transcript.lang;
            }
          }
        }

        collectedThisDay += accepted.length;
        totalCollected += accepted.length;
        perDayCount[dayKey] = collectedThisDay;
        if (accepted.length > 0) yield accepted;

        pageToken = nextToken;
        if (!pageToken) break;
      }

      if (endReason !== 'completed') break;
    }

    this.stats = {
      endReason,
      lastPage,
      perDayCount,
      perDayCapSkip: perDayCapSkip || undefined,
      outOfRange: outOfRange || undefined,
      quotaUsed: this.quota.getUsed(),
      quotaRemaining: this.quota.getRemaining(),
      usedFallback: this.fallbackActive || undefined,
    };
  }

  getLastRunStats(): CollectionStats | null {
    return this.stats;
  }

  // ─── 영상 검색 ───

  private async searchVideos(
    keyword: string,
    day: Date,
    pageToken: string | undefined,
    maxResults: number,
  ): Promise<{ videos: YoutubeVideo[]; nextPageToken?: string }> {
    if (this.shouldUseFallback()) {
      return this.searchViaInnertube(keyword);
    }
    return this.searchViaApi(keyword, day, pageToken, maxResults);
  }

  private async searchViaApi(
    keyword: string,
    day: Date,
    pageToken: string | undefined,
    maxResults: number,
  ): Promise<{ videos: YoutubeVideo[]; nextPageToken?: string }> {
    const youtube = getYoutubeClient();

    const publishedAfter = day.toISOString();
    const publishedBefore = new Date(day.getTime() + 86400000 - 1).toISOString();

    const searchRes = await youtube.search.list({
      part: ['id'],
      q: keyword,
      type: ['video'],
      publishedAfter,
      publishedBefore,
      maxResults,
      order: 'date',
      regionCode: 'KR',
      relevanceLanguage: 'ko',
      pageToken,
    });
    this.quota.track('search.list');

    const ids = (searchRes.data.items ?? [])
      .map((i) => i.id?.videoId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      return { videos: [], nextPageToken: searchRes.data.nextPageToken ?? undefined };
    }

    const detailRes = await youtube.videos.list({ part: ['snippet', 'statistics'], id: ids });
    this.quota.track('videos.list');

    const videos: YoutubeVideo[] = (detailRes.data.items ?? []).map((item) => ({
      sourceId: item.id ?? '',
      url: `https://www.youtube.com/watch?v=${item.id}`,
      title: item.snippet?.title ?? '',
      description: item.snippet?.description ?? null,
      channelId: item.snippet?.channelId ?? '',
      channelTitle: item.snippet?.channelTitle ?? '',
      viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
      likeCount: parseInt(item.statistics?.likeCount ?? '0', 10),
      commentCount: parseInt(item.statistics?.commentCount ?? '0', 10),
      publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
      rawData: item as unknown as Record<string, unknown>,
      comments: [],
      transcript: null,
      transcriptLang: null,
    }));

    return { videos, nextPageToken: searchRes.data.nextPageToken ?? undefined };
  }

  private async searchViaInnertube(
    keyword: string,
  ): Promise<{ videos: YoutubeVideo[]; nextPageToken?: string }> {
    this.fallbackActive = true;
    const innertube = await getInnertubeClient();
    const results = await innertube.search(keyword, {
      type: 'video',
      upload_date: this.computeUploadDate(),
    });

    const videos: YoutubeVideo[] = ((results as any).videos ?? (results as any).results ?? []).map(
      (v: any) => ({
        sourceId: v.id ?? '',
        url: `https://www.youtube.com/watch?v=${v.id}`,
        title: v.title?.text ?? v.title ?? '',
        description: v.description?.text ?? v.description ?? null,
        channelId: v.author?.id ?? '',
        channelTitle: v.author?.name ?? '',
        viewCount: parseInt(
          String(v.view_count?.text ?? v.view_count ?? '0').replace(/[^0-9]/g, '') || '0',
          10,
        ),
        likeCount: 0,
        commentCount: 0,
        publishedAt: this.parseInnertubeDate(v.published?.text ?? v.published ?? ''),
        rawData: { innertube: true },
        comments: [],
        transcript: null,
        transcriptLang: null,
      }),
    );

    return { videos };
  }

  // ─── 댓글 수집 ───

  private async collectComments(
    videoId: string,
    max: number,
    order: 'relevance' | 'time',
    sinceIso?: string | null,
  ): Promise<YoutubeComment[]> {
    if (this.shouldUseFallback()) {
      // Innertube 경로는 since 미지원 (fallback 용도)
      return this.collectCommentsViaInnertube(videoId, max);
    }
    // since 지정 시 order='time' 강제 (최신순 필수)
    const effectiveOrder: 'relevance' | 'time' = sinceIso ? 'time' : order;
    return this.collectCommentsViaApi(videoId, max, effectiveOrder, sinceIso ?? null);
  }

  private async collectCommentsViaApi(
    videoId: string,
    max: number,
    order: 'relevance' | 'time',
    sinceIso: string | null = null,
  ): Promise<YoutubeComment[]> {
    const youtube = getYoutubeClient();
    const comments: YoutubeComment[] = [];
    const sinceMs = sinceIso ? new Date(sinceIso).getTime() : null;
    let pageToken: string | undefined;
    let stopDueToSince = false;

    while (comments.length < max) {
      try {
        const res = await youtube.commentThreads.list({
          part: ['snippet', 'replies'],
          videoId,
          maxResults: Math.min(max - comments.length, COMMENTS_PAGE_SIZE),
          order,
          pageToken,
        });
        this.quota.track('commentThreads.list');

        const items = res.data.items;
        if (!items || items.length === 0) break;

        for (const thread of items) {
          const top = thread.snippet?.topLevelComment;
          if (top?.snippet) {
            // since cutoff: 최신순 정렬이므로 첫 오래된 것 발견 시 즉시 종료
            const publishedAtIso = top.snippet.publishedAt;
            if (sinceMs !== null && publishedAtIso) {
              const ts = new Date(publishedAtIso).getTime();
              if (ts <= sinceMs) {
                stopDueToSince = true;
                break;
              }
            }
            comments.push(this.mapApiComment(top, null, videoId));
          }
          // 대댓글: API가 최대 5개만 반환 → totalReplyCount > 5이면 추가 호출
          const totalReplies = thread.snippet?.totalReplyCount ?? 0;
          if (thread.replies?.comments) {
            for (const reply of thread.replies.comments) {
              if (reply.snippet) comments.push(this.mapApiComment(reply, top?.id ?? null, videoId));
            }
          }
          if (totalReplies > 5 && top?.id) {
            const extra = await this.fetchAllReplies(top.id, videoId);
            // 중복 제거: replies에 이미 포함된 ID 제외
            const existIds = new Set(comments.map((c) => c.sourceId));
            for (const r of extra) {
              if (!existIds.has(r.sourceId)) comments.push(r);
            }
          }
        }

        if (stopDueToSince) break;

        pageToken = res.data.nextPageToken ?? undefined;
        if (!pageToken) break;
      } catch (err: unknown) {
        const error = err as { code?: number };
        if (error.code === 403) break; // 댓글 비활성화 또는 쿼터 소진
        throw err;
      }
    }

    return comments.slice(0, max);
  }

  /** comments.list로 대댓글 전량 수집 */
  private async fetchAllReplies(parentId: string, videoId: string): Promise<YoutubeComment[]> {
    const youtube = getYoutubeClient();
    const replies: YoutubeComment[] = [];
    let pageToken: string | undefined;

    while (true) {
      try {
        const res = await youtube.comments.list({
          part: ['snippet'],
          parentId,
          maxResults: COMMENTS_PAGE_SIZE,
          pageToken,
        });
        this.quota.track('comments.list');

        const items = res.data.items;
        if (!items || items.length === 0) break;
        for (const item of items) {
          if (item.snippet) replies.push(this.mapApiComment(item, parentId, videoId));
        }
        pageToken = res.data.nextPageToken ?? undefined;
        if (!pageToken) break;
      } catch (err: unknown) {
        const error = err as { code?: number };
        if (error.code === 403) break;
        throw err;
      }
    }

    return replies;
  }

  private async collectCommentsViaInnertube(
    videoId: string,
    max: number,
  ): Promise<YoutubeComment[]> {
    const innertube = await getInnertubeClient();
    const comments: YoutubeComment[] = [];

    try {
      let thread = await innertube.getComments(videoId);
      while (comments.length < max) {
        const contents = (thread as any).contents ?? [];
        if (contents.length === 0) break;
        for (const c of contents) {
          if (comments.length >= max) break;
          comments.push({
            sourceId: c.comment_id ?? '',
            parentId: null,
            videoSourceId: videoId,
            content: c.content?.text ?? c.content ?? '',
            author: c.author?.name ?? '',
            likeCount: parseInt(
              String(c.vote_count?.text ?? c.vote_count ?? '0').replace(/[^0-9]/g, '') || '0',
              10,
            ),
            publishedAt: this.parseInnertubeDate(c.published?.text ?? ''),
            rawData: { innertube: true },
          });
        }
        if (!(thread as any).has_continuation) break;
        thread = await (thread as any).getContinuation();
      }
    } catch {
      // InnerTube 댓글 수집 실패 — 빈 결과 반환
    }

    return comments;
  }

  // ─── 댓글 재수집 ───

  async *refetchCommentsOnly(
    urls: string[],
    max: number,
    order: 'relevance' | 'time',
    urlToSince?: Map<string, string | null>,
  ): AsyncGenerator<YoutubeVideo[], void, unknown> {
    for (const url of urls) {
      const videoId = extractVideoId(url);
      if (!videoId) continue;
      // since 지정 시 collectComments는 order=time 강제 + publishedAt 컷오프
      const since = urlToSince?.get(url) ?? undefined;
      const comments = await this.collectComments(videoId, max, order, since ?? undefined);
      yield [
        {
          sourceId: videoId,
          url,
          title: '',
          description: null,
          channelId: '',
          channelTitle: '',
          viewCount: 0,
          likeCount: 0,
          commentCount: comments.length,
          publishedAt: null,
          rawData: { refetchCommentsOnly: true },
          comments,
          transcript: null,
          transcriptLang: null,
        },
      ];
    }
  }

  // ─── 헬퍼 ───

  private mapApiComment(item: any, parentId: string | null, videoId: string): YoutubeComment {
    const s = item.snippet ?? {};
    return {
      sourceId: item.id ?? '',
      parentId,
      videoSourceId: videoId,
      content: s.textDisplay ?? '',
      author: s.authorDisplayName ?? '',
      likeCount: s.likeCount ?? 0,
      publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
      rawData: item as unknown as Record<string, unknown>,
    };
  }

  /** collectionStartDate 기준으로 InnerTube upload_date 필터 값 계산 */
  private computeUploadDate(): 'today' | 'week' | 'month' | 'year' {
    if (!this.collectionStartDate) return 'week';
    const diffMs = Date.now() - new Date(this.collectionStartDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 'today';
    if (diffDays <= 7) return 'week';
    if (diffDays <= 30) return 'month';
    return 'year';
  }

  private shouldUseFallback(): boolean {
    if (this.fallbackActive) return true;
    if (this.quota.isExhausted(QUOTA_FALLBACK_THRESHOLD)) {
      this.fallbackActive = true;
      return true;
    }
    return false;
  }

  /** InnerTube 상대시간 텍스트("3일 전", "2 hours ago") → Date */
  parseInnertubeDate(text: string): Date | null {
    if (!text) return null;
    const now = new Date();

    // 한국어: "N시간 전", "N분 전", "N일 전" 등
    const koMatch = text.match(/(\d+)\s*(초|분|시간|일|주|개월|년)\s*전/);
    if (koMatch) {
      const n = parseInt(koMatch[1], 10);
      const u = koMatch[2];
      if (u === '초') now.setSeconds(now.getSeconds() - n);
      else if (u === '분') now.setMinutes(now.getMinutes() - n);
      else if (u === '시간') now.setHours(now.getHours() - n);
      else if (u === '일') now.setDate(now.getDate() - n);
      else if (u === '주') now.setDate(now.getDate() - n * 7);
      else if (u === '개월') now.setMonth(now.getMonth() - n);
      else if (u === '년') now.setFullYear(now.getFullYear() - n);
      return now;
    }

    // 영어: "N seconds/minutes/hours/days/weeks/months/years ago"
    const enMatch = text.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
    if (enMatch) {
      const n = parseInt(enMatch[1], 10);
      const u = enMatch[2].toLowerCase();
      if (u === 'second') now.setSeconds(now.getSeconds() - n);
      else if (u === 'minute') now.setMinutes(now.getMinutes() - n);
      else if (u === 'hour') now.setHours(now.getHours() - n);
      else if (u === 'day') now.setDate(now.getDate() - n);
      else if (u === 'week') now.setDate(now.getDate() - n * 7);
      else if (u === 'month') now.setMonth(now.getMonth() - n);
      else if (u === 'year') now.setFullYear(now.getFullYear() - n);
      return now;
    }

    return null;
  }
}

// ─── 모듈 레벨 유틸 ───

/** YouTube URL에서 videoId 추출 */
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

/** KST 일자 키 생성 (yyyy-mm-dd) */
function toKstDayKey(day: Date): string {
  const kst = new Date(day.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
