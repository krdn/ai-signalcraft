import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions, rawItems, fetchErrors } from '../db/schema';
import type { LayerAPayload } from '../db/schema';
import { getCollectQueue } from '../queue/queues';
import type { CollectorSource } from '../queue/types';
import { sanitizeError } from './masking';

/**
 * Layer A — (runId, source) 동기 스냅샷. cancel 시점에 호출.
 * 목표 지연 ≤500ms — BullMQ 조회 + 몇 개 DB 쿼리로 구성.
 *
 * fetch_errors에 run_id 컬럼이 없으므로 (subscription_id, source, time 윈도우)로
 * 근사 조회한다. collection_runs.time 이후 ±5분 구간이 매칭 기준.
 */
export async function collectLayerA(runId: string, source: string): Promise<LayerAPayload> {
  const db = getDb();
  const queue = getCollectQueue(source as CollectorSource);
  const job = await queue.getJob(`${runId}-${source}`);
  const bullState = job ? await job.getState() : 'unknown';

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(rawItems)
    .where(eq(rawItems.fetchedFromRun, runId));

  const byTypeRows = await db
    .select({
      itemType: rawItems.itemType,
      count: sql<number>`count(*)::int`,
    })
    .from(rawItems)
    .where(eq(rawItems.fetchedFromRun, runId))
    .groupBy(rawItems.itemType);

  const byTypeMap = { article: 0, video: 0, comment: 0 };
  for (const r of byTypeRows) {
    byTypeMap[r.itemType as keyof typeof byTypeMap] = r.count;
  }

  const [runRow] = await db
    .select()
    .from(collectionRuns)
    .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)))
    .orderBy(desc(collectionRuns.time))
    .limit(1);

  // fetch_errors: run_id가 없어 (subscriptionId, source, time 윈도우)로 근사 매칭
  let fetchErrorsCount = 0;
  let lastFetchError: string | null = null;
  if (runRow) {
    const windowStart = new Date(runRow.time.getTime() - 5 * 60 * 1000);
    const errs = await db
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
      .limit(10);
    fetchErrorsCount = errs.length;
    lastFetchError = sanitizeError(errs[0]?.errorMessage ?? null);
  }

  const [sub] = runRow
    ? await db
        .select()
        .from(keywordSubscriptions)
        .where(eq(keywordSubscriptions.id, runRow.subscriptionId))
        .limit(1)
    : [null];

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
