// YouTube 영상 메타데이터 수집기 (YouTube Data API v3)
import { getYoutubeClient } from '../utils/youtube-client';
import { splitIntoDaysKst } from '../utils/community-parser';
import type { Collector, CollectionOptions } from './base';
import type { YoutubeComment } from './youtube-comments';

/** 수집된 YouTube 영상 메타데이터 */
export interface YoutubeVideo {
  sourceId: string; // videoId
  url: string; // https://www.youtube.com/watch?v={videoId}
  title: string;
  description: string | null;
  channelId: string;
  channelTitle: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  rawData: Record<string, unknown>;
  comments: YoutubeComment[];
  transcript: string | null;
  transcriptLang: string | null;
}

// 기본 최대 수집 건수
const DEFAULT_MAX_ITEMS = 50;
// search.list 한 페이지 최대 결과 수
const SEARCH_PAGE_SIZE = 50;

/**
 * YoutubeVideosCollector
 *
 * YouTube Data API v3의 search.list + videos.list를 조합하여
 * 키워드 기반 영상 메타데이터를 수집한다.
 *
 * 쿼터 효율:
 * - search.list: 100유닛/요청 (videoId 목록 획득)
 * - videos.list: 1유닛/요청 (최대 50개 영상 상세 정보)
 * - 50건 수집 시 총 101유닛 소모
 */
export class YoutubeVideosCollector implements Collector<YoutubeVideo> {
  readonly source = 'youtube-videos';

  /**
   * 키워드 기반 YouTube 영상 메타데이터 수집.
   * 일자별로 publishedAfter/publishedBefore를 잘라 검색해 일자별 cap을 보장.
   *
   * ⚠️ 한도 초과 금지: 각 일자에서 perDayLimit을 절대 넘기지 않는다.
   * ⚠️ 부족분 보충 금지: 한 일자가 모자라도 다른 일자에서 채우지 않는다.
   *
   * perDayLimit 우선순위:
   *   1) options.maxItemsPerDay (flows.ts가 perDay 모드일 때 사용자 원본 한도를 명시 전달)
   *   2) 미지정 시 maxItems / dayCount의 floor — total 모드 등 일자 분배가 없는 경우.
   */
  async *collect(options: CollectionOptions): AsyncGenerator<YoutubeVideo[], void, unknown> {
    const youtube = getYoutubeClient();
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const days = splitIntoDaysKst(options.startDate, options.endDate);
    const perDayLimit = options.maxItemsPerDay ?? Math.max(1, Math.floor(maxItems / days.length));
    const skipUrlSet = new Set(options.reusePlan?.skipUrls ?? []);
    const globalSeenIds = new Set<string>();
    let skippedByReuse = 0;

    for (const day of days) {
      // 일자별 검색 윈도우: KST 자정~익일 자정 (UTC ISO로 변환해 API에 전달)
      // day는 이미 KST 자정 시각 → +24h가 익일 KST 자정
      const publishedAfter = day.toISOString();
      const publishedBefore = new Date(day.getTime() + 86400000 - 1).toISOString();

      let collectedThisDay = 0;
      let nextPageToken: string | undefined;

      while (collectedThisDay < perDayLimit) {
        const remaining = perDayLimit - collectedThisDay;
        const pageSize = Math.min(remaining, SEARCH_PAGE_SIZE);

        const searchResponse = await youtube.search.list({
          part: ['id'],
          q: options.keyword,
          type: ['video'],
          publishedAfter,
          publishedBefore,
          maxResults: pageSize,
          order: 'date',
          regionCode: 'KR',
          relevanceLanguage: 'ko',
          pageToken: nextPageToken,
        });

        const searchItems = searchResponse.data.items;
        if (!searchItems || searchItems.length === 0) break;

        const videoIds = searchItems
          .map((item) => item.id?.videoId)
          .filter((id): id is string => Boolean(id))
          .filter((id) => !globalSeenIds.has(id));
        videoIds.forEach((id) => globalSeenIds.add(id));

        if (videoIds.length === 0) {
          nextPageToken = searchResponse.data.nextPageToken ?? undefined;
          if (!nextPageToken) break;
          continue;
        }

        const videosResponse = await youtube.videos.list({
          part: ['snippet', 'statistics'],
          id: videoIds,
        });

        const videoItems = videosResponse.data.items;
        if (!videoItems || videoItems.length === 0) {
          nextPageToken = searchResponse.data.nextPageToken ?? undefined;
          if (!nextPageToken) break;
          continue;
        }

        const videos: YoutubeVideo[] = videoItems.map((item) => ({
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

        const filteredVideos = videos.filter((v) => {
          if (skipUrlSet.has(v.url)) {
            skippedByReuse++;
            return false;
          }
          return true;
        });

        // ⚠️ 일자별 cap 강제: publishedAfter/Before로 일자 윈도우를 좁혔지만
        // YouTube가 경계 시각(KST 자정) 양쪽 글을 함께 반환할 수 있으므로 KST 일자 일치 검사.
        const KST_OFFSET = 9 * 60 * 60 * 1000;
        const expectedKstDay = Math.floor((day.getTime() + KST_OFFSET) / 86400000);
        const sameDay = filteredVideos.filter((v) => {
          if (!v.publishedAt) return true;
          const k = Math.floor((v.publishedAt.getTime() + KST_OFFSET) / 86400000);
          return k === expectedKstDay;
        });

        // perDayLimit을 절대 넘지 않도록 잘라내기
        const room = perDayLimit - collectedThisDay;
        const accepted = sameDay.slice(0, room);
        collectedThisDay += accepted.length;
        if (accepted.length > 0) yield accepted;

        nextPageToken = searchResponse.data.nextPageToken ?? undefined;
        if (!nextPageToken) break;
      }
    }

    if (skippedByReuse > 0) {
      console.info(`youtube-videos TTL 재사용으로 ${skippedByReuse}건 메타데이터 수집 스킵`);
    }
  }
}
