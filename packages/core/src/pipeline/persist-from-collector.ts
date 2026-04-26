// 구독 단축 경로(useCollectorLoader=true)에서 collector가 반환한 fullset payload를
// 분석 DB의 articles/comments/videos에 upsert하고, article_jobs/comment_jobs/video_jobs
// linkage 테이블에 INSERT한다.
//
// 일반 경로의 collect → normalize → persist 잡을 우회하므로, persist만 별도로 호출해서
// linkage가 비는 결함(job 271 사례)을 막는다.
import type { articles, videos, comments } from '../db/schema/collections';
import { persistArticles, persistVideos, persistComments } from './persist';

export type CollectorFullsetPayload = {
  articles: (typeof articles.$inferInsert)[];
  videos: (typeof videos.$inferInsert)[];
  comments: (typeof comments.$inferInsert)[];
};

export type PersistFromCollectorResult = {
  articles: number;
  videos: number;
  comments: number;
};

/**
 * collector payload를 분석 DB로 영속화 + linkage 채우기.
 *
 * - 본문은 onConflictDoUpdate로 갱신 (`persistArticles` 등 재사용)
 * - linkage(article_jobs/video_jobs/comment_jobs)는 onConflictDoNothing — 같은 잡 재실행 안전
 * - 트랜잭션은 테이블별로 분리(기존 패턴 유지) — articles 실패 시 comments는 롤백 안 됨
 */
export async function persistFromCollectorPayload(
  jobId: number,
  payload: CollectorFullsetPayload,
): Promise<PersistFromCollectorResult> {
  const [articleRows, videoRows, commentRows] = await Promise.all([
    persistArticles(jobId, payload.articles),
    persistVideos(jobId, payload.videos),
    persistComments(jobId, payload.comments),
  ]);
  return {
    articles: articleRows.length,
    videos: videoRows.length,
    comments: commentRows.length,
  };
}
