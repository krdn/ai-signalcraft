// 정규화된 데이터를 DB에 upsert (D-07: 중복 제거)
import { db } from '../db';
import { articles, videos, comments, collectionJobs } from '../db/schema/collections';
import { sql } from 'drizzle-orm';

/**
 * 기사 upsert -- articles_source_id_idx(source + sourceId) 충돌 시 업데이트
 * .returning()으로 upsert된 레코드(id 포함)를 반환하여 댓글 FK 연결에 사용
 */
export async function persistArticles(data: (typeof articles.$inferInsert)[]) {
  if (data.length === 0) return [];
  return db
    .insert(articles)
    .values(data)
    .onConflictDoUpdate({
      target: [articles.source, articles.sourceId],
      set: {
        title: sql`excluded.title`,
        content: sql`excluded.content`,
        rawData: sql`excluded.raw_data`,
        collectedAt: sql`excluded.collected_at`,
      },
    })
    .returning();
}

/**
 * 영상 upsert -- videos_source_id_idx 충돌 시 통계 업데이트
 * .returning()으로 upsert된 레코드(id 포함)를 반환하여 댓글 FK 연결에 사용
 */
export async function persistVideos(data: (typeof videos.$inferInsert)[]) {
  if (data.length === 0) return [];
  return db
    .insert(videos)
    .values(data)
    .onConflictDoUpdate({
      target: [videos.source, videos.sourceId],
      set: {
        viewCount: sql`excluded.view_count`,
        likeCount: sql`excluded.like_count`,
        commentCount: sql`excluded.comment_count`,
        rawData: sql`excluded.raw_data`,
        collectedAt: sql`excluded.collected_at`,
      },
    })
    .returning();
}

/**
 * 댓글 upsert -- comments_source_id_idx 충돌 시 업데이트
 */
export async function persistComments(data: (typeof comments.$inferInsert)[]) {
  if (data.length === 0) return [];
  return db
    .insert(comments)
    .values(data)
    .onConflictDoUpdate({
      target: [comments.source, comments.sourceId],
      set: {
        content: sql`excluded.content`,
        likeCount: sql`excluded.like_count`,
        dislikeCount: sql`excluded.dislike_count`,
        rawData: sql`excluded.raw_data`,
        collectedAt: sql`excluded.collected_at`,
      },
    })
    .returning();
}

/**
 * 수집 작업 상태 업데이트 (D-06: 소스별 상세 추적)
 */
export async function updateJobProgress(
  jobId: number,
  progress: Record<string, unknown>,
  status?: 'pending' | 'running' | 'completed' | 'partial_failure' | 'failed',
) {
  return db
    .update(collectionJobs)
    .set({
      progress: progress as any,
      ...(status ? { status } : {}),
      updatedAt: new Date(),
    })
    .where(sql`id = ${jobId}`);
}

/**
 * 수집 작업 생성 -- 정수 job.id를 반환하여 triggerCollection에 전달
 */
export async function createCollectionJob(params: {
  keyword: string;
  startDate: Date;
  endDate: Date;
  limits?: Record<string, number>;
}) {
  const [job] = await db
    .insert(collectionJobs)
    .values({
      keyword: params.keyword,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'pending',
      limits: params.limits as any,
      progress: {
        naver: { status: 'pending', articles: 0, comments: 0 },
        youtube: { status: 'pending', videos: 0, comments: 0 },
        dcinside: { status: 'pending', posts: 0, comments: 0 },
        fmkorea: { status: 'pending', posts: 0, comments: 0 },
        clien: { status: 'pending', posts: 0, comments: 0 },
      } as any,
    })
    .returning();
  return job;
}
