// YouTube 댓글 수집기 (YouTube Data API v3 commentThreads)
import type { Collector, CollectionOptions } from './base';
import { getYoutubeClient } from '../utils/youtube-client';

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
  async *collect(options: CollectionOptions): AsyncGenerator<YoutubeComment[], void, unknown> {
    const youtube = getYoutubeClient();
    if (!youtube) return; // API 키 미설정 시 빈 결과
    const videoId = options.keyword; // videoId를 keyword로 전달
    const maxComments = options.maxComments ?? DEFAULT_MAX_COMMENTS;
    let totalCollected = 0;
    let nextPageToken: string | undefined;

    while (totalCollected < maxComments) {
      try {
        const response = await youtube.commentThreads.list({
          part: ['snippet', 'replies'],
          videoId,
          maxResults: Math.min(maxComments - totalCollected, COMMENTS_PAGE_SIZE),
          order: 'relevance',
          pageToken: nextPageToken,
        });

        const items = response.data.items;
        if (!items || items.length === 0) break;

        const comments: YoutubeComment[] = [];

        for (const thread of items) {
          // 최상위 댓글
          const topComment = thread.snippet?.topLevelComment;
          if (topComment?.snippet) {
            comments.push({
              sourceId: topComment.id ?? '',
              parentId: null,
              videoSourceId: videoId,
              content: topComment.snippet.textDisplay ?? '',
              author: topComment.snippet.authorDisplayName ?? '',
              likeCount: topComment.snippet.likeCount ?? 0,
              publishedAt: topComment.snippet.publishedAt
                ? new Date(topComment.snippet.publishedAt)
                : null,
              rawData: topComment as unknown as Record<string, unknown>,
            });
          }

          // 대댓글 (replies가 있는 경우)
          if (thread.replies?.comments) {
            for (const reply of thread.replies.comments) {
              if (!reply.snippet) continue;
              comments.push({
                sourceId: reply.id ?? '',
                parentId: topComment?.id ?? null,
                videoSourceId: videoId,
                content: reply.snippet.textDisplay ?? '',
                author: reply.snippet.authorDisplayName ?? '',
                likeCount: reply.snippet.likeCount ?? 0,
                publishedAt: reply.snippet.publishedAt
                  ? new Date(reply.snippet.publishedAt)
                  : null,
                rawData: reply as unknown as Record<string, unknown>,
              });
            }
          }
        }

        if (comments.length > 0) {
          totalCollected += comments.length;
          yield comments;
        }

        // 다음 페이지 토큰 확인
        nextPageToken = response.data.nextPageToken ?? undefined;
        if (!nextPageToken) break;
      } catch (err: unknown) {
        // 댓글이 비활성화된 영상 -- 403 에러 시 graceful skip
        const error = err as { code?: number; message?: string };
        if (error.code === 403) {
          // 댓글 비활성화 영상 -- 건너뛰기
          break;
        }
        throw err;
      }
    }
  }
}
