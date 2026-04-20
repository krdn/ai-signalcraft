import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { Job } from 'bullmq';
import { getDb } from '../db';
import {
  collectionRuns,
  keywordSubscriptions,
  runCancellations,
  runDiagnostics,
  runRetryLinks,
} from '../db/schema';
import { collectLayerA } from '../diagnostics/collect-run';
import { getDiagnosticsQueue } from '../diagnostics/queue';
import { getCollectQueue, enqueueCollectionJob } from './queues';
import type { CollectorSource, CollectionJobData } from './types';

export type CancelMode = 'graceful' | 'force';

export interface CancelResult {
  runId: string;
  source: string;
  mode: CancelMode;
  alreadyCancelled?: boolean;
  alreadyCancelling?: boolean;
  diagnosticId: string;
}

const MAX_RETRY_CHAIN = 3;

/**
 * cancel 요청 — graceful/force 양쪽 모두 멱등.
 * Task 0 발견: BullMQ 외부 force cancel은 processor를 실제로 멈추지 못한다.
 * 따라서 이 함수가 하는 일:
 *   1) run_cancellations 상태 전이 → worker checkpoint가 이 플래그를 읽고 중단
 *   2) BullMQ waiting/delayed는 제거 (force일 때 active도 시도하지만 best-effort)
 *   3) Layer A 동기 수집 → run_diagnostics insert
 *   4) Layer B/C enqueue + graceful 10분 timeout escalate
 */
export async function cancelRun(
  runId: string,
  source: string,
  mode: CancelMode,
  triggeredBy: string,
): Promise<CancelResult> {
  const db = getDb();

  // 멱등 체크 — 이미 cancelled면 no-op, 이미 cancelling + graceful이면 no-op.
  // graceful → force 승격은 허용.
  const [existing] = await db
    .select()
    .from(runCancellations)
    .where(and(eq(runCancellations.runId, runId), eq(runCancellations.source, source)));
  if (existing?.status === 'cancelled') {
    return { runId, source, mode, alreadyCancelled: true, diagnosticId: '' };
  }
  if (existing?.status === 'cancelling' && mode === 'graceful') {
    return { runId, source, mode, alreadyCancelling: true, diagnosticId: '' };
  }

  await db
    .insert(runCancellations)
    .values({ runId, source, status: 'cancelling', mode, triggeredBy })
    .onConflictDoUpdate({
      target: [runCancellations.runId, runCancellations.source],
      set: { status: 'cancelling', mode, triggeredBy, requestedAt: new Date() },
    });

  // BullMQ 처리 — 실패해도 DB 상태는 유지 (checkpoint가 결국 감지)
  try {
    const queue = getCollectQueue(source as CollectorSource);
    const job = await queue.getJob(`${runId}-${source}`);
    if (job) {
      const state = await job.getState();
      if (state === 'waiting' || state === 'delayed') {
        await job.remove().catch(() => void 0);
      } else if (state === 'active' && mode === 'force') {
        // external moveToFailed는 Redis 상태만 바꾸고 processor는 계속 실행됨 (Task 0)
        // 그래도 queue state를 즉시 failed로 플립해 UI 혼란을 줄이는 효과는 있다.
        try {
          await job.discard();
          // BullMQ 5.x: worker 외부에서 token을 얻을 수 없으므로 '0'으로 bypass
          await (job as Job).moveToFailed(new Error('cancelled'), '0', false);
        } catch {
          // 실패 시 remove로 폴백 — checkpoint가 실제 중단을 담당
          await job.remove().catch(() => void 0);
        }
      }
    }
  } catch (err) {
    console.warn(
      `[cancelRun] BullMQ 조작 실패 runId=${runId} source=${source}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Layer A 동기 수집 (≤500ms 목표)
  const layerA = await collectLayerA(runId, source);
  const [diag] = await db
    .insert(runDiagnostics)
    .values({
      runId,
      source,
      triggeredBy: 'user_cancel',
      layerA,
    })
    .returning();

  // Layer B/C 비동기 enqueue + graceful 10분 timeout
  const dq = getDiagnosticsQueue();
  await dq.add('layer-b', { kind: 'layer-b', diagnosticId: diag.id, source });
  await dq.add('layer-c', { kind: 'layer-c', diagnosticId: diag.id });
  if (mode === 'graceful') {
    await dq.add(
      'escalate',
      { kind: 'escalate-to-force', runId, source },
      { delay: 10 * 60 * 1000 },
    );
  }

  return { runId, source, mode, diagnosticId: diag.id };
}

/**
 * 구독 단위 일괄 cancel — running 상태인 모든 (runId, source)에 cancelRun 호출.
 * 직렬 실행 (병렬 시 BullMQ 경합 + DB 부하 증가).
 */
export async function cancelBySubscription(
  subscriptionId: number,
  mode: CancelMode,
  triggeredBy: string,
): Promise<{ cancelled: number; runIds: string[] }> {
  const db = getDb();
  const rows = await db
    .select({ runId: collectionRuns.runId, source: collectionRuns.source })
    .from(collectionRuns)
    .where(
      and(eq(collectionRuns.subscriptionId, subscriptionId), eq(collectionRuns.status, 'running')),
    );

  const runIds: string[] = [];
  for (const r of rows) {
    await cancelRun(r.runId, r.source, mode, triggeredBy);
    runIds.push(r.runId);
  }
  return { cancelled: rows.length, runIds: [...new Set(runIds)] };
}

/**
 * 전체 긴급 정지 — 모든 running (runId, source)에 cancelRun.
 * 호출자는 CANCEL_ALL confirm 문자열 검증 책임 (tRPC 단에서 강제).
 */
export async function cancelAll(
  mode: CancelMode,
  triggeredBy: string,
): Promise<{ cancelled: number }> {
  const db = getDb();
  const rows = await db
    .select({ runId: collectionRuns.runId, source: collectionRuns.source })
    .from(collectionRuns)
    .where(eq(collectionRuns.status, 'running'));

  for (const r of rows) {
    await cancelRun(r.runId, r.source, mode, triggeredBy);
  }
  return { cancelled: rows.length };
}

/**
 * 재시도 — 원본 payload를 BullMQ 또는 DB에서 복원해 새 runId로 enqueue.
 * 체인 깊이 MAX_RETRY_CHAIN 제한, 이미 재시도된 (runId, source)는 기존 newRunId 재사용.
 */
export async function retryRun(
  runId: string,
  source: string,
  _triggeredBy: string,
): Promise<{ newRunId: string; reused: boolean }> {
  const db = getDb();

  // 멱등 — 이미 재시도되었으면 동일 newRunId 반환
  const [existing] = await db
    .select()
    .from(runRetryLinks)
    .where(and(eq(runRetryLinks.originalRunId, runId), eq(runRetryLinks.source, source)));
  if (existing) {
    return { newRunId: existing.newRunId, reused: true };
  }

  // 체인 깊이 체크
  const depth = await computeRetryChainDepth(runId, source);
  if (depth >= MAX_RETRY_CHAIN) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `재시도 체인 ${MAX_RETRY_CHAIN}회 초과 (depth=${depth})`,
    });
  }

  const payload = await restoreJobPayload(runId, source);
  if (!payload) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'run payload 복원 불가' });
  }

  const newRunId = randomUUID();
  await enqueueCollectionJob({ ...payload, runId: newRunId });
  await db.insert(runRetryLinks).values({
    originalRunId: runId,
    newRunId,
    source,
  });

  return { newRunId, reused: false };
}

/**
 * 체인 깊이 = newRunId를 따라 originalRunId로 거슬러 올라가는 횟수.
 * MAX+1까지만 탐색 (무한 루프 방어 겸 성능).
 */
async function computeRetryChainDepth(runId: string, source: string): Promise<number> {
  const db = getDb();
  let depth = 0;
  let current = runId;
  while (depth < MAX_RETRY_CHAIN + 1) {
    const [link] = await db
      .select()
      .from(runRetryLinks)
      .where(and(eq(runRetryLinks.newRunId, current), eq(runRetryLinks.source, source)));
    if (!link) break;
    current = link.originalRunId;
    depth++;
  }
  return depth;
}

/**
 * 원본 job payload 복원. BullMQ에 남아있으면 그걸 쓰고, 없으면
 * collection_runs + keyword_subscriptions에서 재구성 (dateRange는 스케줄 로직 모방).
 */
async function restoreJobPayload(runId: string, source: string): Promise<CollectionJobData | null> {
  const db = getDb();
  const queue = getCollectQueue(source as CollectorSource);
  const job = await queue.getJob(`${runId}-${source}`);
  if (job?.data) return job.data;

  const [run] = await db
    .select()
    .from(collectionRuns)
    .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)))
    .orderBy(desc(collectionRuns.time))
    .limit(1);
  if (!run) return null;

  const [sub] = await db
    .select()
    .from(keywordSubscriptions)
    .where(eq(keywordSubscriptions.id, run.subscriptionId))
    .limit(1);
  if (!sub) return null;

  // 스케줄러 로직과 동일한 rolling overlap 방식으로 dateRange 재구성
  const intervalMs = sub.intervalHours * 3600 * 1000;
  const overlapMs = Math.floor(intervalMs * 0.15);
  const endMs = run.time.getTime();
  const startMs = endMs - intervalMs - overlapMs;

  return {
    runId,
    source: source as CollectorSource,
    subscriptionId: sub.id,
    keyword: sub.keyword,
    limits: sub.limits,
    options: sub.options ?? undefined,
    dateRange: {
      startISO: new Date(startMs).toISOString(),
      endISO: new Date(endMs).toISOString(),
    },
    triggerType: 'manual',
  };
}
