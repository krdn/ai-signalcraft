import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Job } from 'bullmq';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions, rawItems, fetchErrors } from '../db/schema';
import type { LayerAPayload } from '../db/schema';
import { getCollectQueue } from '../queue/queues';
import type { CollectionJobData, CollectorSource } from '../queue/types';
import { sanitizeError } from './masking';

/**
 * BullMQ 조회 실패 시에도 Layer A는 완주해야 한다 (진단의 핵심 용도).
 * Redis 장애 시 state='unreachable'로 grace 처리.
 */
async function safeGetJobInfo(
  runId: string,
  source: string,
): Promise<{ job: Job<CollectionJobData> | null; state: string }> {
  try {
    const queue = getCollectQueue(source as CollectorSource);
    const job = await queue.getJob(`${runId}-${source}`);
    if (!job) return { job: null, state: 'unknown' };
    const state = await job.getState();
    return { job, state };
  } catch (err) {
    console.warn(
      `[layer-a] BullMQ 조회 실패 runId=${runId} source=${source}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { job: null, state: 'unreachable' };
  }
}

/**
 * Layer A — (runId, source) 동기 스냅샷. cancel 시점에 호출.
 * 목표 지연 ≤500ms — BullMQ 조회 + 몇 개 DB 쿼리로 구성.
 *
 * 성능: 독립 쿼리는 Promise.all로 병렬화.
 *   1단계: BullMQ job + total + byType + runRow (서로 독립)
 *   2단계: fetchErrors + sub (runRow 의존, 서로는 독립)
 *
 * fetch_errors에 run_id 컬럼이 없으므로 (subscription_id, source, time 윈도우)로
 * 근사 조회한다. collection_runs.time 이후 ±5분 구간이 매칭 기준.
 */
export async function collectLayerA(runId: string, source: string): Promise<LayerAPayload> {
  const db = getDb();

  // 1단계 — 서로 독립한 4개 조회 병렬화
  const [jobInfo, totalResult, byTypeRows, runRowResult] = await Promise.all([
    safeGetJobInfo(runId, source),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(rawItems)
      .where(eq(rawItems.fetchedFromRun, runId)),
    db
      .select({
        itemType: rawItems.itemType,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(eq(rawItems.fetchedFromRun, runId))
      .groupBy(rawItems.itemType),
    db
      .select()
      .from(collectionRuns)
      .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)))
      .orderBy(desc(collectionRuns.time))
      .limit(1),
  ]);

  const { job, state: bullState } = jobInfo;
  const [{ total }] = totalResult;
  const [runRow] = runRowResult;

  const byTypeMap = { article: 0, video: 0, comment: 0 };
  for (const r of byTypeRows) {
    byTypeMap[r.itemType as keyof typeof byTypeMap] = r.count;
  }

  // 2단계 — runRow 의존, fetchErrors·sub는 서로 독립이라 병렬화
  let fetchErrorsCount = 0;
  let lastFetchError: string | null = null;
  let sub: typeof keywordSubscriptions.$inferSelect | null = null;

  if (runRow) {
    const windowStart = new Date(runRow.time.getTime() - 5 * 60 * 1000);
    const [errs, subRows] = await Promise.all([
      db
        .select()
        .from(fetchErrors)
        .where(
          and(
            eq(fetchErrors.subscriptionId, runRow.subscriptionId),
            eq(fetchErrors.source, source),
            gte(fetchErrors.time, windowStart),
          ),
        )
        .orderBy(desc(fetchErrors.time))
        .limit(10),
      db
        .select()
        .from(keywordSubscriptions)
        .where(eq(keywordSubscriptions.id, runRow.subscriptionId))
        .limit(1),
    ]);
    fetchErrorsCount = errs.length;
    lastFetchError = sanitizeError(errs[0]?.errorMessage ?? null);
    sub = subRows[0] ?? null;
  }

  return {
    runId,
    source,
    jobId: `${runId}-${source}`,
    bullState,
    attemptsMade: job?.attemptsMade ?? 0,
    attemptsMax: (job?.opts?.attempts as number) ?? 3,
    failedReason: sanitizeError(job?.failedReason ?? null),
    jobTimestampMs: job?.timestamp ?? null,
    processedOnMs: job?.processedOn ?? null,
    finishedOnMs: job?.finishedOn ?? null,
    partialRawItemsCount: total ?? 0,
    partialRawItemsByType: byTypeMap,
    fetchErrorsCount,
    lastFetchError,
    collectionRunsRow: runRow
      ? {
          status: runRow.status,
          itemsCollected: runRow.itemsCollected,
          durationMs: runRow.durationMs,
          blocked: runRow.blocked,
        }
      : null,
    subscription: sub ? { id: sub.id, keyword: sub.keyword, status: sub.status } : null,
  };
}
