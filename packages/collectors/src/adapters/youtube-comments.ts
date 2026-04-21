// YouTube 댓글 수집기 (YouTube Data API v3 commentThreads)
import { getYoutubeClient } from '../utils/youtube-client';
import type { Collector, CollectionOptions } from './base';

/** 수집된 YouTube 댓글 */
export interface YoutubeComment {
  sourceId: string; // 댓글 ID
  parentId: string | null; // 대댓글인 경우 부모 ID
  videoSourceId: string; // 소속 영상 videoId
  content: string;
  author: string;
  likeCount: number;
  publishedAt: Date | null;
  rawData: Record<string, unknown>;
}

// 기본 최대 댓글 수집 건수
const DEFAULT_MAX_COMMENTS = 500;
// commentThreads.list 한 페이지 최대 결과 수
const COMMENTS_PAGE_SIZE = 100;

/**
 * YoutubeCommentsCollector
 *
 * YouTube Data API v3의 commentThreads.list를 사용하여
 * 영상별 댓글을 수집한다.
 *
 * 사용 방식:
 * - options.keyword에 videoId를 전달하여 특정 영상의 댓글을 수집
 * - 쿼터 비용: 1유닛/요청 (매우 효율적)
 * - 500개 댓글 = 5회 요청 = 5유닛
 *
 * 댓글 비활성화 영상 처리:
 * - 403 에러 발생 시 해당 영상 건너뛰고 빈 결과 yield
 */
export class YoutubeCommentsCollector implements Collector<YoutubeComment> {
  readonly source = 'youtube-comments';

  /**
   * 영상별 댓글 수집
   * keyword에 videoId를 전달
   * 페이지 단위(최대 100건)로 yield
   */
  /**
   * since 증분 모드:
   * - options.since 지정 시 order='time'으로 강제 (최신순 필수).
   * - 최신순 정렬 상태에서 publishedAt <= since 댓글 발견 시 즉시 종료
   *   (같은 페이지 내 이후 댓글과 다음 페이지는 모두 더 오래됨).
   */
  async *collect(options: CollectionOptions): AsyncGenerator<YoutubeComment[], void, unknown> {
    const youtube = getYoutubeClient();
    const videoId = options.keyword;
    const maxComments = options.maxComments ?? DEFAULT_MAX_COMMENTS;
    const since = options.since ? new Date(options.since) : null;
    const order: 'time' | 'relevance' = since ? 'time' : (options.commentOrder ?? 'relevance');

    let totalCollected = 0;
    let nextPageToken: string | undefined;

    while (totalCollected < maxComments) {
      try {
        const response = await youtube.commentThreads.list({
          part: ['snippet', 'replies'],
          videoId,
          maxResults: Math.min(maxComments - totalCollected, COMMENTS_PAGE_SIZE),
          order,
          pageToken: nextPageToken,
        });

        const items = response.data.items;
        if (!items || items.length === 0) break;

        const comments: YoutubeComment[] = [];
        let stopAfterPage = false;

        for (const thread of items) {
          const topComment = thread.snippet?.topLevelComment;
          if (!topComment?.snippet) continue;

          const publishedAt: Date | null = topComment.snippet.publishedAt
            ? new Date(topComment.snippet.publishedAt)
            : null;

          // since cutoff: 최신순이므로 첫 오래된 것 발견 시 즉시 종료
          if (since && publishedAt && publishedAt.getTime() <= since.getTime()) {
            stopAfterPage = true;
            break;
          }

          comments.push({
            sourceId: topComment.id ?? '',
            parentId: null,
            videoSourceId: videoId,
            content: topComment.snippet.textDisplay ?? '',
            author: topComment.snippet.authorDisplayName ?? '',
            likeCount: topComment.snippet.likeCount ?? 0,
            publishedAt,
            rawData: topComment as unknown as Record<string, unknown>,
          });

          if (thread.replies?.comments) {
            for (const reply of thread.replies.comments) {
              if (!reply.snippet) continue;
              const replyPublishedAt: Date | null = reply.snippet.publishedAt
                ? new Date(reply.snippet.publishedAt)
                : null;
              // 대댓글은 since 필터만 (종료는 topLevel이 결정)
              if (since && replyPublishedAt && replyPublishedAt.getTime() <= since.getTime()) {
                continue;
              }
              comments.push({
                sourceId: reply.id ?? '',
                parentId: topComment.id ?? null,
                videoSourceId: videoId,
                content: reply.snippet.textDisplay ?? '',
                author: reply.snippet.authorDisplayName ?? '',
                likeCount: reply.snippet.likeCount ?? 0,
                publishedAt: replyPublishedAt,
                rawData: reply as unknown as Record<string, unknown>,
              });
            }
          }
        }

        if (comments.length > 0) {
          totalCollected += comments.length;
          yield comments;
        }

        if (stopAfterPage) break;

        nextPageToken = response.data.nextPageToken ?? undefined;
        if (!nextPageToken) break;
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        if (error.code === 403) {
          break;
        }
        throw err;
      }
    }
  }
}
