// 정규화된 데이터를 DB에 upsert (D-07: 중복 제거)
// N:M 조인 테이블을 사용하여 기사/영상/댓글이 여러 job에서 공유 가능
import { getDb } from '../db';
import { articles, videos, comments, collectionJobs, articleJobs, videoJobs, commentJobs } from '../db/schema/collections';
import { sql } from 'drizzle-orm';

/**
 * 기사 upsert + 조인 테이블 삽입
 * - articles_source_id_idx(source + sourceId) 충돌 시 업데이트 (jobId 덮어쓰기 없음)
 * - article_jobs에 N:M 관계 레코드 추가
 * - 트랜잭션으로 원자성 보장
 */
export async function persistArticles(jobId: number, data: (typeof articles.$inferInsert)[]) {
  if (data.length === 0) return [];
  // 같은 batch 내 source+sourceId 중복 제거 (마지막 것 유지)
  const seen = new Map<string, typeof articles.$inferInsert>();
  for (const row of data) {
    seen.set(`${row.source}:${row.sourceId}`, row);
  }
  const deduped = [...seen.values()];

  return getDb().transaction(async (tx) => {
    const upserted = await tx
      .insert(articles)
      .values(deduped)
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

    // 조인 테이블에 N:M 관계 추가 (이미 있으면 무시)
    if (upserted.length > 0) {
      await tx
        .insert(articleJobs)
        .values(upserted.map((a) => ({ articleId: a.id, jobId })))
        .onConflictDoNothing();
    }

    return upserted;
  });
}

/**
 * 영상 upsert + 조인 테이블 삽입
 * - videos_source_id_idx 충돌 시 통계 업데이트 (jobId 덮어쓰기 없음)
 * - video_jobs에 N:M 관계 레코드 추가
 */
export async function persistVideos(jobId: number, data: (typeof videos.$inferInsert)[]) {
  if (data.length === 0) return [];

  return getDb().transaction(async (tx) => {
    const upserted = await tx
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

    if (upserted.length > 0) {
      await tx
        .insert(videoJobs)
        .values(upserted.map((v) => ({ videoId: v.id, jobId })))
        .onConflictDoNothing();
    }

    return upserted;
  });
}

/**
 * 댓글 upsert + 조인 테이블 삽입
 * - comments_source_id_idx 충돌 시 업데이트 (jobId 덮어쓰기 없음)
 * - comment_jobs에 N:M 관계 레코드 추가
 */
export async function persistComments(jobId: number, data: (typeof comments.$inferInsert)[]) {
  if (data.length === 0) return [];
  // 같은 batch 내 source+sourceId 중복 제거
  const seen = new Map<string, typeof comments.$inferInsert>();
  for (const row of data) {
    seen.set(`${row.source}:${row.sourceId}`, row);
  }
  const deduped = [...seen.values()];

  return getDb().transaction(async (tx) => {
    const upserted = await tx
      .insert(comments)
      .values(deduped)
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

    if (upserted.length > 0) {
      await tx
        .insert(commentJobs)
        .values(upserted.map((c) => ({ commentId: c.id, jobId })))
        .onConflictDoNothing();
    }

    return upserted;
  });
}

/**
 * 수집 작업 상태 업데이트 (D-06: 소스별 상세 추적)
 * JSONB 머지 방식: 기존 progress 값을 보존하면서 새 값을 병합
 */
export async function updateJobProgress(
  jobId: number,
  progress: Record<string, unknown>,
  status?: 'pending' | 'running' | 'completed' | 'partial_failure' | 'failed',
) {
  const hasProgress = Object.keys(progress).length > 0;

  return getDb()
    .update(collectionJobs)
    .set({
      ...(hasProgress
        ? { progress: sql`COALESCE(progress, '{}'::jsonb) || ${JSON.stringify(progress)}::jsonb` as any }
        : {}),
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
  const [job] = await getDb()
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
