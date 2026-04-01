// 데이터 정리 함수 — 분석 작업 삭제, 고아 데이터 정리, 보존 기간 기반 일괄 정리
import { eq, lt, and, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import {
  collectionJobs,
  articles,
  videos,
  comments,
  articleJobs,
  videoJobs,
  commentJobs,
} from '../db/schema/collections';
import { analysisResults, analysisReports } from '../db/schema/analysis';

/**
 * 단일 분석 작업 삭제
 * - 진행 중인 BullMQ 작업 제거
 * - DB에서 collection_job 삭제 (CASCADE로 analysis_results/reports 자동 삭제)
 * - 조인 테이블도 CASCADE로 자동 삭제
 * - 더 이상 어떤 job에도 속하지 않는 고아 콘텐츠 정리
 */
export async function deleteJob(jobId: number): Promise<{
  deleted: boolean;
  message: string;
  cleanedUp: { articles: number; videos: number; comments: number };
}> {
  const db = getDb();

  // 작업 존재 확인
  const [job] = await db
    .select({ id: collectionJobs.id, status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job)
    return {
      deleted: false,
      message: '작업을 찾을 수 없습니다',
      cleanedUp: { articles: 0, videos: 0, comments: 0 },
    };

  // 진행 중이면 BullMQ 작업 먼저 제거
  if (job.status === 'running' || job.status === 'pending' || job.status === 'paused') {
    await removeBullMQJobs(jobId);
  }

  // 이 job에만 속한 콘텐츠 ID 조회 (삭제 전에 미리 파악)
  const orphanArticleIds = await findExclusiveContentIds(db, articleJobs, 'articleId', jobId);
  const orphanVideoIds = await findExclusiveContentIds(db, videoJobs, 'videoId', jobId);
  const orphanCommentIds = await findExclusiveContentIds(db, commentJobs, 'commentId', jobId);

  // 순서 중요: FK 의존 순서 역방향으로 삭제 (CASCADE 미적용 환경에서도 안전)
  // 1) 분석 결과/리포트 삭제 (collection_jobs 참조)
  await db.delete(analysisReports).where(eq(analysisReports.jobId, jobId));
  await db.delete(analysisResults).where(eq(analysisResults.jobId, jobId));

  // 2) 조인 테이블 삭제
  await db.delete(articleJobs).where(eq(articleJobs.jobId, jobId));
  await db.delete(videoJobs).where(eq(videoJobs.jobId, jobId));
  await db.delete(commentJobs).where(eq(commentJobs.jobId, jobId));

  // 3) 레거시 job_id FK를 NULL로 (articles/videos/comments의 job_id 컬럼)
  await db.update(articles).set({ jobId: null }).where(eq(articles.jobId, jobId));
  await db.update(videos).set({ jobId: null }).where(eq(videos.jobId, jobId));
  await db.update(comments).set({ jobId: null }).where(eq(comments.jobId, jobId));

  // 4) collection_job 삭제
  await db.delete(collectionJobs).where(eq(collectionJobs.id, jobId));

  // 5) 이 job에만 속했던 고아 콘텐츠 삭제
  let deletedArticles = 0,
    deletedVideos = 0,
    deletedComments = 0;

  if (orphanCommentIds.length > 0) {
    const result = await db.delete(comments).where(inArray(comments.id, orphanCommentIds));
    deletedComments = result.rowCount ?? orphanCommentIds.length;
  }
  if (orphanArticleIds.length > 0) {
    const result = await db.delete(articles).where(inArray(articles.id, orphanArticleIds));
    deletedArticles = result.rowCount ?? orphanArticleIds.length;
  }
  if (orphanVideoIds.length > 0) {
    const result = await db.delete(videos).where(inArray(videos.id, orphanVideoIds));
    deletedVideos = result.rowCount ?? orphanVideoIds.length;
  }

  return {
    deleted: true,
    message: `작업 #${jobId} 삭제 완료`,
    cleanedUp: { articles: deletedArticles, videos: deletedVideos, comments: deletedComments },
  };
}

/**
 * 여러 작업 일괄 삭제
 */
export async function deleteJobs(jobIds: number[]): Promise<{
  deleted: number;
  message: string;
  cleanedUp: { articles: number; videos: number; comments: number };
}> {
  let totalArticles = 0,
    totalVideos = 0,
    totalComments = 0;
  let deleted = 0;

  for (const jobId of jobIds) {
    const result = await deleteJob(jobId);
    if (result.deleted) {
      deleted++;
      totalArticles += result.cleanedUp.articles;
      totalVideos += result.cleanedUp.videos;
      totalComments += result.cleanedUp.comments;
    }
  }

  return {
    deleted,
    message: `${deleted}개 작업 삭제 완료`,
    cleanedUp: { articles: totalArticles, videos: totalVideos, comments: totalComments },
  };
}

/**
 * 보존 기간 기반 자동 정리
 * - retentionDays일 이전의 완료/실패/취소 작업만 삭제
 * - 진행 중(running/pending/paused) 작업은 건드리지 않음
 */
export async function cleanupOldJobs(retentionDays: number): Promise<{
  deleted: number;
  message: string;
}> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const terminalStatuses = ['completed', 'failed', 'cancelled', 'partial_failure'] as const;

  // 삭제 대상 job ID 조회
  const oldJobs = await db
    .select({ id: collectionJobs.id })
    .from(collectionJobs)
    .where(
      and(
        lt(collectionJobs.createdAt, cutoffDate),
        inArray(collectionJobs.status, [...terminalStatuses]),
      ),
    );

  if (oldJobs.length === 0) {
    return { deleted: 0, message: '삭제할 작업이 없습니다' };
  }

  const jobIds = oldJobs.map((j) => j.id);
  const result = await deleteJobs(jobIds);

  return {
    deleted: result.deleted,
    message: `${retentionDays}일 이전 작업 ${result.deleted}개 삭제 완료 (기사: ${result.cleanedUp.articles}, 영상: ${result.cleanedUp.videos}, 댓글: ${result.cleanedUp.comments})`,
  };
}

/**
 * 고아 콘텐츠 정리 — 어떤 job에도 속하지 않는 articles/videos/comments 삭제
 */
export async function cleanupOrphanedData(): Promise<{
  articles: number;
  videos: number;
  comments: number;
  message: string;
}> {
  const db = getDb();

  // 어떤 job에도 속하지 않는 기사 삭제
  const orphanArticles = await db.execute(sql`
    DELETE FROM articles WHERE id NOT IN (
      SELECT DISTINCT article_id FROM article_jobs
    ) RETURNING id
  `);

  // 어떤 job에도 속하지 않는 영상 삭제
  const orphanVideos = await db.execute(sql`
    DELETE FROM videos WHERE id NOT IN (
      SELECT DISTINCT video_id FROM video_jobs
    ) RETURNING id
  `);

  // 어떤 job에도 속하지 않는 댓글 삭제
  const orphanComments = await db.execute(sql`
    DELETE FROM comments WHERE id NOT IN (
      SELECT DISTINCT comment_id FROM comment_jobs
    ) RETURNING id
  `);

  const aCount = (orphanArticles as any).rowCount ?? 0;
  const vCount = (orphanVideos as any).rowCount ?? 0;
  const cCount = (orphanComments as any).rowCount ?? 0;

  return {
    articles: aCount,
    videos: vCount,
    comments: cCount,
    message: `고아 데이터 정리 완료 (기사: ${aCount}, 영상: ${vCount}, 댓글: ${cCount})`,
  };
}

/**
 * DB 통계 조회 — 데이터 축적 현황 파악
 */
export async function getDataStats(): Promise<{
  jobs: number;
  articles: number;
  videos: number;
  comments: number;
  analysisResults: number;
  analysisReports: number;
  oldestJobDate: string | null;
}> {
  const db = getDb();

  const [
    [jobCount],
    [articleCount],
    [videoCount],
    [commentCount],
    [resultCount],
    [reportCount],
    [oldest],
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(collectionJobs),
    db.select({ count: sql<number>`count(*)::int` }).from(articles),
    db.select({ count: sql<number>`count(*)::int` }).from(videos),
    db.select({ count: sql<number>`count(*)::int` }).from(comments),
    db.select({ count: sql<number>`count(*)::int` }).from(analysisResults),
    db.select({ count: sql<number>`count(*)::int` }).from(analysisReports),
    db.select({ oldest: sql<string>`min(created_at)::text` }).from(collectionJobs),
  ]);

  return {
    jobs: jobCount.count,
    articles: articleCount.count,
    videos: videoCount.count,
    comments: commentCount.count,
    analysisResults: resultCount.count,
    analysisReports: reportCount.count,
    oldestJobDate: oldest.oldest,
  };
}

// --- 내부 헬퍼 ---

/** 특정 job에만 속한(다른 job에 속하지 않는) 콘텐츠 ID 조회 */
async function findExclusiveContentIds(
  db: ReturnType<typeof getDb>,
  joinTable: typeof articleJobs | typeof videoJobs | typeof commentJobs,
  contentIdColumn: 'articleId' | 'videoId' | 'commentId',
  jobId: number,
): Promise<number[]> {
  // 이 job에 속한 콘텐츠 중, 다른 job에는 속하지 않는 것
  const result = await db.execute(sql`
    SELECT j1.${sql.raw(toSnakeCase(contentIdColumn))} as content_id
    FROM ${joinTable} j1
    WHERE j1.job_id = ${jobId}
      AND NOT EXISTS (
        SELECT 1 FROM ${joinTable} j2
        WHERE j2.${sql.raw(toSnakeCase(contentIdColumn))} = j1.${sql.raw(toSnakeCase(contentIdColumn))}
          AND j2.job_id != ${jobId}
      )
  `);
  return (result as any).rows?.map((r: any) => r.content_id) ?? [];
}

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** BullMQ에서 특정 job 관련 모든 상태의 작업 제거 */
async function removeBullMQJobs(jobId: number): Promise<void> {
  try {
    const { purgeAllBullMQJobs } = await import('./control');
    await purgeAllBullMQJobs(jobId);
  } catch {
    // 정리 실패 시 무시
  }
}
