import { and, eq, isNull, desc, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { videos, videoJobs } from '../db/schema';
import { getWhisperQueue, type WhisperJobData } from './whisper-queue';

/**
 * 이번 collection job에서 수집된 YouTube 영상 중 조회수 상위 N개를 Whisper 큐에 push.
 *
 * 정책:
 * - 이미 transcript가 있는 영상은 skip (Whisper가 예전에 채웠거나 쇼츠처럼 자막이 붙은 경우)
 * - viewCount NULL이면 skip — 조회수 기반 우선순위를 줄 수 없음
 * - 같은 sourceId가 여러 번 enqueue되어도 BullMQ의 jobId 중복 방지로 실제 작업은 1회
 *
 * 호출 시점: persist-youtube 완료 직후(pipeline-worker 내부).
 */
export async function enqueueWhisperForTopVideos(opts: {
  jobId: number;
  topN?: number;
}): Promise<{ enqueued: number; skipped: number }> {
  const topN = opts.topN ?? 20;
  const db = getDb();

  // 이번 job에서 수집된 YouTube 영상 중 transcript 없는 상위 N개
  const candidates = await db
    .select({
      id: videos.id,
      sourceId: videos.sourceId,
      viewCount: videos.viewCount,
    })
    .from(videos)
    .innerJoin(videoJobs, eq(videos.id, videoJobs.videoId))
    .where(
      and(
        eq(videoJobs.jobId, opts.jobId),
        eq(videos.source, 'youtube'),
        isNull(videos.transcript),
        // viewCount NOT NULL and > 0
        sql`${videos.viewCount} IS NOT NULL AND ${videos.viewCount} > 0`,
      ),
    )
    .orderBy(desc(videos.viewCount))
    .limit(topN);

  if (candidates.length === 0) return { enqueued: 0, skipped: 0 };

  const queue = getWhisperQueue();
  const jobs = candidates.map((c) => ({
    name: 'transcribe',
    data: {
      videoDbId: c.id,
      sourceId: c.sourceId,
      viewCount: c.viewCount ?? undefined,
    } satisfies WhisperJobData,
    opts: {
      // sourceId 기반 jobId — 같은 영상이 여러 번 enqueue되어도 한 번만 실행
      jobId: `yt:${c.sourceId}`,
      attempts: 2,
      backoff: { type: 'exponential' as const, delay: 30_000 },
      removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
      removeOnFail: { count: 500, age: 14 * 24 * 3600 },
    },
  }));

  await queue.addBulk(jobs);

  return { enqueued: candidates.length, skipped: 0 };
}

/**
 * 유휴 상황에서 DB의 transcript 미설정 영상을 백필(backfill).
 * 운영 투입 시 수동으로 호출하거나 cron으로 돌릴 수 있음. 초기 릴리스에서는 미사용.
 */
export async function enqueueWhisperBackfill(opts: {
  limit?: number;
  onlySourceIds?: string[];
}): Promise<{ enqueued: number }> {
  const limit = opts.limit ?? 50;
  const db = getDb();

  const filters = [
    eq(videos.source, 'youtube'),
    isNull(videos.transcript),
    sql`${videos.viewCount} IS NOT NULL AND ${videos.viewCount} > 0`,
  ];
  if (opts.onlySourceIds?.length) {
    filters.push(inArray(videos.sourceId, opts.onlySourceIds));
  }

  const rows = await db
    .select({ id: videos.id, sourceId: videos.sourceId, viewCount: videos.viewCount })
    .from(videos)
    .where(and(...filters))
    .orderBy(desc(videos.viewCount))
    .limit(limit);

  if (rows.length === 0) return { enqueued: 0 };

  const queue = getWhisperQueue();
  await queue.addBulk(
    rows.map((r) => ({
      name: 'transcribe',
      data: {
        videoDbId: r.id,
        sourceId: r.sourceId,
        viewCount: r.viewCount ?? undefined,
      } satisfies WhisperJobData,
      opts: {
        jobId: `yt:${r.sourceId}`,
        attempts: 2,
        removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
        removeOnFail: { count: 500, age: 14 * 24 * 3600 },
      },
    })),
  );

  return { enqueued: rows.length };
}
