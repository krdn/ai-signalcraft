# Run 중지·진단·재시도 및 운영 제어 기능 설계 (v2 — 실제 아키텍처 반영)

**작성일**: 2026-04-20
**재작성일**: 2026-04-20 (코드 실사 후 전면 재설계)
**대상 시스템**: `apps/collector/` (별도 마이크로서비스, DB=timescaledb:5435 `ais_collection`)
**대상 UI 페이지**: `apps/web/src/app/subscriptions/monitor/page.tsx`
**상태**: 설계 확정, 구현 전

## 0. v1과의 차이 요약

v1은 대상 시스템을 `packages/core` + 메인 앱 DB로 가정했으나, 코드 실사 결과 실제 수집 엔진은 **`apps/collector/`** 마이크로서비스에 있다. 따라서:

- `subscription_runs`는 존재하지 않음 → 실제 테이블은 `collection_runs` (timescaledb 하이퍼테이블)
- `packages/core/queue`는 분석 파이프라인 전용 (구독/수집 엔진 아님)
- `apps/web`의 `subscriptions` tRPC는 단순 **프록시** — 실제 구현은 collector에 먼저 추가 후 web에 프록시
- BullMQ 큐 구조는 **source별 독립**(`collect-naver-news`, `collect-youtube`, ...), FlowProducer 아님
- jobId 규칙은 이미 `${runId}-${source}`로 고정되어 있음 — 조회/취소 매우 단순
- worker heartbeat는 BullMQ 내장 `queue.getWorkers()`(`idle` ms 반환)로 이미 제공됨

## 1. 배경과 목표

현재 수집 모니터링 페이지는 실행 중 작업 수만 표시할 뿐, 개별 run을 중지하거나 진단할 수단이 없다. stalled 의심 상태가 발생해도 DB를 수동 조작하거나 전체 워커를 재시작해야 하며, 중지 시점의 실패 원인(어느 소스, BullMQ 어느 단계, 외부 API/락/DB 중 무엇)은 휘발성이 높아 사후 복기가 어렵다.

최근 커밋 이력(`lockDuration 5분 확대`, `embedding 배치 분할`, `YouTube 댓글 raw_items 저장`)은 모두 중지 시점 스냅샷이 없어 생긴 역추적 비용의 흔적이다.

이 설계는 **per-source run 중지**, **구독 단위 일괄 중지**, **전체 긴급 정지**를 단계적으로 제공하고, 중지·실패 시점에 **3계층 진단 리포트**를 남겨 원인 파악을 자동화한다. 운영 편의 기능(stalled 자동 감지, 재시도, 소스 일시정지, 큐 적체 가시화)을 함께 제공한다.

## 2. 범위

### 포함

- **Per-source run 중지** (graceful/force) — `(runId, source)` 단위
- **Run 전체 중지** — 같은 runId에 속한 모든 source를 일괄 중지
- **구독 단위 일괄 중지** — 특정 `subscriptionId`의 진행 중 run 전부
- **전체 긴급 정지** — 모든 큐의 모든 active/waiting job
- **3계층 진단 리포트** 자동 생성 (Run / Source / System)
- **Run 재시도** (체인 3회 제한)
- **Stalled run 자동 감지 배너** (10분 이상 업데이트 없음)
- **소스별 일시정지/재개** — 기존 `subscriptions.pause`와 구별되는 전역 소스 제어
- **큐 적체 가시화** — source별 waiting/active/delayed/failed/stalled
- **Run 상세 드릴다운 모달** (RunActionsModal)

### 제외

- 진단 리포트 히스토리 페이지 (후속)
- 실패율 임계치 알림 연동 (후속)
- 별도 감사 로그 테이블 (현 단계는 `run_diagnostics.triggeredBy`로 대체)
- E2E 테스트 (현재 인프라 없음 — 컴포넌트 단위 테스트만)
- `collection_runs` 하이퍼테이블 스키마 변경 (하이퍼테이블 ALTER 제약) — 대신 보완 테이블 추가로 우회

## 3. 아키텍처

```
[apps/web (UI + proxy)]                  [apps/collector (실제 로직)]

subscriptions/monitor                    tRPC
├─ LiveRunFeed                           subscriptions.* (기존)
│   └─ RunRowActions (NEW)               runs.list / runs.get / runs.itemBreakdown (기존)
├─ RunActionsModal (NEW)                 runs.cancel (NEW)
├─ StalledRunsBanner (NEW)               runs.cancelAll (NEW)
├─ QueueStatsBar (NEW)                   runs.cancelBySubscription (NEW)
└─ SourcePauseControls (NEW)             runs.retry (NEW)
                                         runs.diagnose (NEW)
web tRPC (proxy)                         runs.stalled (NEW)
├─ subscriptions.cancelRun (NEW)         queue.status (NEW)
├─ subscriptions.cancelBySubscription    sources.pause (NEW)
├─ subscriptions.cancelAll               sources.resume (NEW)
├─ subscriptions.retry                   sources.list (NEW)
├─ subscriptions.diagnose
├─ subscriptions.stalled                 queue/
├─ subscriptions.queueStatus             ├─ run-control.ts (NEW)
├─ subscriptions.sourceList              │   ├─ cancelRun(runId, source?, mode)
├─ subscriptions.sourcePause             │   └─ retryRun(runId, source)
└─ subscriptions.sourceResume            ├─ diagnostics/ (NEW)
                                         │   ├─ collect-run.ts (Layer A, 동기)
                                         │   ├─ collect-source.ts (Layer B, 비동기)
                                         │   └─ collect-system.ts (Layer C, 비동기)
                                         ├─ source-pause.ts (NEW)
                                         └─ cancellation.ts (NEW — checkCancellation)

                                         [DB — ais_collection @ 192.168.0.5:5435]
                                         run_cancellations (NEW)   ← 하이퍼테이블 우회
                                         run_diagnostics (NEW)
                                         run_retry_links (NEW)
                                         source_pause_state (NEW)
```

### 3.1 의존성 방향

- `apps/web` → `apps/collector`는 HTTP tRPC 프록시. 기존 `getCollectorClient()` 활용.
- `apps/collector` 내부는 자체 완결: `queue/ → db/ → services/`.
- 새 로직은 전부 collector 내부에 추가. web은 thin proxy만.

### 3.2 중지 경로 (per-source)

1. UI의 LiveRunFeed row에서 [중지] 클릭
2. web tRPC `subscriptions.cancelRun({ runId, source, mode })` 호출
3. web이 collector tRPC `runs.cancel`로 프록시
4. collector `cancelRun(runId, source, mode)` 실행
   - `run_cancellations` row 삽입 (PK `(runId, source)`, status='cancelling')
   - BullMQ jobId `${runId}-${source}`로 job 조회
   - graceful: waiting/delayed → `job.remove()`. active는 그대로 (worker가 체크포인트에서 감지)
   - force: active도 `job.moveToFailed(new Error('cancelled'), token, false)`
5. Layer A 진단 동기 수집 → `run_diagnostics` insert (triggeredBy='user_cancel')
6. Layer B/C는 별도 BullMQ 큐 `diagnostics`에 enqueue → 백그라운드 수집 후 동일 row에 UPDATE
7. worker가 다음 체크포인트에서 `checkCancellation(runId, source)` 호출, cancelled면 `CancelledError` throw
8. worker의 `completed`/`failed` 핸들러가 `finalizeCancellationIfDone` 호출 → `collection_runs` 해당 row status를 'failed'로 최종 기록 (errorReason='cancelled'), `run_cancellations.status='cancelled'`로 전이

### 3.3 Run 전체 중지 / 구독 단위 / 전체 긴급 정지

- **Run 전체**: `cancelRun(runId)` (source 생략) → 해당 runId의 모든 source에 대해 per-source 중지 반복
- **구독 단위**: `cancelBySubscription(subscriptionId, mode)` → `collection_runs`에서 status='running'인 모든 `(runId, source)` 조회 후 per-source 중지 반복
- **전체 긴급 정지**: `cancelAll(mode, confirm='CANCEL_ALL')` → 모든 수집 큐에서 active/waiting/delayed job 전수 중지. 확인 문구 하드코드 요구로 오조작 방지

### 3.4 재시도 경로

1. UI → web → collector `runs.retry({ runId, source? })`
2. 원본 job의 `data` payload(이미 BullMQ에 저장됨)를 가져옴 — job이 완전히 제거된 경우에는 `collection_runs` + `keyword_subscriptions`로 재구성 (섹션 5.2 참조)
3. 재시도 체인 깊이 체크 (`run_retry_links` 거슬러 올라가 3 초과면 거부)
4. 새 runId 발급, `enqueueCollectionJob` 재호출
5. `run_retry_links`에 `(originalRunId, newRunId, source)` insert

## 4. 데이터 모델

`collection_runs`는 TimescaleDB 하이퍼테이블이라 ALTER 제약이 있다. 컬럼 추가는 하지 않고 **보완 테이블**을 추가한다.

### 4.1 `run_cancellations` (NEW)

```typescript
export const runCancellations = pgTable(
  'run_cancellations',
  {
    runId: uuid('run_id').notNull(),
    source: text('source').notNull(),
    status: text('status', { enum: ['cancelling', 'cancelled'] }).notNull(),
    mode: text('mode', { enum: ['graceful', 'force'] }).notNull(),
    triggeredBy: text('triggered_by').notNull(), // 'user' | 'auto-stall-timeout' | ...
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.source] }),
    index('run_cancellations_status_idx').on(table.status),
  ],
);
```

용도: cancel 요청의 진실 공급원. worker가 체크포인트에서 `SELECT status FROM run_cancellations WHERE run_id=$1 AND source=$2`로 확인. `collection_runs`의 status는 하이퍼테이블이라 자주 UPDATE하기 비효율 — 종료 시점에만 최종 기록.

### 4.2 `run_diagnostics` (NEW)

```typescript
export const runDiagnostics = pgTable(
  'run_diagnostics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id').notNull(),
    source: text('source'), // null이면 run 전체 대상
    triggeredBy: text('triggered_by', {
      enum: ['user_cancel', 'auto_stall', 'manual', 'failure_hook'],
    }).notNull(),
    layerA: jsonb('layer_a').notNull(),
    layerB: jsonb('layer_b'),
    layerC: jsonb('layer_c'),
    layerAAt: timestamp('layer_a_at', { withTimezone: true }).defaultNow().notNull(),
    layerBAt: timestamp('layer_b_at', { withTimezone: true }),
    layerCAt: timestamp('layer_c_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('run_diagnostics_run_source_idx').on(table.runId, table.source),
    index('run_diagnostics_created_idx').on(table.createdAt),
  ],
);
```

**Layer A 스키마** (동기, ≤500ms 목표)

```typescript
{
  runId: string,
  source: string,
  jobId: string,                      // ${runId}-${source}
  bullState: 'waiting'|'active'|'delayed'|'failed'|'completed'|'stuck'|'unknown',
  attemptsMade: number,
  attemptsMax: number,
  failedReason: string | null,
  jobTimestampMs: number | null,
  processedOnMs: number | null,
  finishedOnMs: number | null,
  partialRawItemsCount: number,       // raw_items COUNT where fetched_from_run=runId
  partialRawItemsByType: { article: number, video: number, comment: number },
  fetchErrorsCount: number,           // fetch_errors COUNT where run_id=runId
  lastFetchError: string | null,
  collectionRunsRow: {                // collection_runs에서 해당 (runId, source) 마지막 row
    status: string,
    itemsCollected: number,
    durationMs: number | null,
    blocked: boolean,
  } | null,
  subscription: {
    id: number,
    keyword: string,
    status: string,
  }
}
```

**Layer B 스키마** (비동기, source 건강도)

```typescript
{
  source: string,
  last24h: {
    total: number,
    completed: number,
    failed: number,
    blocked: number,
    failRate: number                  // 0-1
  },
  consecutiveFailures: number,
  selectorChangeSuspected: boolean,   // fetch_errors의 최근 패턴 분석
  rateLimitHits: number,
  lastSuccessAt: string | null
}
```

**Layer C 스키마** (비동기, 시스템)

```typescript
{
  redis: { ping: 'ok' | 'fail', latencyMs: number },
  db: { ping: 'ok' | 'fail', latencyMs: number },
  queues: Record<string, {
    workerCount: number,
    workers: Array<{ id: string, addr: string, idleMs: number }>,
    counts: { waiting, active, delayed, failed, paused },
    isPaused: boolean,
  }>,
  processMemMB: number
}
```

### 4.3 `run_retry_links` (NEW)

```typescript
export const runRetryLinks = pgTable(
  'run_retry_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    originalRunId: uuid('original_run_id').notNull(),
    newRunId: uuid('new_run_id').notNull(),
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('run_retry_links_original_source_uniq').on(table.originalRunId, table.source),
    index('run_retry_links_new_run_idx').on(table.newRunId),
  ],
);
```

체인 깊이 계산: `newRunId`를 따라가며 `originalRunId → newRunId → newRunId ...` 역방향 조회, 3 초과 시 거부.

### 4.4 `source_pause_state` (NEW)

```typescript
export const sourcePauseState = pgTable('source_pause_state', {
  source: text('source').primaryKey(),
  pausedAt: timestamp('paused_at', { withTimezone: true }).notNull(),
  pausedBy: text('paused_by').notNull(),
  reason: text('reason'),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
});
```

활성 판정: row 존재 AND `resumedAt IS NULL`. 재개 시 row 유지하되 `resumedAt` 설정 (이력 보존). 같은 소스 재-pause 시 UPDATE로 `resumedAt=null, pausedAt=now()`.

### 4.5 `collection_runs` 스키마 변경 없음

하이퍼테이블 ALTER 제약을 피하기 위해 컬럼 추가 없음. 기존 `status: 'running' | 'completed' | 'blocked' | 'failed'`는 그대로 사용. 중지된 run은 `failed` + `errorReason='cancelled'`로 최종 기록한다.

## 5. 핵심 로직

### 5.1 `cancelRun` — `apps/collector/src/queue/run-control.ts`

```typescript
import { getCollectQueue } from './queues';
import { getDb } from '../db';
import { runCancellations } from '../db/schema';
import { collectLayerA } from '../diagnostics/collect-run';
import { getDiagnosticsQueue } from '../diagnostics/queue';

export type CancelMode = 'graceful' | 'force';

export interface CancelResult {
  runId: string;
  source: string;
  mode: CancelMode;
  alreadyCancelled?: boolean;
  alreadyCancelling?: boolean;
  diagnosticId: string;
}

export async function cancelRun(
  runId: string,
  source: string,
  mode: CancelMode,
  triggeredBy: string = 'user',
): Promise<CancelResult> {
  const db = getDb();

  // 1. run_cancellations 업서트. 이미 cancelled면 no-op.
  const existing = await db.query.runCancellations.findFirst({
    where: and(eq(runCancellations.runId, runId), eq(runCancellations.source, source)),
  });
  if (existing?.status === 'cancelled') {
    return { runId, source, mode, alreadyCancelled: true, diagnosticId: '' };
  }
  if (existing?.status === 'cancelling' && mode === 'graceful') {
    // graceful 중복 호출은 no-op. force 승격은 허용.
    return { runId, source, mode, alreadyCancelling: true, diagnosticId: '' };
  }

  await db
    .insert(runCancellations)
    .values({
      runId,
      source,
      status: 'cancelling',
      mode,
      triggeredBy,
    })
    .onConflictDoUpdate({
      target: [runCancellations.runId, runCancellations.source],
      set: { status: 'cancelling', mode, triggeredBy, requestedAt: new Date() },
    });

  // 2. BullMQ 작업 처리
  const queue = getCollectQueue(source as CollectorSource);
  const job = await queue.getJob(`${runId}-${source}`);
  if (job) {
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
    } else if (state === 'active' && mode === 'force') {
      try {
        const token = (job.token ?? '') as string;
        await job.moveToFailed(new Error('cancelled'), token, false);
      } catch (err) {
        // active→failed 전이가 race로 실패할 수 있음. DB 상태만 유지.
        console.warn('[cancelRun] moveToFailed failed', err);
      }
    }
    // graceful + active: 손대지 않음 — worker가 체크포인트에서 감지
  }

  // 3. Layer A 동기 수집
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

  // 4. Layer B/C enqueue (비동기)
  const diagQueue = getDiagnosticsQueue();
  await diagQueue.add('layer-b', { diagnosticId: diag.id, source });
  await diagQueue.add('layer-c', { diagnosticId: diag.id });

  // 5. graceful이면 10분 timeout 승격 delayed job enqueue
  if (mode === 'graceful') {
    await diagQueue.add('escalate-to-force', { runId, source }, { delay: 10 * 60 * 1000 });
  }

  return { runId, source, mode, diagnosticId: diag.id };
}
```

### 5.2 `retryRun`

```typescript
const MAX_RETRY_CHAIN = 3;

export async function retryRun(
  runId: string,
  source: string,
  triggeredBy: string = 'user',
): Promise<{ newRunId: string; reused: boolean }> {
  const db = getDb();

  // 체인 깊이 확인
  const depth = await computeRetryChainDepth(runId);
  if (depth >= MAX_RETRY_CHAIN) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `재시도 체인 ${MAX_RETRY_CHAIN}회 초과`,
    });
  }

  // 이미 재시도된 (runId, source)면 기존 newRunId 반환
  const existing = await db.query.runRetryLinks.findFirst({
    where: and(eq(runRetryLinks.originalRunId, runId), eq(runRetryLinks.source, source)),
  });
  if (existing) {
    return { newRunId: existing.newRunId, reused: true };
  }

  // 원본 payload 복원 (우선순위: BullMQ job → collection_runs + keyword_subscriptions)
  const payload = await restoreJobPayload(runId, source);
  if (!payload) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'run payload 복원 불가' });
  }

  const newRunId = crypto.randomUUID();
  await enqueueCollectionJob({ ...payload, runId: newRunId, triggerType: 'manual' });
  await db.insert(runRetryLinks).values({
    originalRunId: runId,
    newRunId,
    source,
  });

  return { newRunId, reused: false };
}

async function computeRetryChainDepth(runId: string): Promise<number> {
  const db = getDb();
  let depth = 0;
  let current = runId;
  while (depth < MAX_RETRY_CHAIN + 1) {
    const link = await db.query.runRetryLinks.findFirst({
      where: eq(runRetryLinks.newRunId, current),
    });
    if (!link) break;
    current = link.originalRunId;
    depth++;
  }
  return depth;
}

async function restoreJobPayload(runId: string, source: string) {
  const db = getDb();
  const queue = getCollectQueue(source as CollectorSource);
  const job = await queue.getJob(`${runId}-${source}`);
  if (job?.data) return job.data;

  // fallback: collection_runs + keyword_subscriptions
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

  // dateRange는 원본 수집 당시 값을 알 수 없음 → 스케줄 로직 동일 규칙으로 재구성
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
    triggerType: 'manual' as const,
  };
}
```

### 5.3 Worker cancellation 체크포인트

`apps/collector/src/queue/cancellation.ts` 신규:

```typescript
export class CancelledError extends Error {
  constructor(
    public runId: string,
    public source: string,
  ) {
    super(`Run ${runId}/${source} cancelled`);
    this.name = 'CancelledError';
  }
}

export async function checkCancellation(runId: string, source: string): Promise<void> {
  const [row] = await getDb()
    .select()
    .from(runCancellations)
    .where(and(eq(runCancellations.runId, runId), eq(runCancellations.source, source)))
    .limit(1);
  if (row && (row.status === 'cancelling' || row.status === 'cancelled')) {
    throw new CancelledError(runId, source);
  }
}

export async function finalizeCancellationIfDone(runId: string, source: string) {
  await getDb()
    .update(runCancellations)
    .set({ status: 'cancelled', finalizedAt: new Date() })
    .where(
      and(
        eq(runCancellations.runId, runId),
        eq(runCancellations.source, source),
        eq(runCancellations.status, 'cancelling'),
      ),
    );
}
```

`executor.ts` 수정 (요점만, 상세는 구현 계획에서):

1. `collect()` for-await 루프 각 청크 시작 전 `checkCancellation(runId, source)` 호출
2. embedding 배치 루프(`embedPassagesBatched`) 각 배치 전 체크
3. catch 블록에서 `CancelledError` 구분:
   - `collection_runs` insert: status='failed', errorReason='cancelled'
   - BullMQ rethrow 시 attempts 증가하지 않도록 `attempts=1`인 job만 영향 → 기존 `attempts=3` 설정에서 CancelledError는 재시도 억제를 위해 `job.discard()` 호출 후 throw
4. 성공 종료 시에도 `finalizeCancellationIfDone` 호출 — race (cancel이 완료 직전 들어온 경우) 대응

### 5.4 Layer A 수집 — `apps/collector/src/diagnostics/collect-run.ts`

```typescript
export async function collectLayerA(runId: string, source: string): Promise<LayerA> {
  const db = getDb();
  const queue = getCollectQueue(source as CollectorSource);
  const job = await queue.getJob(`${runId}-${source}`);
  const bullState = job ? await job.getState() : 'unknown';

  const [{ count: rawCount }, byType, [fetchErrCount], [lastErr], [runRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(rawItems)
      .where(eq(rawItems.fetchedFromRun, runId))
      .then((r) => r[0]),
    db
      .select({ itemType: rawItems.itemType, count: sql<number>`count(*)::int` })
      .from(rawItems)
      .where(eq(rawItems.fetchedFromRun, runId))
      .groupBy(rawItems.itemType),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(fetchErrors)
      .where(eq(fetchErrors.runId, runId)),
    db
      .select()
      .from(fetchErrors)
      .where(eq(fetchErrors.runId, runId))
      .orderBy(desc(fetchErrors.time))
      .limit(1),
    db
      .select()
      .from(collectionRuns)
      .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)))
      .orderBy(desc(collectionRuns.time))
      .limit(1),
  ]);

  const [sub] = runRow
    ? await db
        .select()
        .from(keywordSubscriptions)
        .where(eq(keywordSubscriptions.id, runRow.subscriptionId))
        .limit(1)
    : [null];

  const byTypeMap = { article: 0, video: 0, comment: 0 };
  for (const r of byType) byTypeMap[r.itemType as keyof typeof byTypeMap] = r.count;

  return {
    runId,
    source,
    jobId: `${runId}-${source}`,
    bullState,
    attemptsMade: job?.attemptsMade ?? 0,
    attemptsMax: job?.opts.attempts ?? 3,
    failedReason: job?.failedReason ?? null,
    jobTimestampMs: job?.timestamp ?? null,
    processedOnMs: job?.processedOn ?? null,
    finishedOnMs: job?.finishedOn ?? null,
    partialRawItemsCount: rawCount ?? 0,
    partialRawItemsByType: byTypeMap,
    fetchErrorsCount: fetchErrCount?.count ?? 0,
    lastFetchError: lastErr?.message ?? null,
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
```

### 5.5 Layer B 수집 — `apps/collector/src/diagnostics/collect-source.ts`

최근 24h `collection_runs` 집계 + `fetch_errors` 패턴 분석. `selectorChangeSuspected`는 최근 10건 실패 사유 중 5건 이상에 `selector|querySelector|null.text|Cannot read` 패턴 매치 시 true.

### 5.6 Layer C 수집 — `apps/collector/src/diagnostics/collect-system.ts`

기존 `worker-health.ts`의 `getWorkerStatus()` 결과를 그대로 활용 + Redis/DB ping + `process.memoryUsage()`. 신규 heartbeat 인프라 **불필요** (BullMQ `queue.getWorkers()` 내장).

참고: `worker-health.ts`는 현재 `['collectors', 'pipeline', 'analysis']` 큐를 조회하는데, collector의 실제 큐명은 `collect-<source>`다. Layer C 구현 시 `getWorkerStatus()`를 직접 쓰지 않고 **collector 전용 `getCollectQueueStatus()`를 신설**한다 (`apps/collector/src/queue/health.ts`).

### 5.7 Stalled 감지

```sql
SELECT run_id, source, time, subscription_id
FROM collection_runs
WHERE status = 'running'
  AND time < NOW() - INTERVAL '10 minutes'
ORDER BY time DESC
LIMIT 50
```

`runs.stalled` tRPC는 이 쿼리 + 해당 `(runId, source)`의 BullMQ 상태를 조인해 반환. UI는 배너에 표시, 자동 중지는 **하지 않음** (false positive 위험).

### 5.8 소스 일시정지

```typescript
// apps/collector/src/queue/source-pause.ts
export async function pauseSource(source: string, reason: string | null, actor: string) {
  await getDb()
    .insert(sourcePauseState)
    .values({
      source,
      pausedAt: new Date(),
      pausedBy: actor,
      reason,
      resumedAt: null,
    })
    .onConflictDoUpdate({
      target: sourcePauseState.source,
      set: { pausedAt: new Date(), pausedBy: actor, reason, resumedAt: null },
    });
  // 기존 active job에는 영향 없음. 신규 enqueue만 차단 (scheduler.ts에서 체크).
}
```

`apps/collector/src/scheduler/scanner.ts`와 `subscriptions.triggerNow` / `subscriptions.backfill`가 enqueue 전 `isSourcePaused(source)` 체크 후 skip. skip 시 log 한 줄.

**기존 `subscriptions.pause`와의 구별**:

- `subscriptions.pause`: 특정 키워드 구독을 일시정지 (해당 구독만 enqueue 안 함)
- `sources.pause`: 전체 시스템에서 특정 소스 수집 일시정지 (모든 구독에 영향)

## 6. tRPC 라우터

### 6.1 collector 측 (apps/collector/src/server/trpc/)

`runs.ts`에 추가:

```typescript
cancel: protectedProcedure
  .input(z.object({
    runId: z.string().uuid(),
    source: z.enum(SOURCE_ENUM).optional(),  // 생략 시 run 전체
    mode: z.enum(['graceful', 'force']).default('graceful'),
  }))
  .mutation(async ({ input }) => { ... }),

cancelBySubscription: protectedProcedure
  .input(z.object({
    subscriptionId: z.number().int().positive(),
    mode: z.enum(['graceful', 'force']).default('graceful'),
  }))
  .mutation(async ({ input }) => { ... }),

cancelAll: protectedProcedure
  .input(z.object({
    mode: z.enum(['graceful', 'force']).default('graceful'),
    confirm: z.literal('CANCEL_ALL'),
  }))
  .mutation(async ({ input }) => { ... }),

retry: protectedProcedure
  .input(z.object({
    runId: z.string().uuid(),
    source: z.enum(SOURCE_ENUM),
  }))
  .mutation(async ({ input }) => { ... }),

diagnose: protectedProcedure
  .input(z.object({
    runId: z.string().uuid(),
    source: z.enum(SOURCE_ENUM).optional(),
  }))
  .query(async ({ input }) => { ... }),  // 최신 diagnostics row 반환

stalled: protectedProcedure
  .input(z.object({ staleMinutes: z.number().int().min(1).max(120).default(10) }))
  .query(async ({ input }) => { ... }),
```

신규 라우터:

```typescript
// apps/collector/src/server/trpc/queue.ts
export const queueRouter = router({
  status: protectedProcedure.query(async () => {
    // getCollectQueueStatus() 반환
  }),
});

// apps/collector/src/server/trpc/sources.ts
export const sourcesRouter = router({
  pause: protectedProcedure.input(...).mutation(...),
  resume: protectedProcedure.input(...).mutation(...),
  list: protectedProcedure.query(...),
});
```

`router.ts`에 `queue`, `sources` 추가.

### 6.2 web 측 (프록시)

`apps/web/src/server/trpc/routers/subscriptions.ts`에 collector의 신규 엔드포인트를 1:1 프록시하는 mutation/query 추가. 입력/출력 타입은 web 경계에서 명시 interface로 다시 선언 (기존 파일 스타일 유지, TS2742 방지).

## 7. UI 설계

### 7.1 `LiveRunFeed` — `RunRowActions` 삽입

각 row는 이미 `(runId, source, status)`를 가짐. 우측에 액션:

- `running` → [중지 ▾] (드롭다운: graceful/force)
- `cancelling` (run_cancellations에서 조회) → 스피너 "중지 중..." + [강제 중지]
- `failed` (errorReason='cancelled') → [재시도]
- `failed`/`blocked` (그 외) → [재시도] [진단]
- `completed` → (액션 없음, 상세 링크)

### 7.2 `RunActionsModal`

탭 3개(진단/중지/재시도). 상단에 run 메타(keyword, source, 시작 시각, 경과 시간, 상태 뱃지, jobId).

**진단 탭**: Layer A 즉시 표시, B/C 스켈레톤 → 5s polling으로 자동 채움. 각 Layer에 [다시 시도] 버튼 (수집 실패 시).

**중지 탭**: graceful 설명 + [중지]. [강제 중지] 체크박스 → 경고 문구 + destructive 버튼.

**재시도 탭**: 원본 파라미터 미리보기, 체인 깊이, 3회 초과 시 버튼 비활성화.

### 7.3 `StalledRunsBanner`

페이지 최상단. 건수>0일 때만 표시. [모두 보기] [모두 중지 (force)]. "모두 중지"는 `CANCEL_ALL` 문구 타이핑 불필요, 대신 "N건을 강제 중지합니다" 확인 모달.

### 7.4 `QueueStatsBar`

기존 헤더 확장:

```
● 시스템 정상 | 실행 중 3  완료(1h) 42  실패(1h) 2 | 큐: (각 source별) naver-news w1/a1 · youtube w0/a0 ⚠ · dcinside w2/a1 · ...
```

클릭 → 큐 상세 모달 (source별 분해 + 최근 failed 10건).

### 7.5 `SourcePauseControls`

모니터 페이지 하단 카드 "소스 제어". 소스별 [일시정지]/[재개]. 사유는 선택 입력. 구독 일시정지(기존)와 **구별되는 시스템 전역 스위치**라는 안내 문구 표시.

### 7.6 전체 긴급 정지 / 구독 단위 중지

- **전체 긴급 정지**: 모니터 페이지 우상단 `⋯` kebab → [전체 긴급 정지]. 모달에서 `CANCEL_ALL` 문자열 타이핑 필수.
- **구독 단위 중지**: `apps/web/src/app/subscriptions/[id]/page.tsx`의 실행 이력 헤더에 [이 구독의 진행 중 중지] 버튼.

### 7.7 컴포넌트 재사용

- `RunRowActions`: `LiveRunFeed`, `run-history-table`, 구독 상세 페이지에서 공용
- `RunActionsModal`: Zustand 전역 state — 어느 위치에서든 `openRunActions(runId, source, tab)`

### 7.8 폴링 전략

- runs 목록: 5s (기존 유지)
- 진단 row: 모달 열려있고 B/C 미완성일 때만 5s
- stalled: 30s
- queue counts: 10s
- source states: 30s

## 8. 에러 처리

- **Idempotent cancel**: status 전이는 단방향(running→cancelling→cancelled), 중복 호출은 no-op 반환
- **Idempotent retry**: `run_retry_links` unique index로 중복 차단, 기존 newRunId 재사용
- **Race**: worker 완료 직전 cancel — worker `finalizeCancellationIfDone`의 WHERE 절 `status='cancelling'`이 race 흡수, 두 번째 UPDATE는 0 row
- **Force failure**: `moveToFailed` 실패 → catch 후 DB만 유지, 10분 timeout 승격에 맡김
- **일시정지 경합**: active run은 영향 없음, 신규 enqueue만 차단
- **Layer B/C 실패**: Layer A는 이미 저장, UI는 부분 리포트 + [다시 시도]
- **10분 timeout 승격**: delayed `escalate-to-force` job이 실행 시 run 상태 재확인 → 여전히 `cancelling`이면 force cancelRun 재호출. 이미 `cancelled`면 no-op
- **하이퍼테이블 제약**: `collection_runs`는 UPDATE 비용이 크므로 per-chunk UPDATE 금지 — 시작/종료 시에만 INSERT/UPDATE

## 9. 테스트 (Vitest, apps/collector 기존 `vitest.config.ts` 활용)

### 9.1 단위 테스트

- `queue/run-control.test.ts`
  - graceful/force per-source 중지 분기
  - idempotent 중복 호출
  - force 승격 (graceful → force)
  - retryRun 체인 3회 제한
  - restoreJobPayload 폴백 경로 (BullMQ 제거됨 시)
- `queue/cancellation.test.ts`
  - checkCancellation이 CancelledError throw
  - finalizeCancellationIfDone race 흡수
- `diagnostics/collect-run.test.ts` — Layer A 모든 필드 채움
- `diagnostics/collect-source.test.ts` — failRate, selectorChangeSuspected, rateLimitHits
- `diagnostics/collect-system.test.ts` — Redis/DB ping 성공/실패, queue counts
- `queue/source-pause.test.ts` — pause 시 enqueue skip, active 보존

### 9.2 통합 테스트

- tRPC `runs.cancel` → DB + BullMQ 반영 (test Redis 필수)
- tRPC `runs.retry` → 새 job enqueue 확인
- tRPC `sources.pause` → scheduler skip

### 9.3 UI 테스트

- `RunRowActions` 상태별 렌더
- `RunActionsModal` 탭 전환, polling
- `StalledRunsBanner` 건수별 표시/숨김

## 10. 보안·운영

- collector tRPC는 기존 `protectedProcedure` 미들웨어 유지 (`apps/collector/src/server/trpc/init.ts` 참조)
- web tRPC 프록시는 기존 `protectedProcedure` + `ctx.userId` 주입 유지
- 파괴적 액션(force cancel, 전체 긴급 정지, 소스 일시정지)은 UI 확인 모달
- Rate limit: `(runId, source)` 기준 cancel/retry 5초 디바운스 (in-memory Map, 단일 인스턴스 가정)
- 진단 리포트의 `failedReason`/`fetch_errors.message`는 외부 API 응답 본문을 포함할 수 있음 → 저장 시 4KB 길이 제한 + 토큰/키 패턴 마스킹 룰(`[A-Za-z0-9]{32,}` → `[REDACTED]`)

## 11. 롤아웃

1. **DB 마이그레이션** — `apps/collector`의 drizzle로 4개 신규 테이블 추가 (`pnpm -C apps/collector drizzle-kit push`)
2. **collector 배포**
   - 신규 테이블 + run-control + cancellation + source-pause + diagnostics
   - worker의 checkCancellation 체크포인트 포함
   - scheduler의 isSourcePaused 체크 포함
3. **web tRPC 프록시 배포**
4. **web UI 배포**

worker 배포 지연 시: UI cancel은 동작 (DB만 변함), active job은 10분 timeout force 승격으로 복구.

환경 분리: collector는 `DATABASE_URL`/`REDIS_URL` 별도 지정 (`.env`), 기존 패턴 준수. 신규 diagnostics 큐(`diagnostics`)는 `getBullMQOptions()` 사용해 prefix 자동 분리.

## 12. 구현 계획 단계 첫 태스크 (선조사 반영됨)

v1의 "열린 질문"은 코드 실사로 전부 해소되었다. 남은 검증 포인트는 구현 계획 첫 태스크로 다룬다:

1. **`job.token` 접근 가능 여부** — BullMQ 5.x에서 `job.moveToFailed`의 token 인자가 필수인데, worker 외부에서 job 조회 시 token을 얻는 경로 확인. BullMQ는 원래 worker processor 내부에서만 token을 노출 — 외부 force cancel은 `job.discard()` + `job.moveToFailed(err, '0', false)` 패턴이나, 실패 시 직접 Redis key 조작(hset + emit 'failed')로 fallback 필요할 수 있음. 첫 태스크에서 작은 실증 스크립트로 확인.
2. **하이퍼테이블 `fetch_errors` / `raw_items` 쿼리 비용** — `runId` 필터가 인덱스를 타는지 EXPLAIN 확인. 안 타면 `fetched_from_run`에 인덱스 추가 필요.
3. **`subscriptions.cancelRun` → collector `runs.cancel` 프록시의 타임아웃** — collector가 Layer A 동기 수집 후 응답 — HTTP 타임아웃 범위 확인. 초과 시 Layer A도 비동기 전환 검토.

위 3개는 구현 첫 태스크로 검증한 뒤 필요 시 본 설계의 세부만 조정한다. 외형(UI, 데이터 모델, tRPC 계약, 롤아웃 순서)은 유효하다.
