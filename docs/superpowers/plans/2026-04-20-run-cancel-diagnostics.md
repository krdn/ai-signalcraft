# Run 중지·진단·재시도 및 운영 제어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수집 모니터링 페이지에 per-source run 중지, 구독/전체 일괄 중지, 3계층 진단 리포트, 재시도, stalled 감지, 소스 일시정지, 큐 적체 가시화를 추가한다.

**Architecture:** 실제 수집 엔진은 `apps/collector/` 마이크로서비스에 있다. 새 로직은 전부 collector 내부에 추가하고 `apps/web`은 thin proxy + UI만 담당한다. 4개 신규 테이블(`run_cancellations`, `run_diagnostics`, `run_retry_links`, `source_pause_state`)을 추가하며, `collection_runs`(TimescaleDB 하이퍼테이블)는 스키마 변경 없이 사용한다.

**Tech Stack:** TypeScript, Drizzle ORM, BullMQ 5, TimescaleDB, tRPC 11, Next.js 15, React 19, shadcn/ui, TanStack Query 5, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-04-20-run-cancel-diagnostics-design.md`

---

## File Structure

### apps/collector (신규)

```
apps/collector/src/
├─ db/schema/
│   ├─ cancellations.ts          (NEW) — run_cancellations
│   ├─ diagnostics.ts            (NEW) — run_diagnostics
│   ├─ retries.ts                (NEW) — run_retry_links
│   ├─ source-pause.ts           (NEW) — source_pause_state
│   └─ index.ts                  (MODIFY) — export *
├─ queue/
│   ├─ cancellation.ts           (NEW) — CancelledError + checkCancellation + finalizeCancellationIfDone
│   ├─ run-control.ts            (NEW) — cancelRun / retryRun / cancelBySubscription / cancelAll
│   ├─ source-pause.ts           (NEW) — pauseSource / resumeSource / isSourcePaused / listSourceStates
│   ├─ health.ts                 (NEW) — getCollectQueueStatus (Layer C용)
│   ├─ queues.ts                 (MODIFY) — source-pause 체크 후 enqueue skip
│   └─ executor.ts               (MODIFY) — checkCancellation 체크포인트 삽입
├─ diagnostics/
│   ├─ queue.ts                  (NEW) — getDiagnosticsQueue
│   ├─ collect-run.ts            (NEW) — Layer A (동기)
│   ├─ collect-source.ts         (NEW) — Layer B (비동기)
│   ├─ collect-system.ts         (NEW) — Layer C (비동기)
│   ├─ worker.ts                 (NEW) — diagnostics BullMQ worker
│   └─ masking.ts                (NEW) — 토큰/키 패턴 마스킹 + 길이 제한
├─ scheduler/
│   └─ scanner.ts                (MODIFY) — enqueue 전 isSourcePaused 체크
├─ server/trpc/
│   ├─ runs.ts                   (MODIFY) — cancel / cancelBySubscription / cancelAll / retry / diagnose / stalled
│   ├─ queue.ts                  (NEW) — queue.status
│   ├─ sources.ts                (NEW) — sources.pause/resume/list
│   └─ router.ts                 (MODIFY) — queue/sources 라우터 추가
└─ __tests__ (Vitest 파일들은 각 모듈 옆 .test.ts)
```

### apps/web (프록시 + UI)

```
apps/web/src/
├─ server/trpc/routers/subscriptions.ts    (MODIFY) — 8개 신규 procedure 프록시
├─ app/subscriptions/monitor/page.tsx      (MODIFY) — StalledRunsBanner, QueueStatsBar, SourcePauseControls, 긴급정지 kebab 통합
├─ app/subscriptions/[id]/page.tsx         (MODIFY) — [이 구독의 진행 중 중지] 버튼
├─ components/subscriptions/
│   ├─ run-row-actions.tsx                 (NEW) — 상태별 액션 버튼 그룹
│   ├─ run-actions-modal.tsx               (NEW) — 진단/중지/재시도 탭
│   ├─ stalled-runs-banner.tsx             (NEW)
│   ├─ queue-stats-bar.tsx                 (NEW)
│   ├─ source-pause-controls.tsx           (NEW)
│   ├─ cancel-all-dialog.tsx               (NEW) — CANCEL_ALL 타이핑 확인 모달
│   └─ live-run-feed.tsx                   (MODIFY) — RunRowActions 삽입
└─ stores/
    └─ run-actions-modal-store.ts          (NEW) — Zustand 전역 모달 상태
```

---

## Task 0: 환경 검증 및 선조사 (첫 태스크)

**목적:** 스펙 섹션 12의 남은 3개 검증 포인트를 실증으로 확인. 결과에 따라 후속 태스크 세부 조정.

**Files:**

- Create: `apps/collector/scripts/verify-bullmq-cancel.ts`
- Create: `apps/collector/scripts/verify-query-indexes.sql`

### Step 0.1: BullMQ 외부 force cancel 검증 스크립트 작성

- [ ] **작성:** `apps/collector/scripts/verify-bullmq-cancel.ts`

```typescript
import 'dotenv/config';
import { Queue, Worker } from 'bullmq';
import { getBullMQOptions } from '../src/queue/connection';

/**
 * Worker 외부에서 active job을 force failed로 보낼 수 있는지 검증.
 * BullMQ 5.x의 moveToFailed는 worker processor 내부에서만 token을 노출하므로
 * 외부 호출 시 대안 경로 확인이 목적.
 */
async function main() {
  const queue = new Queue('verify-cancel', getBullMQOptions());
  const worker = new Worker(
    'verify-cancel',
    async (job) => {
      // 10초 sleep — 중간에 외부에서 cancel 시도
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        console.warn(`[worker] tick ${i}`);
      }
      return { ok: true };
    },
    getBullMQOptions(),
  );

  const job = await queue.add('test', { runId: 'verify' }, { jobId: 'verify-job-1' });
  await new Promise((r) => setTimeout(r, 2000)); // active 진입 대기

  const fetched = await queue.getJob('verify-job-1');
  if (!fetched) throw new Error('job not found');
  const state = await fetched.getState();
  console.warn('[verify] state before cancel:', state);

  // 시도 A: discard + moveToFailed with empty token
  try {
    await fetched.discard();
    // @ts-expect-error — token 인자 확인용
    await fetched.moveToFailed(new Error('external-cancel'), '0', false);
    console.warn('[verify] external moveToFailed SUCCESS');
  } catch (err) {
    console.warn('[verify] external moveToFailed FAILED:', (err as Error).message);
    // 시도 B: remove
    try {
      await fetched.remove();
      console.warn('[verify] fallback remove SUCCESS');
    } catch (err2) {
      console.warn('[verify] remove FAILED:', (err2 as Error).message);
    }
  }

  await new Promise((r) => setTimeout(r, 12000)); // worker 자연 종료 대기
  await worker.close();
  await queue.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **실행:** `pnpm -C apps/collector tsx scripts/verify-bullmq-cancel.ts`
- [ ] **기대 결과:** 로그를 관찰해 외부 `moveToFailed` 성공/실패, 성공 시 worker가 중단되는지, 실패 시 `remove` 폴백이 되는지 기록.
- [ ] **결과 반영:** `cancelForce`의 구현 전략 확정. 외부 `moveToFailed` 성공 시 스펙 그대로, 실패 시 `remove` + DB status 전이만으로 처리하고 worker는 체크포인트로 자연 종료.

### Step 0.2: 하이퍼테이블 쿼리 인덱스 확인

- [ ] **작성:** `apps/collector/scripts/verify-query-indexes.sql`

```sql
-- Layer A에서 쓰는 쿼리들이 인덱스를 타는지 확인
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM raw_items WHERE fetched_from_run = '00000000-0000-0000-0000-000000000000';

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM collection_runs
WHERE run_id = '00000000-0000-0000-0000-000000000000' AND source = 'naver-news'
ORDER BY time DESC LIMIT 1;

EXPLAIN (ANALYZE, BUFFERS)
SELECT run_id, source, time, subscription_id FROM collection_runs
WHERE status = 'running' AND time < NOW() - INTERVAL '10 minutes'
ORDER BY time DESC LIMIT 50;
```

- [ ] **실행:** `psql postgresql://collector:collector@192.168.0.5:5435/ais_collection -f apps/collector/scripts/verify-query-indexes.sql`
- [ ] **기대 결과:** `raw_items`의 `fetched_from_run` 인덱스 존재 확인. 없으면 Task 1.1에서 인덱스 추가 migration 포함.
- [ ] **결과 반영:** 필요 시 Task 1.1 스키마에 `index('raw_items_fetched_from_run_idx').on(rawItems.fetchedFromRun)` 추가.

### Step 0.3: web → collector HTTP 타임아웃 확인

- [ ] **확인:** `packages/core/src/collector-client/index.ts`에서 fetch 타임아웃 설정 값 검색. 기본 30s 이상이면 Layer A 동기 수집(500ms 목표)에 여유 있음.
- [ ] **결과 반영:** 타임아웃이 5s 이하면 Layer A를 비동기화해 diagnosticId만 즉시 반환하고 UI가 polling하는 방식으로 변경 (Task 5 스펙 조정).

### Step 0.4: Task 0 결과 커밋

- [ ] **커밋:**

```bash
git add apps/collector/scripts/
git commit -m "$(cat <<'EOF'
chore(collector): run 중지·진단 선조사 스크립트 추가

BullMQ 외부 force cancel 가능 여부, 하이퍼테이블 쿼리 인덱스,
web→collector HTTP 타임아웃을 실증 확인.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: DB 스키마 신규 4개 테이블

**Files:**

- Create: `apps/collector/src/db/schema/cancellations.ts`
- Create: `apps/collector/src/db/schema/diagnostics.ts`
- Create: `apps/collector/src/db/schema/retries.ts`
- Create: `apps/collector/src/db/schema/source-pause.ts`
- Modify: `apps/collector/src/db/schema/index.ts`

### Step 1.1: `run_cancellations` 스키마 작성

- [ ] **작성:** `apps/collector/src/db/schema/cancellations.ts`

```typescript
import { pgTable, text, timestamp, uuid, index, primaryKey } from 'drizzle-orm/pg-core';

/**
 * run_cancellations — per-(runId, source) 중지 요청 상태.
 * collection_runs(하이퍼테이블) UPDATE 비용을 피하기 위한 보완 테이블.
 * worker 체크포인트는 이 테이블의 status를 읽어 진행을 중단한다.
 */
export const runCancellations = pgTable(
  'run_cancellations',
  {
    runId: uuid('run_id').notNull(),
    source: text('source').notNull(),
    status: text('status', { enum: ['cancelling', 'cancelled'] }).notNull(),
    mode: text('mode', { enum: ['graceful', 'force'] }).notNull(),
    triggeredBy: text('triggered_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.source] }),
    index('run_cancellations_status_idx').on(table.status),
  ],
);

export type RunCancellation = typeof runCancellations.$inferSelect;
export type NewRunCancellation = typeof runCancellations.$inferInsert;
```

### Step 1.2: `run_diagnostics` 스키마 작성

- [ ] **작성:** `apps/collector/src/db/schema/diagnostics.ts`

```typescript
import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';

export type LayerAPayload = {
  runId: string;
  source: string;
  jobId: string;
  bullState: string;
  attemptsMade: number;
  attemptsMax: number;
  failedReason: string | null;
  jobTimestampMs: number | null;
  processedOnMs: number | null;
  finishedOnMs: number | null;
  partialRawItemsCount: number;
  partialRawItemsByType: { article: number; video: number; comment: number };
  fetchErrorsCount: number;
  lastFetchError: string | null;
  collectionRunsRow: {
    status: string;
    itemsCollected: number;
    durationMs: number | null;
    blocked: boolean;
  } | null;
  subscription: { id: number; keyword: string; status: string } | null;
};

export type LayerBPayload = {
  source: string;
  last24h: { total: number; completed: number; failed: number; blocked: number; failRate: number };
  consecutiveFailures: number;
  selectorChangeSuspected: boolean;
  rateLimitHits: number;
  lastSuccessAt: string | null;
};

export type LayerCPayload = {
  redis: { ping: 'ok' | 'fail'; latencyMs: number };
  db: { ping: 'ok' | 'fail'; latencyMs: number };
  queues: Record<
    string,
    {
      workerCount: number;
      workers: Array<{ id: string; addr: string; idleMs: number }>;
      counts: { waiting: number; active: number; delayed: number; failed: number; paused: number };
      isPaused: boolean;
    }
  >;
  processMemMB: number;
};

export const runDiagnostics = pgTable(
  'run_diagnostics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id').notNull(),
    source: text('source'),
    triggeredBy: text('triggered_by', {
      enum: ['user_cancel', 'auto_stall', 'manual', 'failure_hook'],
    }).notNull(),
    layerA: jsonb('layer_a').$type<LayerAPayload>().notNull(),
    layerB: jsonb('layer_b').$type<LayerBPayload>(),
    layerC: jsonb('layer_c').$type<LayerCPayload>(),
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

export type RunDiagnostic = typeof runDiagnostics.$inferSelect;
export type NewRunDiagnostic = typeof runDiagnostics.$inferInsert;
```

### Step 1.3: `run_retry_links` 스키마 작성

- [ ] **작성:** `apps/collector/src/db/schema/retries.ts`

```typescript
import { pgTable, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';

/**
 * run_retry_links — 재시도 체인 추적. (originalRunId, source) → newRunId.
 * 체인 깊이는 newRunId로 역추적(같은 source의 originalRunId를 따라감).
 */
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
    index('run_retry_links_new_run_idx').on(table.newRunId, table.source),
  ],
);

export type RunRetryLink = typeof runRetryLinks.$inferSelect;
```

### Step 1.4: `source_pause_state` 스키마 작성

- [ ] **작성:** `apps/collector/src/db/schema/source-pause.ts`

```typescript
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * source_pause_state — 시스템 전역 소스 일시정지. subscriptions.pause와 별개.
 * row 존재 AND resumedAt IS NULL이면 paused 상태. 재개 후에도 row 유지(이력).
 */
export const sourcePauseState = pgTable('source_pause_state', {
  source: text('source').primaryKey(),
  pausedAt: timestamp('paused_at', { withTimezone: true }).notNull(),
  pausedBy: text('paused_by').notNull(),
  reason: text('reason'),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
});

export type SourcePauseRow = typeof sourcePauseState.$inferSelect;
```

### Step 1.5: `index.ts` 업데이트

- [ ] **편집:** `apps/collector/src/db/schema/index.ts`

```typescript
export * from './subscriptions';
export * from './runs';
export * from './items';
export * from './errors';
export * from './cancellations';
export * from './diagnostics';
export * from './retries';
export * from './source-pause';
```

### Step 1.6: 마이그레이션 push

- [ ] **실행:** `pnpm -C apps/collector drizzle-kit push`
- [ ] **확인:** 출력에서 4개 신규 테이블이 생성되었는지. 오류 시 중단하고 사용자 보고.
- [ ] **실행 (검증):** `psql postgresql://collector:collector@192.168.0.5:5435/ais_collection -c "\dt run_cancellations run_diagnostics run_retry_links source_pause_state"`
- [ ] **기대 출력:** 4개 테이블 모두 리스트에 나타남.

### Step 1.7: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/db/schema/
git commit -m "$(cat <<'EOF'
feat(collector): run 중지·진단용 4개 신규 스키마 추가

run_cancellations, run_diagnostics, run_retry_links, source_pause_state
하이퍼테이블인 collection_runs 스키마는 변경하지 않고 보완 테이블로 분리.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 마스킹 유틸리티 (진단 저장 전처리)

**Files:**

- Create: `apps/collector/src/diagnostics/masking.ts`
- Test: `apps/collector/src/diagnostics/masking.test.ts`

### Step 2.1: 실패 테스트 작성

- [ ] **작성:** `apps/collector/src/diagnostics/masking.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { maskSensitive, truncate } from './masking';

describe('maskSensitive', () => {
  it('32자 이상 영숫자 시퀀스를 [REDACTED]로 치환', () => {
    const input = 'api key is AKIAIOSFODNN7EXAMPLEabcdefghij1234567890';
    expect(maskSensitive(input)).toBe('api key is [REDACTED]');
  });

  it('짧은 토큰은 건드리지 않는다', () => {
    expect(maskSensitive('short abc123 ok')).toBe('short abc123 ok');
  });

  it('여러 시퀀스 모두 치환', () => {
    const input = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA then BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    expect(maskSensitive(input)).toBe('[REDACTED] then [REDACTED]');
  });

  it('null은 null 반환', () => {
    expect(maskSensitive(null)).toBeNull();
  });
});

describe('truncate', () => {
  it('4096자 초과 시 꼬리를 ... 으로 대체', () => {
    const long = 'x'.repeat(5000);
    const out = truncate(long, 4096);
    expect(out.length).toBe(4096);
    expect(out.endsWith('...')).toBe(true);
  });

  it('짧으면 그대로', () => {
    expect(truncate('short', 4096)).toBe('short');
  });
});
```

### Step 2.2: 테스트 실행 — 실패 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/diagnostics/masking.test.ts`
- [ ] **기대:** `Cannot find module './masking'` 류 실패.

### Step 2.3: 구현

- [ ] **작성:** `apps/collector/src/diagnostics/masking.ts`

```typescript
const TOKEN_RE = /[A-Za-z0-9]{32,}/g;

export function maskSensitive(input: string | null): string | null {
  if (input === null) return null;
  return input.replace(TOKEN_RE, '[REDACTED]');
}

export function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, maxLen - 3) + '...';
}

export function sanitizeError(input: string | null, maxLen = 4096): string | null {
  if (input === null) return null;
  return truncate(maskSensitive(input) ?? '', maxLen);
}
```

### Step 2.4: 테스트 통과 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/diagnostics/masking.test.ts`
- [ ] **기대:** 4개 테스트 PASS.

### Step 2.5: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/diagnostics/masking.ts apps/collector/src/diagnostics/masking.test.ts
git commit -m "$(cat <<'EOF'
feat(collector): 진단 리포트 토큰 마스킹 유틸 추가

32+자 영숫자 시퀀스를 [REDACTED]로 치환, 4KB 길이 제한.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Cancellation 체크포인트 모듈

**Files:**

- Create: `apps/collector/src/queue/cancellation.ts`
- Test: `apps/collector/src/queue/cancellation.test.ts`

### Step 3.1: 실패 테스트 작성

- [ ] **작성:** `apps/collector/src/queue/cancellation.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { runCancellations } from '../db/schema';
import { checkCancellation, finalizeCancellationIfDone, CancelledError } from './cancellation';

const RUN_ID = '11111111-1111-1111-1111-111111111111';
const SOURCE = 'naver-news';

async function clearRow() {
  await getDb()
    .delete(runCancellations)
    .where(and(eq(runCancellations.runId, RUN_ID), eq(runCancellations.source, SOURCE)));
}

describe('checkCancellation', () => {
  beforeEach(clearRow);
  afterEach(clearRow);

  it('row가 없으면 throw하지 않는다', async () => {
    await expect(checkCancellation(RUN_ID, SOURCE)).resolves.toBeUndefined();
  });

  it('status=cancelling이면 CancelledError throw', async () => {
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelling',
      mode: 'graceful',
      triggeredBy: 'test',
    });
    await expect(checkCancellation(RUN_ID, SOURCE)).rejects.toThrow(CancelledError);
  });

  it('status=cancelled여도 CancelledError throw', async () => {
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelled',
      mode: 'graceful',
      triggeredBy: 'test',
    });
    await expect(checkCancellation(RUN_ID, SOURCE)).rejects.toThrow(CancelledError);
  });
});

describe('finalizeCancellationIfDone', () => {
  beforeEach(clearRow);
  afterEach(clearRow);

  it('cancelling → cancelled로 전이', async () => {
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelling',
      mode: 'graceful',
      triggeredBy: 'test',
    });
    await finalizeCancellationIfDone(RUN_ID, SOURCE);
    const [row] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, RUN_ID), eq(runCancellations.source, SOURCE)));
    expect(row.status).toBe('cancelled');
    expect(row.finalizedAt).not.toBeNull();
  });

  it('이미 cancelled이면 no-op (finalizedAt 유지)', async () => {
    const t0 = new Date(Date.now() - 60_000);
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelled',
      mode: 'graceful',
      triggeredBy: 'test',
      finalizedAt: t0,
    });
    await finalizeCancellationIfDone(RUN_ID, SOURCE);
    const [row] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, RUN_ID), eq(runCancellations.source, SOURCE)));
    expect(row.finalizedAt?.getTime()).toBe(t0.getTime());
  });

  it('row 없으면 no-op', async () => {
    await expect(finalizeCancellationIfDone(RUN_ID, SOURCE)).resolves.toBeUndefined();
  });
});
```

### Step 3.2: 테스트 실행 — 실패 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/queue/cancellation.test.ts`
- [ ] **기대:** 모듈 없음으로 실패.

### Step 3.3: 구현

- [ ] **작성:** `apps/collector/src/queue/cancellation.ts`

```typescript
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { runCancellations } from '../db/schema';

export class CancelledError extends Error {
  constructor(
    public readonly runId: string,
    public readonly source: string,
  ) {
    super(`Run ${runId}/${source} cancelled`);
    this.name = 'CancelledError';
  }
}

/**
 * worker의 단계/배치 시작부에서 호출. cancelling/cancelled이면 CancelledError throw.
 */
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

/**
 * job 종료 시 호출. cancelling이면 cancelled로 최종 전이.
 * 멱등: 이미 cancelled면 0 row affected로 no-op.
 */
export async function finalizeCancellationIfDone(runId: string, source: string): Promise<void> {
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

### Step 3.4: 테스트 통과 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/queue/cancellation.test.ts`
- [ ] **기대:** 6개 테스트 PASS.

### Step 3.5: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/queue/cancellation.ts apps/collector/src/queue/cancellation.test.ts
git commit -m "$(cat <<'EOF'
feat(collector): cancellation 체크포인트 모듈 추가

CancelledError, checkCancellation, finalizeCancellationIfDone을
run_cancellations 테이블 기반으로 구현.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Executor에 체크포인트 삽입

**Files:**

- Modify: `apps/collector/src/queue/executor.ts`
- Test: 기존 executor 동작에 영향이 없어야 하므로 통합은 Task 7에서 검증

### Step 4.1: `executor.ts`의 주요 수집 루프 직전에 체크 삽입

- [ ] **편집:** `apps/collector/src/queue/executor.ts`의 `executeCollectionJob` — `for await (const chunk of iter)` 루프 **진입 전**과 루프 **각 iteration 시작**에 체크 삽입.

기존 코드(116번째 줄 근방):

```typescript
    for await (const chunk of iter) {
      if (!Array.isArray(chunk) || chunk.length === 0) continue;
```

수정 후:

```typescript
    await checkCancellation(runId, source);  // 수집 시작 전 체크

    for await (const chunk of iter) {
      await checkCancellation(runId, source);  // 각 청크 시작 전 체크
      if (!Array.isArray(chunk) || chunk.length === 0) continue;
```

- [ ] **import 추가** (파일 상단):

```typescript
import { CancelledError, checkCancellation, finalizeCancellationIfDone } from './cancellation';
```

### Step 4.2: embedding 배치 루프에 체크 삽입

- [ ] **편집:** 같은 파일의 `embedPassagesBatched` 내부 — 각 batch 시작 전에 `await checkCancellation(runId, source)` 삽입. 단 이 함수는 현재 runId/source를 인자로 받지 않으므로 시그니처 확장 필요.

```typescript
async function embedPassagesBatched(
  texts: string[],
  runId: string,
  source: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    await checkCancellation(runId, source);
    const slice = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedPassages(slice);
    for (let j = 0; j < slice.length; j++) {
      out[i + j] = vectors[j] ?? [];
    }
  }
  return out;
}
```

- [ ] **호출부 수정:** `executeCollectionJob`과 `executeCommentsJob`에서 `embedPassagesBatched(texts)` → `embedPassagesBatched(texts, runId, source)`.

### Step 4.3: CancelledError 처리 분기 추가

- [ ] **편집:** `executeCollectionJob`의 catch 블록.

기존 흐름 (fetchErrors/collection_runs에 failed 기록)을 확장:

```typescript
  } catch (err) {
    const cancelled = err instanceof CancelledError;
    // collection_runs: status='failed', errorReason='cancelled' | 원래 메시지
    await db.update(collectionRuns).set({
      status: 'failed',
      errorReason: cancelled ? 'cancelled' : String(err instanceof Error ? err.message : err),
      durationMs: Date.now() - startedAt,
    }).where(and(
      eq(collectionRuns.runId, runId),
      eq(collectionRuns.source, source),
      eq(collectionRuns.status, 'running'),
    ));

    if (cancelled) {
      await finalizeCancellationIfDone(runId, source);
      // BullMQ 재시도 방지를 위해 current attempt를 max로 강제
      if (typeof (job as Job).discard === 'function') {
        await (job as Job).discard();
      }
      // throw하되, attempts가 소진된 상태처럼 처리
      throw err;
    }

    // 기존 비-cancelled 에러 처리 경로 그대로
    await db.insert(fetchErrors).values({
      time: new Date(),
      subscriptionId,
      source,
      errorType: classifyError(err),
      errorMessage: err instanceof Error ? err.message : String(err),
    }).catch(() => void 0);

    throw err;
  }
```

주의: 기존 `executor.ts`의 catch 구조를 정확히 파악한 뒤 위 스니펫을 해당 위치에 병합할 것. 기존 코드를 먼저 읽고 수정.

### Step 4.4: 정상 종료 경로에도 finalize 호출

- [ ] **편집:** 정상 종료 블록(run status='completed'/'blocked' 업데이트 직후)에 `await finalizeCancellationIfDone(runId, source).catch(() => void 0)` 추가. race 상황에서 cancel 요청이 직전에 들어왔어도 `cancelling` row가 있으면 정리.

### Step 4.5: 기존 테스트 회귀 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run`
- [ ] **기대:** 기존 모든 테스트 PASS, 새 cancellation 관련 변경이 회귀를 일으키지 않음.

### Step 4.6: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/queue/executor.ts
git commit -m "$(cat <<'EOF'
feat(collector): executor에 cancellation 체크포인트 삽입

수집 루프 시작/각 청크/embedding 배치 직전에 checkCancellation 호출.
CancelledError는 errorReason='cancelled'로 collection_runs에 기록하고
run_cancellations를 cancelled로 최종 전이.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Source Pause 모듈

**Files:**

- Create: `apps/collector/src/queue/source-pause.ts`
- Test: `apps/collector/src/queue/source-pause.test.ts`

### Step 5.1: 실패 테스트 작성

- [ ] **작성:** `apps/collector/src/queue/source-pause.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { sourcePauseState } from '../db/schema';
import { pauseSource, resumeSource, isSourcePaused, listSourceStates } from './source-pause';

const SOURCE = 'naver-news';

async function clearAll() {
  await getDb().delete(sourcePauseState);
}

describe('source-pause', () => {
  beforeEach(clearAll);
  afterEach(clearAll);

  it('pauseSource는 row를 insert하고 isSourcePaused=true를 반환', async () => {
    await pauseSource(SOURCE, 'selector 점검', 'alice');
    expect(await isSourcePaused(SOURCE)).toBe(true);
  });

  it('resumeSource는 resumedAt을 설정하고 isSourcePaused=false', async () => {
    await pauseSource(SOURCE, null, 'alice');
    await resumeSource(SOURCE);
    expect(await isSourcePaused(SOURCE)).toBe(false);
    const [row] = await getDb()
      .select()
      .from(sourcePauseState)
      .where(eq(sourcePauseState.source, SOURCE));
    expect(row.resumedAt).not.toBeNull();
  });

  it('재-pause 시 동일 row를 갱신 (resumedAt=null, pausedAt 갱신)', async () => {
    await pauseSource(SOURCE, 'r1', 'alice');
    await resumeSource(SOURCE);
    await pauseSource(SOURCE, 'r2', 'bob');
    const [row] = await getDb()
      .select()
      .from(sourcePauseState)
      .where(eq(sourcePauseState.source, SOURCE));
    expect(row.reason).toBe('r2');
    expect(row.pausedBy).toBe('bob');
    expect(row.resumedAt).toBeNull();
  });

  it('listSourceStates는 모든 row 반환', async () => {
    await pauseSource('naver-news', null, 'alice');
    await pauseSource('youtube', null, 'alice');
    const states = await listSourceStates();
    expect(states.map((s) => s.source).sort()).toEqual(['naver-news', 'youtube']);
  });
});
```

### Step 5.2: 테스트 실패 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/queue/source-pause.test.ts`
- [ ] **기대:** 모듈 없음 실패.

### Step 5.3: 구현

- [ ] **작성:** `apps/collector/src/queue/source-pause.ts`

```typescript
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db';
import { sourcePauseState, type SourcePauseRow } from '../db/schema';

export async function pauseSource(
  source: string,
  reason: string | null,
  actor: string,
): Promise<void> {
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
}

export async function resumeSource(source: string): Promise<void> {
  await getDb()
    .update(sourcePauseState)
    .set({ resumedAt: new Date() })
    .where(and(eq(sourcePauseState.source, source), isNull(sourcePauseState.resumedAt)));
}

export async function isSourcePaused(source: string): Promise<boolean> {
  const [row] = await getDb()
    .select()
    .from(sourcePauseState)
    .where(and(eq(sourcePauseState.source, source), isNull(sourcePauseState.resumedAt)))
    .limit(1);
  return !!row;
}

export async function listSourceStates(): Promise<SourcePauseRow[]> {
  return getDb().select().from(sourcePauseState);
}
```

### Step 5.4: 테스트 통과

- [ ] **실행:** `pnpm -C apps/collector vitest run src/queue/source-pause.test.ts`
- [ ] **기대:** 4개 PASS.

### Step 5.5: scanner/triggerNow/backfill에 체크 삽입

- [ ] **편집:** `apps/collector/src/scheduler/scanner.ts` — `for (const source of sub.sources)` 루프 내 `enqueueCollectionJob` 직전:

```typescript
for (const source of sub.sources as CollectorSource[]) {
  if (await isSourcePaused(source)) {
    console.warn(`[scanner] skip paused source=${source} subscription=${sub.id}`);
    continue;
  }
  await enqueueCollectionJob({ ... });
  enqueued++;
}
```

import 추가: `import { isSourcePaused } from '../queue/source-pause';`

- [ ] **편집:** `apps/collector/src/server/trpc/subscriptions.ts`의 `triggerNow`와 `backfill`의 enqueue 루프에 동일 체크 삽입. skip된 소스는 응답의 별도 필드(`skippedSources: string[]`)로 반환.

### Step 5.6: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/queue/source-pause.ts apps/collector/src/queue/source-pause.test.ts apps/collector/src/scheduler/scanner.ts apps/collector/src/server/trpc/subscriptions.ts
git commit -m "$(cat <<'EOF'
feat(collector): 시스템 전역 소스 일시정지 기능 추가

pauseSource/resumeSource/isSourcePaused/listSourceStates.
scanner, triggerNow, backfill에 enqueue 전 paused 체크 삽입.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Layer A 진단 수집

**Files:**

- Create: `apps/collector/src/diagnostics/collect-run.ts`
- Test: `apps/collector/src/diagnostics/collect-run.test.ts`

### Step 6.1: 실패 테스트 작성

- [ ] **작성:** `apps/collector/src/diagnostics/collect-run.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions, rawItems } from '../db/schema';
import { collectLayerA } from './collect-run';

describe('collectLayerA', () => {
  let subId: number;
  const runId = randomUUID();
  const SOURCE = 'naver-news';

  beforeEach(async () => {
    const [sub] = await getDb()
      .insert(keywordSubscriptions)
      .values({
        keyword: 'test-keyword',
        sources: [SOURCE],
        intervalHours: 6,
        limits: { maxPerRun: 10 },
      })
      .returning();
    subId = sub.id;
    await getDb().insert(collectionRuns).values({
      time: new Date(),
      runId,
      subscriptionId: subId,
      source: SOURCE,
      status: 'running',
      triggerType: 'manual',
    });
  });

  afterEach(async () => {
    await getDb().delete(rawItems).where(eq(rawItems.fetchedFromRun, runId));
    await getDb().delete(collectionRuns).where(eq(collectionRuns.runId, runId));
    await getDb().delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, subId));
  });

  it('필수 필드를 모두 채운다', async () => {
    const result = await collectLayerA(runId, SOURCE);
    expect(result.runId).toBe(runId);
    expect(result.source).toBe(SOURCE);
    expect(result.jobId).toBe(`${runId}-${SOURCE}`);
    expect(result.subscription?.keyword).toBe('test-keyword');
    expect(result.partialRawItemsCount).toBe(0);
    expect(result.partialRawItemsByType).toEqual({ article: 0, video: 0, comment: 0 });
    expect(result.collectionRunsRow?.status).toBe('running');
  });

  it('raw_items count를 type별로 집계', async () => {
    await getDb()
      .insert(rawItems)
      .values([
        {
          time: new Date(),
          subscriptionId: subId,
          source: SOURCE,
          sourceId: 'a1',
          itemType: 'article',
          rawPayload: {},
          fetchedFromRun: runId,
        },
        {
          time: new Date(),
          subscriptionId: subId,
          source: SOURCE,
          sourceId: 'a2',
          itemType: 'article',
          rawPayload: {},
          fetchedFromRun: runId,
        },
      ]);
    const result = await collectLayerA(runId, SOURCE);
    expect(result.partialRawItemsCount).toBe(2);
    expect(result.partialRawItemsByType.article).toBe(2);
  });

  it('collection_runs row가 없으면 null 반환', async () => {
    const unknownRun = randomUUID();
    const result = await collectLayerA(unknownRun, SOURCE);
    expect(result.collectionRunsRow).toBeNull();
    expect(result.subscription).toBeNull();
  });
});
```

### Step 6.2: 테스트 실패 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/diagnostics/collect-run.test.ts`

### Step 6.3: 구현

- [ ] **작성:** `apps/collector/src/diagnostics/collect-run.ts`

```typescript
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions, rawItems, fetchErrors } from '../db/schema';
import { getCollectQueue } from '../queue/queues';
import type { CollectorSource } from '../queue/types';
import type { LayerAPayload } from '../db/schema';
import { sanitizeError } from './masking';

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

  // collection_runs 해당 (runId, source) 가장 최근 row
  const [runRow] = await db
    .select()
    .from(collectionRuns)
    .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, source)))
    .orderBy(desc(collectionRuns.time))
    .limit(1);

  // fetch_errors에는 run_id 컬럼이 없으므로 subscription_id + source + time 윈도우로 조회
  let fetchErrorsCount = 0;
  let lastFetchError: string | null = null;
  if (runRow) {
    const since = new Date(runRow.time.getTime() - 5 * 60 * 1000);
    const errs = await db
      .select()
      .from(fetchErrors)
      .where(
        and(
          eq(fetchErrors.subscriptionId, runRow.subscriptionId),
          eq(fetchErrors.source, source),
          sql`${fetchErrors.time} >= ${since}`,
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
```

### Step 6.4: 테스트 통과

- [ ] **실행:** `pnpm -C apps/collector vitest run src/diagnostics/collect-run.test.ts`
- [ ] **기대:** 3개 PASS.

### Step 6.5: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/diagnostics/collect-run.ts apps/collector/src/diagnostics/collect-run.test.ts
git commit -m "$(cat <<'EOF'
feat(collector): Layer A 진단 수집 구현

(runId, source) 스냅샷 — BullMQ 상태, raw_items/fetch_errors 집계,
collection_runs 마지막 row, subscription 메타.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Layer B 진단 수집 (소스 건강도)

**Files:**

- Create: `apps/collector/src/diagnostics/collect-source.ts`
- Test: `apps/collector/src/diagnostics/collect-source.test.ts`

### Step 7.1: 실패 테스트 작성

- [ ] **작성:** `apps/collector/src/diagnostics/collect-source.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions } from '../db/schema';
import { collectLayerB } from './collect-source';

const SOURCE = 'naver-news';

async function seedRun(
  subId: number,
  status: 'completed' | 'failed' | 'blocked',
  errorReason?: string,
) {
  await getDb()
    .insert(collectionRuns)
    .values({
      time: new Date(),
      runId: randomUUID(),
      subscriptionId: subId,
      source: SOURCE,
      status,
      triggerType: 'schedule',
      errorReason: errorReason ?? null,
    });
}

describe('collectLayerB', () => {
  let subId: number;

  beforeEach(async () => {
    const [sub] = await getDb()
      .insert(keywordSubscriptions)
      .values({
        keyword: 'b-test',
        sources: [SOURCE],
        intervalHours: 6,
        limits: { maxPerRun: 10 },
      })
      .returning();
    subId = sub.id;
  });

  afterEach(async () => {
    await getDb().delete(collectionRuns).where(eq(collectionRuns.subscriptionId, subId));
    await getDb().delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, subId));
  });

  it('failRate를 계산한다', async () => {
    await seedRun(subId, 'completed');
    await seedRun(subId, 'completed');
    await seedRun(subId, 'failed');
    await seedRun(subId, 'failed');
    const result = await collectLayerB(SOURCE);
    expect(result.last24h.total).toBe(4);
    expect(result.last24h.completed).toBe(2);
    expect(result.last24h.failed).toBe(2);
    expect(result.last24h.failRate).toBeCloseTo(0.5);
  });

  it('selectorChangeSuspected를 errorReason 패턴으로 판정', async () => {
    for (let i = 0; i < 6; i++) await seedRun(subId, 'failed', 'Cannot read property text of null');
    const result = await collectLayerB(SOURCE);
    expect(result.selectorChangeSuspected).toBe(true);
  });

  it('rateLimitHits를 errorReason에서 카운트', async () => {
    await seedRun(subId, 'failed', 'HTTP 429 Too Many Requests');
    await seedRun(subId, 'failed', 'rate limit exceeded');
    await seedRun(subId, 'failed', 'other error');
    const result = await collectLayerB(SOURCE);
    expect(result.rateLimitHits).toBe(2);
  });
});
```

### Step 7.2: 테스트 실패 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/diagnostics/collect-source.test.ts`

### Step 7.3: 구현

- [ ] **작성:** `apps/collector/src/diagnostics/collect-source.ts`

```typescript
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns } from '../db/schema';
import type { LayerBPayload } from '../db/schema';

const SELECTOR_PATTERN = /selector|querySelector|Cannot read|text of null|is not a function/i;
const RATE_LIMIT_PATTERN = /429|rate[- ]?limit|too many/i;

export async function collectLayerB(source: string): Promise<LayerBPayload> {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const rows = await db
    .select()
    .from(collectionRuns)
    .where(and(eq(collectionRuns.source, source), gte(collectionRuns.time, since)))
    .orderBy(desc(collectionRuns.time))
    .limit(500);

  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const blocked = rows.filter((r) => r.status === 'blocked').length;
  const failRate = total > 0 ? (failed + blocked) / total : 0;

  // consecutiveFailures — 최신부터 이어지는 실패 개수
  let consecutiveFailures = 0;
  for (const r of rows) {
    if (r.status === 'failed' || r.status === 'blocked') consecutiveFailures++;
    else break;
  }

  // selectorChangeSuspected — 최근 10건 실패 중 5건 이상 selector 패턴 매치
  const recent10Fail = rows
    .filter((r) => r.status === 'failed' || r.status === 'blocked')
    .slice(0, 10);
  const selectorHits = recent10Fail.filter(
    (r) => r.errorReason && SELECTOR_PATTERN.test(r.errorReason),
  ).length;
  const selectorChangeSuspected = selectorHits >= 5;

  const rateLimitHits = rows.filter(
    (r) =>
      (r.status === 'failed' || r.status === 'blocked') &&
      r.errorReason &&
      RATE_LIMIT_PATTERN.test(r.errorReason),
  ).length;

  const lastSuccess = rows.find((r) => r.status === 'completed');

  return {
    source,
    last24h: { total, completed, failed, blocked, failRate },
    consecutiveFailures,
    selectorChangeSuspected,
    rateLimitHits,
    lastSuccessAt: lastSuccess?.time.toISOString() ?? null,
  };
}
```

### Step 7.4: 테스트 통과

- [ ] **실행:** `pnpm -C apps/collector vitest run src/diagnostics/collect-source.test.ts`
- [ ] **기대:** 3개 PASS.

### Step 7.5: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/diagnostics/collect-source.ts apps/collector/src/diagnostics/collect-source.test.ts
git commit -m "$(cat <<'EOF'
feat(collector): Layer B 진단 수집 구현 (소스 건강도)

24h 실패율, 연속 실패, selector 변경 의심, rate limit hit 집계.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Layer C 진단 수집 + 큐 상태 유틸

**Files:**

- Create: `apps/collector/src/queue/health.ts`
- Create: `apps/collector/src/diagnostics/collect-system.ts`
- Test: `apps/collector/src/diagnostics/collect-system.test.ts`

### Step 8.1: `queue/health.ts` 작성 (collector 전용)

- [ ] **작성:** `apps/collector/src/queue/health.ts`

```typescript
import { getAllCollectQueues } from './queues';
import type { LayerCPayload } from '../db/schema';

export async function getCollectQueueStatus(): Promise<LayerCPayload['queues']> {
  const entries = getAllCollectQueues();
  const out: LayerCPayload['queues'] = {};
  for (const { source, queue } of entries) {
    try {
      const rawWorkers = await queue.getWorkers();
      const workers = rawWorkers.map((w) => ({
        id: String((w as { id?: string }).id ?? ''),
        addr: String((w as { addr?: string }).addr ?? ''),
        idleMs: Number((w as { idle?: number }).idle ?? 0),
      }));
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'paused');
      const isPaused = await queue.isPaused();
      out[`collect-${source}`] = {
        workerCount: workers.length,
        workers,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          paused: counts.paused ?? 0,
        },
        isPaused,
      };
    } catch (err) {
      out[`collect-${source}`] = {
        workerCount: 0,
        workers: [],
        counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
        isPaused: false,
      };
    }
  }
  return out;
}
```

### Step 8.2: Layer C 실패 테스트

- [ ] **작성:** `apps/collector/src/diagnostics/collect-system.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { collectLayerC } from './collect-system';

describe('collectLayerC', () => {
  it('redis/db ping + queues + processMemMB를 반환', async () => {
    const result = await collectLayerC();
    expect(['ok', 'fail']).toContain(result.redis.ping);
    expect(['ok', 'fail']).toContain(result.db.ping);
    expect(typeof result.processMemMB).toBe('number');
    expect(result.queues).toBeDefined();
  });
});
```

### Step 8.3: Layer C 구현

- [ ] **작성:** `apps/collector/src/diagnostics/collect-system.ts`

```typescript
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { getBullMQOptions } from '../queue/connection';
import { getCollectQueueStatus } from '../queue/health';
import IORedis from 'ioredis';
import type { LayerCPayload } from '../db/schema';

async function pingRedis(): Promise<LayerCPayload['redis']> {
  const opts = getBullMQOptions();
  const redis = new IORedis(opts.connection as Record<string, unknown>);
  const start = Date.now();
  try {
    await redis.ping();
    return { ping: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { ping: 'fail', latencyMs: Date.now() - start };
  } finally {
    redis.disconnect();
  }
}

async function pingDb(): Promise<LayerCPayload['db']> {
  const start = Date.now();
  try {
    await getDb().execute(sql`SELECT 1`);
    return { ping: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { ping: 'fail', latencyMs: Date.now() - start };
  }
}

export async function collectLayerC(): Promise<LayerCPayload> {
  const [redis, db, queues] = await Promise.all([pingRedis(), pingDb(), getCollectQueueStatus()]);
  const processMemMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  return { redis, db, queues, processMemMB };
}
```

### Step 8.4: 테스트 통과

- [ ] **실행:** `pnpm -C apps/collector vitest run src/diagnostics/collect-system.test.ts`
- [ ] **기대:** 1개 PASS (Redis/DB 연결 필요).

### Step 8.5: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/queue/health.ts apps/collector/src/diagnostics/collect-system.ts apps/collector/src/diagnostics/collect-system.test.ts
git commit -m "$(cat <<'EOF'
feat(collector): Layer C 진단 수집 + 큐 상태 유틸

Redis/DB ping, 큐 소스별 worker/count 상태, processMemMB 스냅샷.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Diagnostics BullMQ Queue + Worker

**Files:**

- Create: `apps/collector/src/diagnostics/queue.ts`
- Create: `apps/collector/src/diagnostics/worker.ts`

### Step 9.1: Queue 팩토리

- [ ] **작성:** `apps/collector/src/diagnostics/queue.ts`

```typescript
import { Queue } from 'bullmq';
import { getBullMQOptions } from '../queue/connection';

type DiagnosticsJobData =
  | { kind: 'layer-b'; diagnosticId: string; source: string }
  | { kind: 'layer-c'; diagnosticId: string }
  | { kind: 'escalate-to-force'; runId: string; source: string };

let queue: Queue<DiagnosticsJobData> | null = null;

export function getDiagnosticsQueue(): Queue<DiagnosticsJobData> {
  if (!queue) {
    queue = new Queue<DiagnosticsJobData>('diagnostics', getBullMQOptions());
  }
  return queue;
}

export type { DiagnosticsJobData };
```

### Step 9.2: Worker 구현

- [ ] **작성:** `apps/collector/src/diagnostics/worker.ts`

```typescript
import { Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { runDiagnostics, runCancellations } from '../db/schema';
import { getBullMQOptions } from '../queue/connection';
import { collectLayerB } from './collect-source';
import { collectLayerC } from './collect-system';
import { cancelRun } from '../queue/run-control'; // Task 10에서 추가
import type { DiagnosticsJobData } from './queue';

export function startDiagnosticsWorker(): Worker<DiagnosticsJobData> {
  return new Worker<DiagnosticsJobData>(
    'diagnostics',
    async (job) => {
      const { data } = job;
      if (data.kind === 'layer-b') {
        const payload = await collectLayerB(data.source);
        await getDb()
          .update(runDiagnostics)
          .set({ layerB: payload, layerBAt: new Date() })
          .where(eq(runDiagnostics.id, data.diagnosticId));
      } else if (data.kind === 'layer-c') {
        const payload = await collectLayerC();
        await getDb()
          .update(runDiagnostics)
          .set({ layerC: payload, layerCAt: new Date() })
          .where(eq(runDiagnostics.id, data.diagnosticId));
      } else if (data.kind === 'escalate-to-force') {
        // 10분 경과 — 여전히 cancelling이면 force 승격
        const [row] = await getDb()
          .select()
          .from(runCancellations)
          .where(eq(runCancellations.runId, data.runId));
        if (row && row.status === 'cancelling' && row.source === data.source) {
          await cancelRun(data.runId, data.source, 'force', 'auto-stall-timeout');
        }
      }
    },
    getBullMQOptions(),
  );
}

async function main() {
  const worker = startDiagnosticsWorker();
  console.warn('[diagnostics-worker] started');
  const shutdown = async (sig: string) => {
    console.warn(`[diagnostics-worker] ${sig} received`);
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

### Step 9.3: Docker Compose에 diagnostics worker 서비스 추가

- [ ] **확인:** `docker-compose` 파일 경로 (`ls -la *.yml | grep -i compose`).
- [ ] **편집:** collector-worker 서비스 바로 아래에 `collector-diagnostics-worker` 서비스를 추가하되, 기본은 같은 이미지/환경 + command만 `tsx apps/collector/src/diagnostics/worker.ts`로 변경. 필요 시 이 단계는 운영 롤아웃 시점에 별도 PR로 처리 가능 — **우선 로컬에서 `tsx`로 수동 실행 가능한 상태까지만 완성**.

### Step 9.4: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/diagnostics/queue.ts apps/collector/src/diagnostics/worker.ts
git commit -m "$(cat <<'EOF'
feat(collector): diagnostics 큐 + worker 추가

Layer B/C 비동기 수집과 10분 timeout force 승격 처리.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Run Control — cancelRun / retryRun / cancelBySubscription / cancelAll

**Files:**

- Create: `apps/collector/src/queue/run-control.ts`
- Test: `apps/collector/src/queue/run-control.test.ts`

### Step 10.1: 실패 테스트 작성

- [ ] **작성:** `apps/collector/src/queue/run-control.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import {
  collectionRuns,
  keywordSubscriptions,
  runCancellations,
  runRetryLinks,
  runDiagnostics,
} from '../db/schema';
import { cancelRun, retryRun, cancelBySubscription } from './run-control';

const SOURCE = 'naver-news';

async function seed() {
  const [sub] = await getDb()
    .insert(keywordSubscriptions)
    .values({
      keyword: 'rc-test',
      sources: [SOURCE],
      intervalHours: 6,
      limits: { maxPerRun: 10 },
      lastRunAt: new Date(),
    })
    .returning();
  const runId = randomUUID();
  await getDb().insert(collectionRuns).values({
    time: new Date(),
    runId,
    subscriptionId: sub.id,
    source: SOURCE,
    status: 'running',
    triggerType: 'manual',
  });
  return { subId: sub.id, runId };
}

async function cleanup(subId: number) {
  await getDb().delete(runDiagnostics);
  await getDb().delete(runCancellations);
  await getDb().delete(runRetryLinks);
  await getDb().delete(collectionRuns).where(eq(collectionRuns.subscriptionId, subId));
  await getDb().delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, subId));
}

describe('cancelRun', () => {
  let ctx: { subId: number; runId: string };
  beforeEach(async () => {
    ctx = await seed();
  });
  afterEach(async () => {
    await cleanup(ctx.subId);
  });

  it('status를 cancelling으로 기록하고 diagnostic을 생성', async () => {
    const res = await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    expect(res.diagnosticId).toBeTruthy();
    const [cancel] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, ctx.runId), eq(runCancellations.source, SOURCE)));
    expect(cancel.status).toBe('cancelling');
    expect(cancel.mode).toBe('graceful');
    const [diag] = await getDb()
      .select()
      .from(runDiagnostics)
      .where(eq(runDiagnostics.id, res.diagnosticId));
    expect(diag.triggeredBy).toBe('user_cancel');
    expect(diag.layerA).toBeTruthy();
  });

  it('중복 graceful 호출은 alreadyCancelling', async () => {
    await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    const res = await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    expect(res.alreadyCancelling).toBe(true);
  });

  it('graceful → force 승격은 허용', async () => {
    await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    const res = await cancelRun(ctx.runId, SOURCE, 'force', 'test');
    expect(res.alreadyCancelling).toBeUndefined();
    const [cancel] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, ctx.runId), eq(runCancellations.source, SOURCE)));
    expect(cancel.mode).toBe('force');
  });
});

describe('retryRun', () => {
  let ctx: { subId: number; runId: string };
  beforeEach(async () => {
    ctx = await seed();
  });
  afterEach(async () => {
    await cleanup(ctx.subId);
  });

  it('새 runId를 발급하고 run_retry_links에 기록', async () => {
    const res = await retryRun(ctx.runId, SOURCE, 'test');
    expect(res.reused).toBe(false);
    expect(res.newRunId).not.toBe(ctx.runId);
    const [link] = await getDb()
      .select()
      .from(runRetryLinks)
      .where(eq(runRetryLinks.originalRunId, ctx.runId));
    expect(link.newRunId).toBe(res.newRunId);
  });

  it('중복 호출은 동일 newRunId 반환 (reused=true)', async () => {
    const first = await retryRun(ctx.runId, SOURCE, 'test');
    const second = await retryRun(ctx.runId, SOURCE, 'test');
    expect(second.newRunId).toBe(first.newRunId);
    expect(second.reused).toBe(true);
  });

  it('체인 3회 초과 시 거부', async () => {
    let current = ctx.runId;
    for (let i = 0; i < 3; i++) {
      const r = await retryRun(current, SOURCE, 'test');
      // 체인 깊이 추적용 collection_runs insert
      await getDb().insert(collectionRuns).values({
        time: new Date(),
        runId: r.newRunId,
        subscriptionId: ctx.subId,
        source: SOURCE,
        status: 'failed',
        triggerType: 'manual',
      });
      current = r.newRunId;
    }
    await expect(retryRun(current, SOURCE, 'test')).rejects.toThrow(/체인/);
  });
});

describe('cancelBySubscription', () => {
  let ctx: { subId: number; runId: string };
  beforeEach(async () => {
    ctx = await seed();
  });
  afterEach(async () => {
    await cleanup(ctx.subId);
  });

  it('해당 구독의 running run을 모두 cancelling으로 전이', async () => {
    const res = await cancelBySubscription(ctx.subId, 'graceful', 'test');
    expect(res.cancelled).toBeGreaterThanOrEqual(1);
    expect(res.runIds).toContain(ctx.runId);
  });
});
```

### Step 10.2: 테스트 실패 확인

- [ ] **실행:** `pnpm -C apps/collector vitest run src/queue/run-control.test.ts`

### Step 10.3: 구현

- [ ] **작성:** `apps/collector/src/queue/run-control.ts`

```typescript
import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getDb } from '../db';
import {
  collectionRuns,
  keywordSubscriptions,
  runCancellations,
  runDiagnostics,
  runRetryLinks,
} from '../db/schema';
import { getCollectQueue, enqueueCollectionJob } from './queues';
import type { CollectorSource } from './types';
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

const MAX_RETRY_CHAIN = 3;

export async function cancelRun(
  runId: string,
  source: string,
  mode: CancelMode,
  triggeredBy: string,
): Promise<CancelResult> {
  const db = getDb();

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

  // BullMQ 처리
  const queue = getCollectQueue(source as CollectorSource);
  const job = await queue.getJob(`${runId}-${source}`);
  if (job) {
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove().catch(() => void 0);
    } else if (state === 'active' && mode === 'force') {
      try {
        await job.discard();
        // @ts-expect-error — external token을 0으로 호출 (Task 0에서 검증)
        await job.moveToFailed(new Error('cancelled'), '0', false);
      } catch {
        await job.remove().catch(() => void 0);
      }
    }
  }

  // Layer A 동기 수집
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

  // Layer B/C + graceful 10분 timeout enqueue
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

export async function cancelBySubscription(
  subscriptionId: number,
  mode: CancelMode,
  triggeredBy: string,
): Promise<{ cancelled: number; runIds: string[] }> {
  const db = getDb();
  const rows = await db
    .select({
      runId: collectionRuns.runId,
      source: collectionRuns.source,
    })
    .from(collectionRuns)
    .where(
      and(eq(collectionRuns.subscriptionId, subscriptionId), eq(collectionRuns.status, 'running')),
    );

  const results: string[] = [];
  for (const r of rows) {
    await cancelRun(r.runId, r.source, mode, triggeredBy);
    results.push(r.runId);
  }
  return { cancelled: results.length, runIds: [...new Set(results)] };
}

export async function cancelAll(
  mode: CancelMode,
  triggeredBy: string,
): Promise<{ cancelled: number }> {
  const db = getDb();
  const rows = await db
    .select({
      runId: collectionRuns.runId,
      source: collectionRuns.source,
    })
    .from(collectionRuns)
    .where(eq(collectionRuns.status, 'running'));

  for (const r of rows) {
    await cancelRun(r.runId, r.source, mode, triggeredBy);
  }
  return { cancelled: rows.length };
}

export async function retryRun(
  runId: string,
  source: string,
  triggeredBy: string,
): Promise<{ newRunId: string; reused: boolean }> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(runRetryLinks)
    .where(and(eq(runRetryLinks.originalRunId, runId), eq(runRetryLinks.source, source)));
  if (existing) {
    return { newRunId: existing.newRunId, reused: true };
  }

  const depth = await computeRetryChainDepth(runId, source);
  if (depth >= MAX_RETRY_CHAIN) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: `재시도 체인 ${MAX_RETRY_CHAIN}회 초과`,
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

async function restoreJobPayload(runId: string, source: string) {
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

### Step 10.4: 테스트 통과

- [ ] **실행:** `pnpm -C apps/collector vitest run src/queue/run-control.test.ts`
- [ ] **기대:** 7개 PASS.

### Step 10.5: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/queue/run-control.ts apps/collector/src/queue/run-control.test.ts
git commit -m "$(cat <<'EOF'
feat(collector): cancelRun/retryRun/cancelBySubscription/cancelAll 구현

graceful/force 분기, 멱등 처리, 체인 3회 제한, Layer A 동기 수집,
Layer B/C 및 10분 timeout 승격 비동기 enqueue.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: tRPC 라우터 — runs 확장

**Files:**

- Modify: `apps/collector/src/server/trpc/runs.ts`

### Step 11.1: runs 라우터에 신규 procedure 추가

- [ ] **편집:** `apps/collector/src/server/trpc/runs.ts` — 기존 `router({...})`에 추가:

```typescript
import { z } from 'zod';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { collectionRuns, rawItems, runDiagnostics } from '../../db/schema';
import { protectedProcedure, router } from './init';
import { cancelRun, cancelBySubscription, cancelAll, retryRun } from '../../queue/run-control';
import { collectLayerA } from '../../diagnostics/collect-run';

const SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;

export const runsRouter = router({
  // ... 기존 list / itemBreakdown / get 유지 ...

  cancel: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${ctx.apiKey?.slice(0, 8) ?? 'unknown'}`;
      if (input.source) {
        return cancelRun(input.runId, input.source, input.mode, triggeredBy);
      }
      // run 전체 — 해당 runId의 모든 source 조회 후 순회
      const sources = await ctx.db
        .select({ source: collectionRuns.source })
        .from(collectionRuns)
        .where(and(eq(collectionRuns.runId, input.runId), eq(collectionRuns.status, 'running')));
      const results = [];
      for (const s of sources) {
        results.push(await cancelRun(input.runId, s.source, input.mode, triggeredBy));
      }
      return { runId: input.runId, results };
    }),

  cancelBySubscription: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${ctx.apiKey?.slice(0, 8) ?? 'unknown'}`;
      return cancelBySubscription(input.subscriptionId, input.mode, triggeredBy);
    }),

  cancelAll: protectedProcedure
    .input(
      z.object({
        mode: z.enum(['graceful', 'force']).default('graceful'),
        confirm: z.literal('CANCEL_ALL'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${ctx.apiKey?.slice(0, 8) ?? 'unknown'}`;
      return cancelAll(input.mode, triggeredBy);
    }),

  retry: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${ctx.apiKey?.slice(0, 8) ?? 'unknown'}`;
      return retryRun(input.runId, input.source, triggeredBy);
    }),

  diagnose: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        refresh: z.boolean().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.refresh && input.source) {
        // 강제 새로고침 — Layer A 재수집 + 신규 row insert
        const layerA = await collectLayerA(input.runId, input.source);
        const [row] = await ctx.db
          .insert(runDiagnostics)
          .values({
            runId: input.runId,
            source: input.source,
            triggeredBy: 'manual',
            layerA,
          })
          .returning();
        return row;
      }
      const conds = [eq(runDiagnostics.runId, input.runId)];
      if (input.source) conds.push(eq(runDiagnostics.source, input.source));
      const [row] = await ctx.db
        .select()
        .from(runDiagnostics)
        .where(and(...conds))
        .orderBy(desc(runDiagnostics.createdAt))
        .limit(1);
      return row ?? null;
    }),

  stalled: protectedProcedure
    .input(z.object({ staleMinutes: z.number().int().min(1).max(120).default(10) }))
    .query(async ({ input, ctx }) => {
      const threshold = new Date(Date.now() - input.staleMinutes * 60_000);
      const rows = await ctx.db
        .select()
        .from(collectionRuns)
        .where(
          and(eq(collectionRuns.status, 'running'), sql`${collectionRuns.time} < ${threshold}`),
        )
        .orderBy(desc(collectionRuns.time))
        .limit(50);
      return rows;
    }),
});
```

### Step 11.2: 타입 회귀 확인

- [ ] **실행:** `pnpm -C apps/collector build`
- [ ] **기대:** 타입 오류 없음.

### Step 11.3: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/server/trpc/runs.ts
git commit -m "$(cat <<'EOF'
feat(collector): runs tRPC에 cancel/retry/diagnose/stalled 추가

cancel, cancelBySubscription, cancelAll, retry, diagnose, stalled
6개 procedure를 추가. triggeredBy는 apiKey prefix 8자리.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: tRPC 라우터 — queue, sources 신규

**Files:**

- Create: `apps/collector/src/server/trpc/queue.ts`
- Create: `apps/collector/src/server/trpc/sources.ts`
- Modify: `apps/collector/src/server/trpc/router.ts`

### Step 12.1: queue 라우터

- [ ] **작성:** `apps/collector/src/server/trpc/queue.ts`

```typescript
import { router, protectedProcedure } from './init';
import { getCollectQueueStatus } from '../../queue/health';

export const queueRouter = router({
  status: protectedProcedure.query(async () => {
    return getCollectQueueStatus();
  }),
});
```

### Step 12.2: sources 라우터

- [ ] **작성:** `apps/collector/src/server/trpc/sources.ts`

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from './init';
import { pauseSource, resumeSource, listSourceStates } from '../../queue/source-pause';

const SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;

export const sourcesRouter = router({
  list: protectedProcedure.query(async () => {
    return listSourceStates();
  }),

  pause: protectedProcedure
    .input(
      z.object({
        source: z.enum(SOURCE_ENUM),
        reason: z.string().max(200).nullable().default(null),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = `user:${ctx.apiKey?.slice(0, 8) ?? 'unknown'}`;
      await pauseSource(input.source, input.reason, actor);
      return { source: input.source, paused: true };
    }),

  resume: protectedProcedure
    .input(z.object({ source: z.enum(SOURCE_ENUM) }))
    .mutation(async ({ input }) => {
      await resumeSource(input.source);
      return { source: input.source, paused: false };
    }),
});
```

### Step 12.3: router.ts 업데이트

- [ ] **편집:** `apps/collector/src/server/trpc/router.ts`

```typescript
import { router } from './init';
import { subscriptionsRouter } from './subscriptions';
import { itemsRouter } from './items';
import { runsRouter } from './runs';
import { healthRouter } from './health';
import { queueRouter } from './queue';
import { sourcesRouter } from './sources';

export const appRouter = router({
  subscriptions: subscriptionsRouter,
  items: itemsRouter,
  runs: runsRouter,
  health: healthRouter,
  queue: queueRouter,
  sources: sourcesRouter,
});

export type AppRouter = typeof appRouter;
```

### Step 12.4: 빌드 검증

- [ ] **실행:** `pnpm -C apps/collector build`
- [ ] **기대:** 에러 없음.

### Step 12.5: 커밋

- [ ] **커밋:**

```bash
git add apps/collector/src/server/trpc/queue.ts apps/collector/src/server/trpc/sources.ts apps/collector/src/server/trpc/router.ts
git commit -m "$(cat <<'EOF'
feat(collector): queue/sources tRPC 라우터 추가

queue.status로 큐 전체 상태, sources.pause/resume/list로
시스템 전역 소스 일시정지 제어.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: web tRPC 프록시 추가

**Files:**

- Modify: `apps/web/src/server/trpc/routers/subscriptions.ts`

### Step 13.1: 신규 procedure 추가

- [ ] **편집:** 기존 파일 하단에 이어서 추가. 간단히 collector 클라이언트로 프록시하는 패턴을 그대로 따름.

```typescript
// 기존 export interface들 아래에 추가 ---
export interface CancelResult {
  runId: string;
  source: string;
  mode: 'graceful' | 'force';
  alreadyCancelled?: boolean;
  alreadyCancelling?: boolean;
  diagnosticId: string;
}

export interface RetryResult {
  newRunId: string;
  reused: boolean;
}

export interface DiagnosticRecord {
  id: string;
  runId: string;
  source: string | null;
  triggeredBy: string;
  layerA: unknown;
  layerB: unknown | null;
  layerC: unknown | null;
  layerAAt: Date | string;
  layerBAt: Date | string | null;
  layerCAt: Date | string | null;
  createdAt: Date | string;
}

export interface StalledRun {
  runId: string;
  source: string;
  time: Date | string;
  subscriptionId: number;
  status: string;
}

export interface SourceState {
  source: string;
  pausedAt: Date | string;
  pausedBy: string;
  reason: string | null;
  resumedAt: Date | string | null;
}

export interface QueueStatus {
  [queueName: string]: {
    workerCount: number;
    workers: Array<{ id: string; addr: string; idleMs: number }>;
    counts: { waiting: number; active: number; delayed: number; failed: number; paused: number };
    isPaused: boolean;
  };
}

// subscriptionsRouter({...}) 안에 추가 ---

cancelRun: protectedProcedure
  .input(z.object({
    runId: z.string().uuid(),
    source: z.enum(SOURCE_ENUM).optional(),
    mode: z.enum(['graceful', 'force']).default('graceful'),
  }))
  .mutation(async ({ input }): Promise<CancelResult | { runId: string; results: CancelResult[] }> => {
    try {
      const res = await getCollectorClient().runs.cancel.mutate(input);
      return res as unknown as CancelResult | { runId: string; results: CancelResult[] };
    } catch (err) { handleCollectorError(err); }
  }),

cancelBySubscription: protectedProcedure
  .input(z.object({
    subscriptionId: z.number().int().positive(),
    mode: z.enum(['graceful', 'force']).default('graceful'),
  }))
  .mutation(async ({ input }) => {
    try {
      const res = await getCollectorClient().runs.cancelBySubscription.mutate(input);
      return res as unknown as { cancelled: number; runIds: string[] };
    } catch (err) { handleCollectorError(err); }
  }),

cancelAll: protectedProcedure
  .input(z.object({
    mode: z.enum(['graceful', 'force']).default('graceful'),
    confirm: z.literal('CANCEL_ALL'),
  }))
  .mutation(async ({ input }) => {
    try {
      const res = await getCollectorClient().runs.cancelAll.mutate(input);
      return res as unknown as { cancelled: number };
    } catch (err) { handleCollectorError(err); }
  }),

retry: protectedProcedure
  .input(z.object({
    runId: z.string().uuid(),
    source: z.enum(SOURCE_ENUM),
  }))
  .mutation(async ({ input }): Promise<RetryResult> => {
    try {
      const res = await getCollectorClient().runs.retry.mutate(input);
      return res as unknown as RetryResult;
    } catch (err) { handleCollectorError(err); }
  }),

diagnose: protectedProcedure
  .input(z.object({
    runId: z.string().uuid(),
    source: z.enum(SOURCE_ENUM).optional(),
    refresh: z.boolean().default(false),
  }))
  .query(async ({ input }): Promise<DiagnosticRecord | null> => {
    try {
      const res = await getCollectorClient().runs.diagnose.query(input);
      return res as unknown as DiagnosticRecord | null;
    } catch (err) { handleCollectorError(err); }
  }),

stalled: protectedProcedure
  .input(z.object({ staleMinutes: z.number().int().min(1).max(120).default(10) }).optional())
  .query(async ({ input }): Promise<StalledRun[]> => {
    try {
      const res = await getCollectorClient().runs.stalled.query({ staleMinutes: input?.staleMinutes ?? 10 });
      return res as unknown as StalledRun[];
    } catch (err) { handleCollectorError(err); }
  }),

queueStatus: protectedProcedure
  .query(async (): Promise<QueueStatus> => {
    try {
      const res = await getCollectorClient().queue.status.query();
      return res as unknown as QueueStatus;
    } catch (err) { handleCollectorError(err); }
  }),

sourceList: protectedProcedure
  .query(async (): Promise<SourceState[]> => {
    try {
      const res = await getCollectorClient().sources.list.query();
      return res as unknown as SourceState[];
    } catch (err) { handleCollectorError(err); }
  }),

sourcePause: protectedProcedure
  .input(z.object({
    source: z.enum(SOURCE_ENUM),
    reason: z.string().max(200).nullable().default(null),
  }))
  .mutation(async ({ input }) => {
    try {
      const res = await getCollectorClient().sources.pause.mutate(input);
      return res as unknown as { source: string; paused: boolean };
    } catch (err) { handleCollectorError(err); }
  }),

sourceResume: protectedProcedure
  .input(z.object({ source: z.enum(SOURCE_ENUM) }))
  .mutation(async ({ input }) => {
    try {
      const res = await getCollectorClient().sources.resume.mutate(input);
      return res as unknown as { source: string; paused: boolean };
    } catch (err) { handleCollectorError(err); }
  }),
```

### Step 13.2: 빌드 검증

- [ ] **실행:** `pnpm -C apps/web build`
- [ ] **기대:** 타입 오류 없음.

### Step 13.3: 커밋

- [ ] **커밋:**

```bash
git add apps/web/src/server/trpc/routers/subscriptions.ts
git commit -m "$(cat <<'EOF'
feat(web): subscriptions 라우터에 run 중지/진단/소스 제어 프록시 추가

cancelRun, cancelBySubscription, cancelAll, retry, diagnose, stalled,
queueStatus, sourceList, sourcePause, sourceResume 10개 procedure.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: UI — Zustand 스토어 + RunActionsModal

**Files:**

- Create: `apps/web/src/stores/run-actions-modal-store.ts`
- Create: `apps/web/src/components/subscriptions/run-actions-modal.tsx`

### Step 14.1: 스토어 작성

- [ ] **확인:** `pnpm -C apps/web list zustand` — 설치 여부.
- [ ] **미설치 시 설치:** `pnpm -C apps/web add zustand`
- [ ] **작성:** `apps/web/src/stores/run-actions-modal-store.ts`

```typescript
import { create } from 'zustand';

export type RunActionsTab = 'diagnose' | 'cancel' | 'retry';

interface State {
  open: boolean;
  runId: string | null;
  source: string | null;
  tab: RunActionsTab;
  openModal: (runId: string, source: string, tab?: RunActionsTab) => void;
  closeModal: () => void;
  setTab: (tab: RunActionsTab) => void;
}

export const useRunActionsModal = create<State>((set) => ({
  open: false,
  runId: null,
  source: null,
  tab: 'diagnose',
  openModal: (runId, source, tab = 'diagnose') => set({ open: true, runId, source, tab }),
  closeModal: () => set({ open: false, runId: null, source: null }),
  setTab: (tab) => set({ tab }),
}));
```

### Step 14.2: 모달 컴포넌트 작성

- [ ] **작성:** `apps/web/src/components/subscriptions/run-actions-modal.tsx`

> 구현은 shadcn/ui의 `Dialog`, `Tabs`, `Button`, `Checkbox`, `Badge` 사용. 폴링은 TanStack Query `useQuery` + `refetchInterval`.

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { trpcClient } from '@/lib/trpc';
import { useRunActionsModal } from '@/stores/run-actions-modal-store';

export function RunActionsModal() {
  const { open, runId, source, tab, closeModal, setTab } = useRunActionsModal();
  const queryClient = useQueryClient();
  const [forceMode, setForceMode] = useState(false);

  const diagQuery = useQuery({
    queryKey: ['run-diagnose', runId, source],
    queryFn: () =>
      trpcClient.subscriptions.diagnose.query({ runId: runId!, source: source as any }),
    enabled: open && !!runId && !!source,
    refetchInterval: (q) => {
      const d = q.state.data as any;
      if (!d) return 5000;
      return d.layerB && d.layerC ? false : 5000;
    },
  });

  const cancelMut = useMutation({
    mutationFn: (mode: 'graceful' | 'force') =>
      trpcClient.subscriptions.cancelRun.mutate({ runId: runId!, source: source as any, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      closeModal();
    },
  });

  const retryMut = useMutation({
    mutationFn: () =>
      trpcClient.subscriptions.retry.mutate({ runId: runId!, source: source as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      closeModal();
    },
  });

  if (!runId || !source) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) closeModal();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Run 액션{' '}
            <Badge variant="outline" className="ml-2">
              {source}
            </Badge>
          </DialogTitle>
          <div className="text-xs text-muted-foreground font-mono">{runId}</div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="diagnose">진단</TabsTrigger>
            <TabsTrigger value="cancel">중지</TabsTrigger>
            <TabsTrigger value="retry">재시도</TabsTrigger>
          </TabsList>

          <TabsContent value="diagnose" className="space-y-4">
            {diagQuery.isLoading && <Loader2 className="animate-spin" />}
            {diagQuery.data && (
              <>
                <LayerASection layerA={(diagQuery.data as any).layerA} />
                <LayerBSection layerB={(diagQuery.data as any).layerB} />
                <LayerCSection layerC={(diagQuery.data as any).layerC} />
              </>
            )}
            {diagQuery.data === null && (
              <div className="text-sm text-muted-foreground">
                아직 생성된 진단 리포트가 없습니다.
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2"
                  onClick={() =>
                    trpcClient.subscriptions.diagnose
                      .query({ runId, source: source as any, refresh: true })
                      .then(() => diagQuery.refetch())
                  }
                >
                  지금 수집
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancel" className="space-y-4">
            <p className="text-sm">
              기본은 <strong>graceful</strong> 중지입니다 — 현재 단계가 끝난 후 중단됩니다.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox id="force" checked={forceMode} onCheckedChange={(v) => setForceMode(!!v)} />
              <label htmlFor="force" className="text-sm flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                강제 중지 (active job 즉시 실패 처리, 부분 데이터 남음)
              </label>
            </div>
            <Button
              variant={forceMode ? 'destructive' : 'default'}
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate(forceMode ? 'force' : 'graceful')}
            >
              {cancelMut.isPending ? '처리 중...' : forceMode ? '강제 중지' : '중지'}
            </Button>
          </TabsContent>

          <TabsContent value="retry" className="space-y-4">
            <p className="text-sm">원본 파라미터로 새 run을 시작합니다.</p>
            <Button disabled={retryMut.isPending} onClick={() => retryMut.mutate()}>
              {retryMut.isPending ? '재시도 중...' : '재시도'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function LayerASection({ layerA }: { layerA: any }) {
  if (!layerA) return null;
  return (
    <section className="border rounded p-3 text-sm space-y-1">
      <h4 className="font-semibold">Layer A — Run 상태</h4>
      <div>
        BullMQ state: <Badge variant="outline">{layerA.bullState}</Badge> · attempts{' '}
        {layerA.attemptsMade}/{layerA.attemptsMax}
      </div>
      <div>
        부분 수집: {layerA.partialRawItemsCount} (기사 {layerA.partialRawItemsByType.article} · 영상{' '}
        {layerA.partialRawItemsByType.video} · 댓글 {layerA.partialRawItemsByType.comment})
      </div>
      {layerA.failedReason && (
        <div className="text-red-600 break-all">최근 에러: {layerA.failedReason}</div>
      )}
      {layerA.lastFetchError && (
        <div className="text-amber-600 break-all">마지막 fetch error: {layerA.lastFetchError}</div>
      )}
    </section>
  );
}

function LayerBSection({ layerB }: { layerB: any }) {
  if (!layerB) return <SkeletonBlock label="Layer B — 소스 건강도 수집 중..." />;
  return (
    <section className="border rounded p-3 text-sm space-y-1">
      <h4 className="font-semibold">Layer B — {layerB.source} 건강도 (24h)</h4>
      <div>
        총 {layerB.last24h.total} / 성공 {layerB.last24h.completed} / 실패{' '}
        {layerB.last24h.failed + layerB.last24h.blocked} (
        {Math.round(layerB.last24h.failRate * 100)}%)
      </div>
      <div>
        연속 실패 {layerB.consecutiveFailures} · rate limit {layerB.rateLimitHits}회
      </div>
      {layerB.selectorChangeSuspected && <div className="text-amber-600">⚠ 셀렉터 변경 의심</div>}
    </section>
  );
}

function LayerCSection({ layerC }: { layerC: any }) {
  if (!layerC) return <SkeletonBlock label="Layer C — 시스템 상태 수집 중..." />;
  return (
    <section className="border rounded p-3 text-sm space-y-1">
      <h4 className="font-semibold">Layer C — 시스템</h4>
      <div>
        Redis {layerC.redis.ping} ({layerC.redis.latencyMs}ms) · DB {layerC.db.ping} (
        {layerC.db.latencyMs}ms) · mem {layerC.processMemMB}MB
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        {Object.entries(layerC.queues).map(([name, q]: [string, any]) => (
          <div key={name}>
            {name}: w{q.workerCount} a{q.counts.active} w{q.counts.waiting}
          </div>
        ))}
      </div>
    </section>
  );
}

function SkeletonBlock({ label }: { label: string }) {
  return (
    <section className="border rounded p-3 text-sm text-muted-foreground flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </section>
  );
}
```

### Step 14.3: 커밋

- [ ] **커밋:**

```bash
git add apps/web/src/stores/run-actions-modal-store.ts apps/web/src/components/subscriptions/run-actions-modal.tsx
git commit -m "$(cat <<'EOF'
feat(web): RunActionsModal + Zustand 스토어 추가

진단/중지/재시도 탭을 가진 모달과 전역 상태 관리.
Layer B/C 자동 폴링, 미완료 시 스켈레톤 표시.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: UI — RunRowActions + LiveRunFeed 통합

**Files:**

- Create: `apps/web/src/components/subscriptions/run-row-actions.tsx`
- Modify: `apps/web/src/components/subscriptions/live-run-feed.tsx`

### Step 15.1: RunRowActions 작성

- [ ] **작성:** `apps/web/src/components/subscriptions/run-row-actions.tsx`

```tsx
'use client';

import { MoreVertical, Square, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRunActionsModal } from '@/stores/run-actions-modal-store';

interface Props {
  runId: string;
  source: string;
  status: string;
}

export function RunRowActions({ runId, source, status }: Props) {
  const { openModal } = useRunActionsModal();

  if (status === 'running') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7">
            <Square className="mr-1 h-3 w-3" /> 중지
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openModal(runId, source, 'cancel')}>
            Graceful 중지
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openModal(runId, source, 'cancel')}
            className="text-red-600"
          >
            강제 중지
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openModal(runId, source, 'diagnose')}>
            진단 보기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (status === 'failed' || status === 'blocked') {
    return (
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => openModal(runId, source, 'retry')}
        >
          <RotateCcw className="mr-1 h-3 w-3" /> 재시도
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={() => openModal(runId, source, 'diagnose')}
        >
          <Search className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // completed / 기타
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 opacity-60"
      onClick={() => openModal(runId, source, 'diagnose')}
    >
      <Search className="h-3 w-3" />
    </Button>
  );
}
```

### Step 15.2: LiveRunFeed에 RunRowActions 삽입

- [ ] **편집:** `apps/web/src/components/subscriptions/live-run-feed.tsx` — 각 row의 끝에 `<RunRowActions runId={run.runId} source={run.source} status={run.status} />` 추가. 기존 레이아웃에 맞춰 `flex items-center justify-between` 구조로 배치.

### Step 15.3: 모달 루트 주입

- [ ] **편집:** `apps/web/src/app/subscriptions/layout.tsx` 또는 `monitor/page.tsx` 상단에 `<RunActionsModal />` 한 번 렌더링 (Zustand 기반이라 위치 무관, 한 번만).

### Step 15.4: 커밋

- [ ] **커밋:**

```bash
git add apps/web/src/components/subscriptions/run-row-actions.tsx apps/web/src/components/subscriptions/live-run-feed.tsx apps/web/src/app/subscriptions/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): LiveRunFeed에 RunRowActions + 전역 모달 통합

상태별 중지/재시도/진단 버튼 + Zustand 기반 전역 모달 렌더.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: UI — StalledRunsBanner

**Files:**

- Create: `apps/web/src/components/subscriptions/stalled-runs-banner.tsx`
- Modify: `apps/web/src/app/subscriptions/monitor/page.tsx`

### Step 16.1: 컴포넌트

- [ ] **작성:** `apps/web/src/components/subscriptions/stalled-runs-banner.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';
import { useRunActionsModal } from '@/stores/run-actions-modal-store';

export function StalledRunsBanner() {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();
  const { openModal } = useRunActionsModal();

  const query = useQuery({
    queryKey: ['stalled-runs'],
    queryFn: () => trpcClient.subscriptions.stalled.query({ staleMinutes: 10 }),
    refetchInterval: 30_000,
  });
  const stalled = query.data ?? [];

  const cancelAllStalled = useMutation({
    mutationFn: async () => {
      for (const run of stalled) {
        await trpcClient.subscriptions.cancelRun.mutate({
          runId: run.runId,
          source: run.source as any,
          mode: 'force',
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stalled-runs'] });
      qc.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      setConfirming(false);
    },
  });

  if (stalled.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-medium">
          멈춘 것으로 의심되는 run {stalled.length}건 (10분 이상 업데이트 없음)
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? '접기' : '모두 보기'}
          </Button>
          {!confirming ? (
            <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
              모두 중지 (force)
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => cancelAllStalled.mutate()}
                disabled={cancelAllStalled.isPending}
              >
                {cancelAllStalled.isPending ? '처리 중...' : `${stalled.length}건 확정 중지`}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                취소
              </Button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <ul className="space-y-1 text-sm">
          {stalled.map((r) => (
            <li key={`${r.runId}-${r.source}`} className="flex items-center gap-2">
              <span className="font-mono text-xs opacity-70">{r.runId.slice(0, 8)}</span>
              <span>{r.source}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(r.time).toLocaleTimeString('ko-KR')}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6"
                onClick={() => openModal(r.runId, r.source, 'diagnose')}
              >
                진단
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6"
                onClick={() => openModal(r.runId, r.source, 'cancel')}
              >
                중지
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Step 16.2: 페이지에 삽입

- [ ] **편집:** `apps/web/src/app/subscriptions/monitor/page.tsx` — 실시간 상태 헤더 바로 위에 `<StalledRunsBanner />` 추가.

### Step 16.3: 커밋

- [ ] **커밋:**

```bash
git add apps/web/src/components/subscriptions/stalled-runs-banner.tsx apps/web/src/app/subscriptions/monitor/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): StalledRunsBanner 추가

10분 이상 업데이트 없는 running run을 감지해 배너로 표시,
펼치기/개별 진단/전체 force 중지 제공.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: UI — QueueStatsBar

**Files:**

- Create: `apps/web/src/components/subscriptions/queue-stats-bar.tsx`
- Modify: `apps/web/src/app/subscriptions/monitor/page.tsx`

### Step 17.1: 컴포넌트

- [ ] **작성:** `apps/web/src/components/subscriptions/queue-stats-bar.tsx`

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';

export function QueueStatsBar() {
  const { data } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => trpcClient.subscriptions.queueStatus.query(),
    refetchInterval: 10_000,
  });
  if (!data) return null;

  const entries = Object.entries(data);
  const totals = entries.reduce(
    (acc, [, q]) => ({
      waiting: acc.waiting + q.counts.waiting,
      active: acc.active + q.counts.active,
      delayed: acc.delayed + q.counts.delayed,
      failed: acc.failed + q.counts.failed,
      workers: acc.workers + q.workerCount,
    }),
    { waiting: 0, active: 0, delayed: 0, failed: 0, workers: 0 },
  );

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      <span className="font-medium">큐:</span>
      <span>workers {totals.workers}</span>
      <span>waiting {totals.waiting}</span>
      <span>active {totals.active}</span>
      <span>delayed {totals.delayed}</span>
      <span>
        failed{' '}
        <Badge variant={totals.failed > 0 ? 'destructive' : 'outline'} className="text-xs ml-0.5">
          {totals.failed}
        </Badge>
      </span>
    </div>
  );
}
```

### Step 17.2: 헤더에 삽입

- [ ] **편집:** `apps/web/src/app/subscriptions/monitor/page.tsx` — 기존 실시간 상태 헤더(68~102번째 줄 근방)의 소스 텍스트 카운트들 아래에 `<QueueStatsBar />`를 추가하거나 같은 줄에 병렬 배치.

### Step 17.3: 커밋

- [ ] **커밋:**

```bash
git add apps/web/src/components/subscriptions/queue-stats-bar.tsx apps/web/src/app/subscriptions/monitor/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): QueueStatsBar 추가 — 전체 큐 waiting/active/failed 요약

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: UI — SourcePauseControls

**Files:**

- Create: `apps/web/src/components/subscriptions/source-pause-controls.tsx`
- Modify: `apps/web/src/app/subscriptions/monitor/page.tsx`

### Step 18.1: 컴포넌트

- [ ] **작성:** `apps/web/src/components/subscriptions/source-pause-controls.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { trpcClient } from '@/lib/trpc';

const SOURCES = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;

export function SourcePauseControls() {
  const qc = useQueryClient();
  const [pausingSource, setPausingSource] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const states = useQuery({
    queryKey: ['source-states'],
    queryFn: () => trpcClient.subscriptions.sourceList.query(),
    refetchInterval: 30_000,
  });

  const pauseMut = useMutation({
    mutationFn: ({ source, reason }: { source: string; reason: string | null }) =>
      trpcClient.subscriptions.sourcePause.mutate({ source: source as any, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['source-states'] });
      setPausingSource(null);
      setReason('');
    },
  });

  const resumeMut = useMutation({
    mutationFn: (source: string) =>
      trpcClient.subscriptions.sourceResume.mutate({ source: source as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['source-states'] }),
  });

  const stateMap = new Map((states.data ?? []).map((s) => [s.source, s]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">소스 제어 (시스템 전역)</CardTitle>
        <p className="text-xs text-muted-foreground">
          구독 일시정지(개별 키워드)와 별도 — 이 스위치는 모든 구독의 해당 소스 enqueue를
          차단합니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {SOURCES.map((source) => {
          const s = stateMap.get(source);
          const paused = !!s && s.resumedAt === null;
          return (
            <div key={source} className="flex items-center gap-2 text-sm py-1">
              <span className="min-w-24">{source}</span>
              {paused ? (
                <>
                  <Badge variant="secondary">⏸ 정지됨</Badge>
                  {s?.reason && <span className="text-xs text-muted-foreground">({s.reason})</span>}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7"
                    onClick={() => resumeMut.mutate(source)}
                  >
                    <Play className="mr-1 h-3 w-3" /> 재개
                  </Button>
                </>
              ) : pausingSource === source ? (
                <>
                  <Input
                    className="h-7 text-xs"
                    placeholder="사유 (선택)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7"
                    onClick={() => pauseMut.mutate({ source, reason: reason || null })}
                  >
                    확정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => {
                      setPausingSource(null);
                      setReason('');
                    }}
                  >
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="outline">● 활성</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7"
                    onClick={() => setPausingSource(source)}
                  >
                    <Pause className="mr-1 h-3 w-3" /> 일시정지
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

### Step 18.2: 페이지에 삽입

- [ ] **편집:** `monitor/page.tsx` 하단(SourceRunStats 아래)에 `<SourcePauseControls />` 추가.

### Step 18.3: 커밋

- [ ] **커밋:**

```bash
git add apps/web/src/components/subscriptions/source-pause-controls.tsx apps/web/src/app/subscriptions/monitor/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): SourcePauseControls 추가

시스템 전역 소스 일시정지/재개 카드. subscriptions.pause와 구별됨.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: UI — 전체 긴급 정지 / 구독 단위 중지

**Files:**

- Create: `apps/web/src/components/subscriptions/cancel-all-dialog.tsx`
- Modify: `apps/web/src/app/subscriptions/monitor/page.tsx`
- Modify: `apps/web/src/app/subscriptions/[id]/page.tsx`

### Step 19.1: CANCEL_ALL 다이얼로그

- [ ] **작성:** `apps/web/src/components/subscriptions/cancel-all-dialog.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpcClient } from '@/lib/trpc';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CancelAllDialog({ open, onOpenChange }: Props) {
  const [input, setInput] = useState('');
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      trpcClient.subscriptions.cancelAll.mutate({ mode: 'force', confirm: 'CANCEL_ALL' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription-runs-monitor'] });
      onOpenChange(false);
      setInput('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> 전체 긴급 정지
          </DialogTitle>
          <DialogDescription>
            모든 활성 수집 작업이 즉시 force 모드로 중단됩니다. 부분 수집된 데이터는 남습니다.
            계속하려면 <code className="font-mono bg-muted px-1">CANCEL_ALL</code> 을 입력하세요.
          </DialogDescription>
        </DialogHeader>
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="CANCEL_ALL" />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              setInput('');
            }}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={input !== 'CANCEL_ALL' || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? '처리 중...' : '전체 긴급 정지'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 19.2: 모니터 페이지에 kebab 메뉴

- [ ] **편집:** `monitor/page.tsx` — 페이지 제목 옆에 `...` 메뉴 추가, [전체 긴급 정지] 항목이 `<CancelAllDialog>` 열도록.

### Step 19.3: 구독 상세 페이지에 [이 구독 중지]

- [ ] **편집:** `apps/web/src/app/subscriptions/[id]/page.tsx` — 실행 이력 헤더에 버튼 추가. 기본은 graceful, 확인 모달 후 `subscriptions.cancelBySubscription.mutate({ subscriptionId, mode: 'graceful' })`.

### Step 19.4: 커밋

- [ ] **커밋:**

```bash
git add apps/web/src/components/subscriptions/cancel-all-dialog.tsx apps/web/src/app/subscriptions/monitor/page.tsx apps/web/src/app/subscriptions/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): 전체 긴급 정지 + 구독 단위 중지 UI 추가

CANCEL_ALL 타이핑 확인, 모니터 페이지 kebab 메뉴,
구독 상세 페이지 [이 구독 중지] 버튼.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: 통합 검증 및 문서 업데이트

**Files:**

- Modify: `CLAUDE.md` (간단한 운영 절차 한 줄 추가)
- Create: `apps/collector/README.md` 섹션 혹은 기존 운영 문서 업데이트

### Step 20.1: 전체 빌드

- [ ] **실행:** `pnpm -C apps/collector build && pnpm -C apps/web build`
- [ ] **기대:** 모두 통과.

### Step 20.2: 전체 테스트

- [ ] **실행:** `pnpm -C apps/collector vitest run`
- [ ] **기대:** 모든 테스트 PASS.

### Step 20.3: 로컬 통합 수동 검증 체크리스트

- [ ] collector DB 마이그레이션 확인 (`\dt` 로 4개 테이블)
- [ ] collector API 서버 기동 (`pnpm -C apps/collector dev`)
- [ ] collector diagnostics worker 기동 (`pnpm -C apps/collector exec tsx src/diagnostics/worker.ts`)
- [ ] web 개발 서버 (`pnpm -C apps/web dev`)
- [ ] 모니터 페이지(`/subscriptions/monitor`) 접속 → StalledRunsBanner, QueueStatsBar, SourcePauseControls 렌더 확인
- [ ] 실행 중 run을 graceful 중지 → status가 cancelling → worker 체크포인트에서 감지 → cancelled로 최종 전이
- [ ] 실패한 run을 재시도 → 새 runId의 새 job enqueue
- [ ] 소스 일시정지 → scanner/triggerNow skip 로그 확인, 재개 후 정상 복귀

### Step 20.4: CLAUDE.md 업데이트

- [ ] **편집:** 메인 `CLAUDE.md`의 Debugging 섹션에 한 줄 추가:

```
- 진행 중 run 중지·진단: 모니터 페이지 각 row의 [중지]/진단 모달 사용. DB 수동 조작 금지 (run_cancellations 테이블이 단일 진실)
```

### Step 20.5: 최종 커밋

- [ ] **커밋:**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: run 중지·진단 운영 절차를 디버깅 가이드에 추가

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review 결과

스펙(v2) 대비 계획 커버리지 점검:

| 스펙 섹션                                 | 구현 태스크                           |
| ----------------------------------------- | ------------------------------------- |
| 4.1 run_cancellations                     | Task 1.1                              |
| 4.2 run_diagnostics                       | Task 1.2                              |
| 4.3 run_retry_links                       | Task 1.3                              |
| 4.4 source_pause_state                    | Task 1.4                              |
| 5.1 cancelRun                             | Task 10                               |
| 5.2 retryRun                              | Task 10                               |
| 5.3 worker 체크포인트                     | Task 3 + Task 4                       |
| 5.4 Layer A                               | Task 6                                |
| 5.5 Layer B                               | Task 7                                |
| 5.6 Layer C                               | Task 8                                |
| 5.7 Stalled 감지                          | Task 11 (runs.stalled) + Task 16 (UI) |
| 5.8 소스 일시정지                         | Task 5 + Task 12 (sources 라우터)     |
| 6.1 collector tRPC                        | Task 11 + Task 12                     |
| 6.2 web tRPC 프록시                       | Task 13                               |
| 7.1 RunRowActions                         | Task 15                               |
| 7.2 RunActionsModal                       | Task 14                               |
| 7.3 StalledRunsBanner                     | Task 16                               |
| 7.4 QueueStatsBar                         | Task 17                               |
| 7.5 SourcePauseControls                   | Task 18                               |
| 7.6 전체 긴급 정지 / 구독 단위 중지       | Task 19                               |
| 마스킹 (섹션 10 보안)                     | Task 2                                |
| 진단 escalate-to-force (섹션 8 10분 승격) | Task 9 (diagnostics worker)           |

모든 스펙 요구사항이 태스크에 매핑됨. 타입 일관성 (`cancelRun`/`retryRun` 시그니처, `CancelMode`, `LayerA/B/C` 타입)은 전 태스크에서 동일하게 유지됨.
