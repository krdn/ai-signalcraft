# 파이프라인 단계별 브레이크포인트 + 워커 헬스 모니터링 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 파이프라인 6단계 + AI 분석 내부 Stage 경계에서 사전 선택한 브레이크포인트로 자동 정지·검수·재개하는 기능과, 워커 헬스 가시성을 추가한다.

**Architecture:** 기존 `waitIfPaused` polling 패턴을 확장한 단일 게이트 함수 `awaitStageGate`로 6+1 게이트를 구현. DB의 `collection_jobs` 테이블에 `breakpoints/pausedAt/pausedAtStage/resumeMode` 4개 컬럼을 추가하고, BullMQ `Queue.getWorkers()` 기반 헬스 API를 추가. UI는 trigger-form 사전 설정 + stage-flow 인라인 제어 + admin 헤더 워커 배지로 구성.

**Tech Stack:** Drizzle ORM, BullMQ, tRPC v11, React 19, Next.js 15, Vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-04-09-pipeline-breakpoints-design.md`

---

## File Structure

### 신규 파일 (8개)

- `packages/core/src/types/breakpoints.ts` — `BreakpointStage` 타입 + 상수
- `packages/core/src/pipeline/expire-paused.ts` — 시간당 만료 cron
- `packages/core/src/queue/worker-health.ts` — `getWorkerStatus` 헬퍼
- `apps/web/src/components/admin/worker-health-badge.tsx` — 헤더 배지
- `apps/web/src/components/admin/worker-health-modal.tsx` — 상세 모달
- `apps/web/src/components/analysis/pipeline-monitor/breakpoint-control.tsx` — 인라인 정지 제어 패널
- `apps/web/src/components/analysis/trigger-form/breakpoint-section.tsx` — 사전 BP 설정 섹션
- `packages/core/src/pipeline/__tests__/await-stage-gate.test.ts` — 게이트 단위 테스트

### 수정 파일 (12개)

- `packages/core/src/db/schema/collections.ts` — 4개 컬럼 + 인덱스
- `packages/core/src/pipeline/pipeline-checks.ts` — `awaitStageGate` 추가
- `packages/core/src/pipeline/control.ts` — `resumePipelineWithMode`, `runToEnd`, `updateBreakpoints`
- `packages/core/src/pipeline/index.ts` — exports
- `packages/core/src/analysis/pipeline-orchestrator.ts` — 5개 게이트 삽입
- `packages/core/src/queue/pipeline-worker.ts` — collection/normalize 게이트 2개
- `packages/core/src/queue/worker-config.ts` — 프로세스 핸들러 + cron 부트스트랩
- `apps/web/src/server/trpc/routers/analysis.ts` — `resume`, `runToEnd`, `updateBreakpoints` + trigger 확장
- `apps/web/src/server/trpc/routers/admin/index.ts` — `workerStatus`
- `apps/web/src/components/analysis/trigger-form.tsx` — BP 섹션 삽입
- `apps/web/src/components/analysis/pipeline-monitor/stage-flow.tsx` — BP 시각화 + 클릭 토글
- `apps/web/src/app/admin/layout.tsx` — 헤더 배지 삽입

---

## Task 1: BreakpointStage 타입 정의

**Files:**

- Create: `packages/core/src/types/breakpoints.ts`
- Modify: `packages/core/src/types/index.ts`

- [ ] **Step 1: 타입 파일 생성**

`packages/core/src/types/breakpoints.ts`:

```typescript
// 파이프라인 단계 브레이크포인트 — 사전 선택 시 해당 단계 완료 후 자동 정지
export const BREAKPOINT_STAGES = [
  'collection',
  'normalize',
  'token-optimization',
  'item-analysis',
  'analysis-stage1',
  'analysis-stage2',
  'analysis-stage4',
] as const;

export type BreakpointStage = (typeof BREAKPOINT_STAGES)[number];

export const BREAKPOINT_STAGE_LABELS: Record<BreakpointStage, string> = {
  collection: '수집 완료 후',
  normalize: '정규화 완료 후',
  'token-optimization': '토큰 최적화 완료 후',
  'item-analysis': '개별 감정 분석 완료 후',
  'analysis-stage1': 'AI 분석 Stage 1 완료 후 (병렬 4모듈)',
  'analysis-stage2': 'AI 분석 Stage 2 완료 후 (전략·최종요약)',
  'analysis-stage4': 'AI 분석 Stage 4 완료 후 (고급 분석)',
};

export type ResumeMode = 'continue' | 'step-once';
```

- [ ] **Step 2: index.ts에서 export**

`packages/core/src/types/index.ts` 끝에 추가:

```typescript
export * from './breakpoints';
```

- [ ] **Step 3: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/types/breakpoints.ts packages/core/src/types/index.ts
git commit -m "feat: BreakpointStage 타입 및 라벨 상수 정의"
```

---

## Task 2: DB 스키마 컬럼 추가

**Files:**

- Modify: `packages/core/src/db/schema/collections.ts:17-60`

- [ ] **Step 1: 컬럼 4개 추가**

`packages/core/src/db/schema/collections.ts`의 `collectionJobs` 정의에 `costLimitUsd` 다음 줄에 추가:

```typescript
    // 단계별 브레이크포인트 — 사전 선택 시 해당 단계 완료 후 자동 정지
    breakpoints: jsonb('breakpoints').$type<string[]>().default([]),
    pausedAt: timestamp('paused_at'),
    pausedAtStage: text('paused_at_stage'),
    resumeMode: text('resume_mode', { enum: ['continue', 'step-once'] }),
```

- [ ] **Step 2: 인덱스 추가**

같은 파일의 `(table) => [...]` 배열에 추가:

```typescript
    index('collection_jobs_paused_at_idx').on(table.pausedAt),
```

- [ ] **Step 3: DB push 실행**

Run: `pnpm db:push`
Expected: 성공 메시지, `breakpoints/paused_at/paused_at_stage/resume_mode` 4개 컬럼이 추가됨

- [ ] **Step 4: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/db/schema/collections.ts
git commit -m "feat: collection_jobs에 브레이크포인트 컬럼 추가"
```

---

## Task 3: awaitStageGate 게이트 함수 — 단위 테스트 작성

**Files:**

- Create: `packages/core/src/pipeline/__tests__/await-stage-gate.test.ts`

- [ ] **Step 1: 테스트 파일 생성 (실패 케이스)**

`packages/core/src/pipeline/__tests__/await-stage-gate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BreakpointStage } from '../../types/breakpoints';

// DB 모킹
const mockJob = {
  status: 'running' as string,
  breakpoints: [] as string[],
  resumeMode: null as string | null,
  pausedAt: null as Date | null,
};

vi.mock('../../db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ ...mockJob }]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  }),
}));

vi.mock('./persist', () => ({
  appendJobEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockJob.status = 'running';
  mockJob.breakpoints = [];
  mockJob.resumeMode = null;
  mockJob.pausedAt = null;
});

describe('awaitStageGate', () => {
  it('breakpoints에 포함되지 않은 stage는 즉시 통과', async () => {
    const { awaitStageGate } = await import('../pipeline-checks');
    mockJob.breakpoints = ['analysis-stage1'];
    const result = await awaitStageGate(1, 'collection');
    expect(result).toBe(true);
  });

  it('breakpoints에 포함된 stage는 paused 상태에서 polling, running 복귀 시 통과', async () => {
    const { awaitStageGate } = await import('../pipeline-checks');
    mockJob.breakpoints = ['collection'];
    // 첫 polling은 paused, 두 번째에 running으로 복귀하도록 시뮬레이션
    let pollCount = 0;
    vi.doMock('../../db', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                pollCount += 1;
                return Promise.resolve([
                  pollCount === 1
                    ? { ...mockJob, status: 'paused' }
                    : { ...mockJob, status: 'running' },
                ]);
              },
            }),
          }),
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      }),
    }));
    // re-import after mock
    vi.resetModules();
    const { awaitStageGate: gate2 } = await import('../pipeline-checks');
    const result = await gate2(1, 'collection');
    expect(result).toBe(true);
  });

  it('cancelled 상태로 바뀌면 false 반환', async () => {
    vi.resetModules();
    vi.doMock('../../db', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ ...mockJob, status: 'cancelled' }]),
            }),
          }),
        }),
        update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      }),
    }));
    const { awaitStageGate } = await import('../pipeline-checks');
    mockJob.breakpoints = ['collection'];
    const result = await awaitStageGate(1, 'collection');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd packages/core && pnpm vitest run src/pipeline/__tests__/await-stage-gate.test.ts`
Expected: FAIL (`awaitStageGate is not exported`)

- [ ] **Step 3: 커밋 (red phase)**

```bash
git add packages/core/src/pipeline/__tests__/await-stage-gate.test.ts
git commit -m "test: awaitStageGate 게이트 함수 단위 테스트"
```

---

## Task 4: awaitStageGate 구현

**Files:**

- Modify: `packages/core/src/pipeline/pipeline-checks.ts`

- [ ] **Step 1: 함수 추가**

`packages/core/src/pipeline/pipeline-checks.ts` 파일 끝에 추가:

```typescript
import type { BreakpointStage } from '../types/breakpoints';
import { appendJobEvent } from './persist';

// step-once 메모리 플래그 — 다음 게이트 호출 시 강제 정지
const pendingStepStop = new Map<number, boolean>();

const POLL_SCHEDULE: Array<{ intervalMs: number; count: number }> = [
  { intervalMs: 3000, count: 10 }, // 0~30s: 즉시 재개 대비
  { intervalMs: 10000, count: 30 }, // 30s~5.5m
  { intervalMs: 60000, count: 1437 }, // 5.5m~24h
];

/**
 * 단계 경계 게이트 — breakpoints에 포함되면 paused로 전환 후 polling 대기.
 * @returns true=계속 진행, false=취소되거나 24h 초과
 */
export async function awaitStageGate(jobId: number, stageName: BreakpointStage): Promise<boolean> {
  const db = getDb();

  // 현재 잡 상태 조회
  const [jobRow] = await db
    .select({
      status: collectionJobs.status,
      breakpoints: collectionJobs.breakpoints,
      resumeMode: collectionJobs.resumeMode,
    })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!jobRow) return false;
  if (jobRow.status === 'cancelled') return false;

  const breakpoints = (jobRow.breakpoints as string[]) ?? [];
  const stepStop = pendingStepStop.get(jobId) === true;
  const shouldStop = stepStop || breakpoints.includes(stageName);

  if (!shouldStop) return true;

  // step-once 1회 발동 후 플래그 클리어
  pendingStepStop.delete(jobId);

  // paused 상태로 전환
  const now = new Date();
  await db
    .update(collectionJobs)
    .set({
      status: 'paused',
      pausedAt: now,
      pausedAtStage: stageName,
      resumeMode: null,
      updatedAt: now,
    })
    .where(eq(collectionJobs.id, jobId));

  await appendJobEvent(
    jobId,
    'info',
    `브레이크포인트: ${stageName} 완료 후 정지 (24시간 내 재개하지 않으면 자동 취소)`,
  ).catch(() => {});

  // 적응형 polling
  for (const phase of POLL_SCHEDULE) {
    for (let i = 0; i < phase.count; i++) {
      await new Promise((resolve) => setTimeout(resolve, phase.intervalMs));

      const [current] = await db
        .select({
          status: collectionJobs.status,
          resumeMode: collectionJobs.resumeMode,
        })
        .from(collectionJobs)
        .where(eq(collectionJobs.id, jobId))
        .limit(1);

      if (!current) return false;
      if (current.status === 'cancelled') return false;

      if (current.status === 'running') {
        // pausedAt/pausedAtStage 클리어
        await db
          .update(collectionJobs)
          .set({ pausedAt: null, pausedAtStage: null, updatedAt: new Date() })
          .where(eq(collectionJobs.id, jobId));

        // step-once이면 다음 게이트에서 다시 정지
        if (current.resumeMode === 'step-once') {
          pendingStepStop.set(jobId, true);
          await db
            .update(collectionJobs)
            .set({ resumeMode: null })
            .where(eq(collectionJobs.id, jobId));
        }

        await appendJobEvent(jobId, 'info', `브레이크포인트 재개: ${stageName}`).catch(() => {});
        return true;
      }
    }
  }

  // 24h 초과 → 자동 취소
  const { cancelPipeline } = await import('./control');
  await cancelPipeline(jobId);
  await appendJobEvent(
    jobId,
    'warn',
    '브레이크포인트 24시간 초과 — 작업이 자동 취소되었습니다',
  ).catch(() => {});
  return false;
}
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `cd packages/core && pnpm vitest run src/pipeline/__tests__/await-stage-gate.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 3: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/pipeline/pipeline-checks.ts
git commit -m "feat: awaitStageGate 단계 게이트 함수 구현 (적응형 polling)"
```

---

## Task 5: control.ts 확장 — resume/runToEnd/updateBreakpoints

**Files:**

- Modify: `packages/core/src/pipeline/control.ts`
- Modify: `packages/core/src/pipeline/index.ts`

- [ ] **Step 1: control.ts에 함수 3개 추가**

파일 끝에 추가:

```typescript
import type { ResumeMode } from '../types/breakpoints';

/**
 * 브레이크포인트 정지 상태에서 모드 지정 재개
 * - 'continue': 다음 BP까지 진행
 * - 'step-once': 한 단계만 실행 후 다시 정지
 */
export async function resumePipelineWithMode(
  jobId: number,
  mode: ResumeMode,
): Promise<{ resumed: boolean; message: string }> {
  const db = getDb();
  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { resumed: false, message: '작업을 찾을 수 없습니다' };
  if (job.status !== 'paused') {
    return { resumed: false, message: `현재 ${job.status} 상태에서는 재개할 수 없습니다` };
  }
  await db
    .update(collectionJobs)
    .set({ status: 'running', resumeMode: mode, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));
  return { resumed: true, message: `재개됨 (${mode})` };
}

/** 모든 BP를 무시하고 끝까지 실행 */
export async function runToEndPipeline(
  jobId: number,
): Promise<{ resumed: boolean; message: string }> {
  const db = getDb();
  await db
    .update(collectionJobs)
    .set({
      status: 'running',
      breakpoints: [],
      resumeMode: null,
      pausedAt: null,
      pausedAtStage: null,
      updatedAt: new Date(),
    })
    .where(eq(collectionJobs.id, jobId));
  return { resumed: true, message: '모든 브레이크포인트를 무시하고 끝까지 진행합니다' };
}

/** 실행 중에 브레이크포인트 목록 변경 */
export async function updateBreakpoints(
  jobId: number,
  breakpoints: string[],
): Promise<{ updated: boolean; message: string }> {
  const db = getDb();
  await db
    .update(collectionJobs)
    .set({ breakpoints, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));
  return { updated: true, message: '브레이크포인트가 업데이트되었습니다' };
}
```

- [ ] **Step 2: index.ts에서 export**

`packages/core/src/pipeline/index.ts`에 추가 (없으면):

```typescript
export { resumePipelineWithMode, runToEndPipeline, updateBreakpoints } from './control';
export { awaitStageGate } from './pipeline-checks';
```

- [ ] **Step 3: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/pipeline/control.ts packages/core/src/pipeline/index.ts
git commit -m "feat: resumePipelineWithMode/runToEndPipeline/updateBreakpoints 추가"
```

---

## Task 6: pipeline-orchestrator에 게이트 5곳 삽입

**Files:**

- Modify: `packages/core/src/analysis/pipeline-orchestrator.ts`

- [ ] **Step 1: import 추가**

파일 상단 import 블록에 추가:

```typescript
import { awaitStageGate } from '../pipeline/pipeline-checks';
```

- [ ] **Step 2: 토큰 최적화 게이트 (token-optimization)**

`pipeline-orchestrator.ts`의 토큰 최적화 try/catch 블록 직후, "Stage 0: 개별 항목 분석" 주석 직전에 추가:

```typescript
// BP 게이트: 토큰 최적화 완료 후
if (!(await awaitStageGate(jobId, 'token-optimization'))) {
  cancelledByUser = true;
  return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
}
```

- [ ] **Step 3: item-analysis 게이트**

Stage 1 진입 전 `if (!(await preRunCheck()))` 직전에 추가 (itemAnalysisPromise는 별도 promise이므로 여기 게이트는 itemAnalysisPromise await 후 위치):

기존:

```typescript
  // Stage 1: 병렬 실행
  if (!(await preRunCheck())) {
```

수정:

```typescript
  // BP 게이트: 개별 감정 분석 완료 후 (itemAnalysisPromise는 Stage1과 병렬이므로 여기서 await)
  await itemAnalysisPromise;
  if (!(await awaitStageGate(jobId, 'item-analysis'))) {
    cancelledByUser = true;
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 1: 병렬 실행
  if (!(await preRunCheck())) {
```

그리고 Stage 1 실행 시 `Promise.all([itemAnalysisPromise, runWithProviderGrouping(...)])`를 단일 호출로 변경:

```typescript
const stage1Results = await runWithProviderGrouping(
  stage1Active,
  (m) => runModuleMapReduce(m, input),
  providerConcurrency,
);
collectResults(stage1Results);
```

(itemAnalysisPromise는 위에서 이미 await됨)

- [ ] **Step 4: analysis-stage1 게이트**

`if (checkFailAndAbort('Stage 1'))` 다음 줄, `// Stage 2:` 주석 직전에 추가:

```typescript
// BP 게이트: AI 분석 Stage 1 완료 후
if (!(await awaitStageGate(jobId, 'analysis-stage1'))) {
  cancelledByUser = true;
  return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
}
```

- [ ] **Step 5: analysis-stage2 게이트**

`if (checkFailAndAbort('Stage 3'))` 다음 줄, `// Stage 4:` 주석 직전에 추가:

```typescript
// BP 게이트: AI 분석 Stage 2/3 완료 후
if (!(await awaitStageGate(jobId, 'analysis-stage2'))) {
  cancelledByUser = true;
  return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
}
```

- [ ] **Step 6: analysis-stage4 게이트**

Stage 4 블록의 마지막 `}` 직후, `// 리포트 생성` 주석 직전에 추가:

```typescript
// BP 게이트: AI 분석 Stage 4 완료 후
if (!(await awaitStageGate(jobId, 'analysis-stage4'))) {
  cancelledByUser = true;
  return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
}
```

- [ ] **Step 7: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 8: 커밋**

```bash
git add packages/core/src/analysis/pipeline-orchestrator.ts
git commit -m "feat: pipeline-orchestrator에 5개 BP 게이트 삽입"
```

---

## Task 7: pipeline-worker에 collection/normalize 게이트 2곳 삽입

**Files:**

- Modify: `packages/core/src/queue/pipeline-worker.ts`

- [ ] **Step 1: persist job 위치 확인**

Run: `grep -n "name === 'persist'\|case 'persist'" packages/core/src/queue/pipeline-worker.ts`
Expected: persist 처리 분기 라인 출력

- [ ] **Step 2: persist job 시작부에 collection 게이트 추가**

persist 분기 진입부 (children 완료 후 실행되는 지점), `await isPipelineCancelled` 체크 다음에 추가:

```typescript
// BP 게이트: 수집 완료 후 (모든 children 완료 후 persist 진입 전)
const { awaitStageGate } = await import('../pipeline/pipeline-checks');
if (dbJobId && !(await awaitStageGate(dbJobId, 'collection'))) {
  return { cancelled: true };
}
```

- [ ] **Step 3: persist 본체 완료 후 normalize 게이트 추가**

persist의 DB 저장 로직이 끝난 직후, `triggerAnalysis(dbJobId, ...)` 호출 직전에 추가:

```typescript
// BP 게이트: 정규화 완료 후 (analysis 트리거 직전)
if (dbJobId && !(await awaitStageGate(dbJobId, 'normalize'))) {
  return { cancelled: true };
}
```

- [ ] **Step 4: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/queue/pipeline-worker.ts
git commit -m "feat: pipeline-worker persist에 collection/normalize BP 게이트 추가"
```

---

## Task 8: expirePausedJobs 만료 cron

**Files:**

- Create: `packages/core/src/pipeline/expire-paused.ts`
- Modify: `packages/core/src/pipeline/index.ts`

- [ ] **Step 1: expire-paused.ts 작성**

```typescript
// 24시간 초과 paused 잡 자동 취소 cron — 1차 in-process timeout 안전망
import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { cancelPipeline } from './control';
import { appendJobEvent } from './persist';

export async function expirePausedJobs(): Promise<number> {
  const db = getDb();
  const expired = await db
    .select({ id: collectionJobs.id })
    .from(collectionJobs)
    .where(
      and(
        eq(collectionJobs.status, 'paused'),
        lt(collectionJobs.pausedAt, sql`now() - interval '24 hours'`),
      ),
    );

  for (const { id } of expired) {
    try {
      await cancelPipeline(id);
      await appendJobEvent(id, 'warn', '24시간 정지 초과로 자동 취소되었습니다 (cron)').catch(
        () => {},
      );
    } catch (error) {
      console.error(`[expire-paused] 잡 ${id} 취소 실패:`, error);
    }
  }
  return expired.length;
}

let cronHandle: NodeJS.Timeout | null = null;

export function startExpirePausedCron(intervalMs = 60 * 60 * 1000) {
  if (cronHandle) return;
  cronHandle = setInterval(() => {
    expirePausedJobs().catch((err) => {
      console.error('[expire-paused] cron 실행 실패:', err);
    });
  }, intervalMs);
  console.log('[expire-paused] cron 시작 (1시간 주기)');
}

export function stopExpirePausedCron() {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
```

- [ ] **Step 2: index.ts export 추가**

```typescript
export { expirePausedJobs, startExpirePausedCron, stopExpirePausedCron } from './expire-paused';
```

- [ ] **Step 3: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/pipeline/expire-paused.ts packages/core/src/pipeline/index.ts
git commit -m "feat: 24시간 초과 paused 잡 자동 취소 cron 추가"
```

---

## Task 9: 워커 헬스 헬퍼 + 프로세스 강화

**Files:**

- Create: `packages/core/src/queue/worker-health.ts`
- Modify: `packages/core/src/queue/worker-config.ts`

- [ ] **Step 1: worker-health.ts 작성**

```typescript
// BullMQ Queue.getWorkers() 기반 워커 헬스 조회
import { getQueue } from '../pipeline/queue-management';

export type WorkerHealth = 'healthy' | 'idle' | 'stuck' | 'down' | 'warn';

export interface QueueHealth {
  queue: string;
  workerCount: number;
  workers: Array<{
    id: string;
    addr: string;
    started: number;
    idle: number;
  }>;
  counts: {
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
    paused: number;
  };
  isPaused: boolean;
  health: WorkerHealth;
}

function deriveHealth(
  workerCount: number,
  counts: { active: number; waiting: number; delayed: number },
  workers: Array<{ idle: number }>,
): WorkerHealth {
  if (workerCount === 0) return 'down';
  if (counts.active > 0) {
    if (workers.some((w) => w.idle < 60_000)) return 'healthy';
    return 'warn';
  }
  if (counts.waiting > 0 || counts.delayed > 0) return 'stuck';
  return 'idle';
}

export async function getWorkerStatus(): Promise<QueueHealth[]> {
  const queueNames = ['collectors', 'pipeline', 'analysis'] as const;
  const result: QueueHealth[] = [];

  for (const name of queueNames) {
    try {
      const queue = getQueue(name);
      const rawWorkers = await queue.getWorkers();
      const workers = rawWorkers.map((w) => ({
        id: String(w.id ?? ''),
        addr: String(w.addr ?? ''),
        started: Number(w.started ?? 0),
        idle: Number(w.idle ?? 0),
      }));
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'paused');
      const isPaused = await queue.isPaused();
      result.push({
        queue: name,
        workerCount: workers.length,
        workers,
        counts: {
          active: counts.active ?? 0,
          waiting: counts.waiting ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          paused: counts.paused ?? 0,
        },
        isPaused,
        health: deriveHealth(workers.length, counts as never, workers),
      });
    } catch (error) {
      console.error(`[worker-health] ${name} 큐 상태 조회 실패:`, error);
      result.push({
        queue: name,
        workerCount: 0,
        workers: [],
        counts: { active: 0, waiting: 0, delayed: 0, failed: 0, paused: 0 },
        isPaused: false,
        health: 'down',
      });
    }
  }
  return result;
}
```

- [ ] **Step 2: worker-config.ts에 프로세스 핸들러 + cron 부트스트랩 추가**

`worker-config.ts` 파일 끝에 추가 (없으면):

```typescript
import { startExpirePausedCron } from '../pipeline/expire-paused';

export function setupWorkerProcess() {
  process.on('uncaughtException', (err) => {
    console.error('[worker] FATAL uncaughtException:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    console.error('[worker] FATAL unhandledRejection:', err);
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    console.log('[worker] SIGTERM 수신 — graceful shutdown');
    setTimeout(() => process.exit(0), 5000);
  });

  startExpirePausedCron();
}
```

- [ ] **Step 3: 워커 부트스트랩에서 setupWorkerProcess() 호출**

워커 진입점(예: `apps/web/scripts/worker.ts` 또는 `packages/core/src/queue/workers.ts` 의 상위 호출자)을 찾아 호출:

Run: `grep -rn "createCollectorsWorker\|createPipelineWorker\|createAnalysisWorker" packages/core/src apps/web/scripts 2>/dev/null | head`

찾은 진입점 파일 상단에 추가:

```typescript
import { setupWorkerProcess } from '@ai-signalcraft/core';
setupWorkerProcess();
```

(또는 packages/core에서 export 후 import)

- [ ] **Step 4: 빌드 검증**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/queue/worker-health.ts packages/core/src/queue/worker-config.ts
git commit -m "feat: 워커 헬스 조회 + 프로세스 핸들러 + cron 부트스트랩"
```

---

## Task 10: tRPC analysis 라우터 확장

**Files:**

- Modify: `apps/web/src/server/trpc/routers/analysis.ts`

- [ ] **Step 1: trigger 입력에 breakpoints 필드 추가**

`trigger` procedure의 zod 입력 스키마에 추가:

```typescript
        breakpoints: z
          .array(
            z.enum([
              'collection',
              'normalize',
              'token-optimization',
              'item-analysis',
              'analysis-stage1',
              'analysis-stage2',
              'analysis-stage4',
            ]),
          )
          .default([]),
```

그리고 `collectionJobs.insert().values()`에 추가:

```typescript
          breakpoints: input.breakpoints,
```

- [ ] **Step 2: resume mutation 추가**

```typescript
import { resumePipelineWithMode, runToEndPipeline, updateBreakpoints } from '@ai-signalcraft/core';

  resume: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        mode: z.enum(['continue', 'step-once']),
      }),
    )
    .mutation(async ({ input }) => {
      return await resumePipelineWithMode(input.jobId, input.mode);
    }),

  runToEnd: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      return await runToEndPipeline(input.jobId);
    }),

  updateBreakpoints: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        breakpoints: z.array(
          z.enum([
            'collection',
            'normalize',
            'token-optimization',
            'item-analysis',
            'analysis-stage1',
            'analysis-stage2',
            'analysis-stage4',
          ]),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      return await updateBreakpoints(input.jobId, input.breakpoints);
    }),
```

- [ ] **Step 3: 빌드 검증**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/server/trpc/routers/analysis.ts
git commit -m "feat: analysis 라우터에 resume/runToEnd/updateBreakpoints + trigger BP 추가"
```

---

## Task 11: tRPC admin 라우터 — workerStatus

**Files:**

- Modify: `apps/web/src/server/trpc/routers/admin/index.ts`

- [ ] **Step 1: workerStatus query 추가**

```typescript
import { getWorkerStatus } from '@ai-signalcraft/core';

  workerStatus: protectedProcedure.query(async () => {
    return await getWorkerStatus();
  }),
```

`@ai-signalcraft/core`에서 `getWorkerStatus`를 export해야 합니다. `packages/core/src/index.ts`에 추가:

```typescript
export { getWorkerStatus } from './queue/worker-health';
export type { QueueHealth, WorkerHealth } from './queue/worker-health';
```

- [ ] **Step 2: 빌드 검증**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/server/trpc/routers/admin/index.ts packages/core/src/index.ts
git commit -m "feat: admin 라우터에 workerStatus query 추가"
```

---

## Task 12: trigger-form에 BP 사전 설정 섹션

**Files:**

- Create: `apps/web/src/components/analysis/trigger-form/breakpoint-section.tsx`
- Modify: `apps/web/src/components/analysis/trigger-form.tsx`

- [ ] **Step 1: breakpoint-section.tsx 작성**

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Bookmark } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const STAGES = [
  { value: 'collection', label: '수집 완료 후' },
  { value: 'normalize', label: '정규화 완료 후' },
  { value: 'token-optimization', label: '토큰 최적화 완료 후' },
  { value: 'item-analysis', label: '개별 감정 분석 완료 후' },
  { value: 'analysis-stage1', label: 'AI 분석 Stage 1 완료 후 (병렬 4모듈)' },
  { value: 'analysis-stage2', label: 'AI 분석 Stage 2 완료 후 (전략·최종요약)' },
  { value: 'analysis-stage4', label: 'AI 분석 Stage 4 완료 후 (고급 분석)' },
] as const;

export type BreakpointValue = (typeof STAGES)[number]['value'];

interface Props {
  value: BreakpointValue[];
  onChange: (next: BreakpointValue[]) => void;
}

export function BreakpointSection({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function toggle(stage: BreakpointValue) {
    if (value.includes(stage)) {
      onChange(value.filter((s) => s !== stage));
    } else {
      onChange([...value, stage]);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Bookmark className="h-4 w-4" />
          단계별 검수 정지 (선택)
          {value.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {value.length}개 설정됨
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {STAGES.map((stage) => (
            <div key={stage.value} className="flex items-center gap-2">
              <Checkbox
                id={`bp-${stage.value}`}
                checked={value.includes(stage.value)}
                onCheckedChange={() => toggle(stage.value)}
              />
              <Label htmlFor={`bp-${stage.value}`} className="cursor-pointer text-sm font-normal">
                {stage.label}
              </Label>
            </div>
          ))}
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            💡 체크한 단계가 끝나면 자동 정지되며, 검수 후 [다음 단계 실행] 버튼으로 재개합니다.
            24시간 내 재개하지 않으면 자동 취소됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: trigger-form.tsx에 통합**

`trigger-form.tsx` 상단 import에 추가:

```typescript
import { BreakpointSection, type BreakpointValue } from './trigger-form/breakpoint-section';
```

state 추가 (다른 useState 옆):

```typescript
const [breakpoints, setBreakpoints] = useState<BreakpointValue[]>([]);
```

폼 제출(triggerMutation.mutate) 시 payload에 추가:

```typescript
breakpoints,
```

JSX에서 옵션 섹션 근처에 삽입:

```tsx
<BreakpointSection value={breakpoints} onChange={setBreakpoints} />
```

- [ ] **Step 3: 빌드 검증**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form/breakpoint-section.tsx apps/web/src/components/analysis/trigger-form.tsx
git commit -m "feat: trigger-form에 단계별 검수 정지 사전 설정 섹션 추가"
```

---

## Task 13: stage-flow에 BP 시각화 + 클릭 토글

**Files:**

- Modify: `apps/web/src/components/analysis/pipeline-monitor/stage-flow.tsx`
- Modify: `apps/web/src/components/analysis/pipeline-monitor/types.ts`

- [ ] **Step 1: types.ts에 BreakpointStage 타입 추가**

```typescript
export type BreakpointStage =
  | 'collection'
  | 'normalize'
  | 'token-optimization'
  | 'item-analysis'
  | 'analysis-stage1'
  | 'analysis-stage2'
  | 'analysis-stage4';
```

- [ ] **Step 2: stage-flow.tsx에 props 추가**

`StageFlowProps`를 다음과 같이 수정:

```typescript
interface StageFlowProps {
  stages: Record<string, { status: string }>;
  timeline: PipelineTimeline;
  elapsedSeconds: number;
  jobId?: number;
  breakpoints?: string[];
  pausedAtStage?: string | null;
  isPaused?: boolean;
  onToggleBreakpoint?: (stageKey: string) => void;
}
```

- [ ] **Step 3: PIPELINE_STEPS 카드 렌더링에 BP 시각화 추가**

`PulseRing` 내부 카드 div에 다음 클래스/요소 추가:

```tsx
const isBreakpoint = breakpoints?.includes(stageToBpKey(step.key)) ?? false;
const isPausedHere = isPaused && pausedAtStage === stageToBpKey(step.key);
```

카드 클래스에 추가:

```typescript
${isPausedHere ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400 scale-105' : ''}
```

카드 내부에 북마크 아이콘 (BP 설정 시):

```tsx
{
  isBreakpoint && (
    <Bookmark className="absolute top-1 right-1 h-3 w-3 text-amber-500 fill-amber-500" />
  );
}
```

카드 클릭 핸들러 (pending 단계만 토글 가능):

```tsx
onClick={() => {
  if (status === 'pending' && onToggleBreakpoint) {
    onToggleBreakpoint(stageToBpKey(step.key));
  }
}}
```

`stageToBpKey` 헬퍼 함수 (UI key → BP key 매핑, 차이만 처리):

```typescript
function stageToBpKey(stepKey: string): string {
  // PIPELINE_STEPS는 'normalization'/'analysis'를 사용, BP는 'normalize'/'analysis-stage1' 등
  if (stepKey === 'normalization') return 'normalize';
  if (stepKey === 'analysis') return 'analysis-stage1'; // 대표값 (3개 stage 묶기)
  return stepKey;
}
```

> 주의: 'analysis' 카드는 stage1/2/4를 묶어 표현하므로 클릭 토글은 stage1만 토글하고, stage2/4는 BP 패널에서 별도 관리. 실용적 단순화.

- [ ] **Step 4: import 추가**

```typescript
import { Bookmark } from 'lucide-react';
```

그리고 PulseRing 내부 div에 `relative` 클래스 추가 (Bookmark absolute 포지셔닝용).

- [ ] **Step 5: 빌드 검증**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/components/analysis/pipeline-monitor/stage-flow.tsx apps/web/src/components/analysis/pipeline-monitor/types.ts
git commit -m "feat: stage-flow에 BP 북마크 시각화 + 정지 강조 + 클릭 토글"
```

---

## Task 14: 인라인 정지 제어 패널

**Files:**

- Create: `apps/web/src/components/analysis/pipeline-monitor/breakpoint-control.tsx`
- Modify: `apps/web/src/components/analysis/pipeline-monitor/index.tsx`

- [ ] **Step 1: breakpoint-control.tsx 작성**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Pause, Play, SkipForward, FastForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

interface Props {
  jobId: number;
  pausedAtStage: string;
  pausedAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  collection: '수집',
  normalize: '정규화',
  'token-optimization': '토큰 최적화',
  'item-analysis': '개별 감정 분석',
  'analysis-stage1': 'AI 분석 Stage 1',
  'analysis-stage2': 'AI 분석 Stage 2',
  'analysis-stage4': 'AI 분석 Stage 4',
};

function formatRemaining(pausedAt: string): string {
  const start = new Date(pausedAt).getTime();
  const expireAt = start + 24 * 60 * 60 * 1000;
  const remaining = expireAt - Date.now();
  if (remaining <= 0) return '만료';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function BreakpointControl({ jobId, pausedAtStage, pausedAt }: Props) {
  const utils = trpc.useUtils();
  const [remaining, setRemaining] = useState(() => formatRemaining(pausedAt));

  useEffect(() => {
    const t = setInterval(() => setRemaining(formatRemaining(pausedAt)), 30_000);
    return () => clearInterval(t);
  }, [pausedAt]);

  const resume = trpc.analysis.resume.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.analysis.getJobStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const runToEnd = trpc.analysis.runToEnd.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.analysis.getJobStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancel = trpc.analysis.cancel.useMutation({
    onSuccess: () => {
      toast.success('작업이 취소되었습니다');
      utils.analysis.getJobStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const isExpiringSoon = remaining.startsWith('0h');
  const stageLabel = STAGE_LABELS[pausedAtStage] ?? pausedAtStage;

  return (
    <div className="my-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <Pause className="h-4 w-4" />
        정지됨: {stageLabel} 완료 — 결과 확인 후 다음 작업을 선택하세요
      </div>
      <div
        className={`mb-3 text-xs ${
          isExpiringSoon ? 'font-bold text-red-600' : 'text-amber-700 dark:text-amber-300'
        }`}
      >
        ⏱ 자동 취소까지 {remaining} 남음
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => resume.mutate({ jobId, mode: 'continue' })}
          disabled={resume.isPending}
        >
          <Play className="mr-1 h-3 w-3" />
          다음 단계 실행
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => resume.mutate({ jobId, mode: 'step-once' })}
          disabled={resume.isPending}
        >
          <SkipForward className="mr-1 h-3 w-3" />한 단계만 실행
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => runToEnd.mutate({ jobId })}
          disabled={runToEnd.isPending}
        >
          <FastForward className="mr-1 h-3 w-3" />
          끝까지 실행
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => cancel.mutate({ jobId })}
          disabled={cancel.isPending}
        >
          <X className="mr-1 h-3 w-3" />
          취소
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: pipeline-monitor/index.tsx에서 통합**

stage-flow 렌더링 다음에 조건부로 패널 표시:

```tsx
{
  job?.status === 'paused' && job.pausedAtStage && job.pausedAt && (
    <BreakpointControl
      jobId={job.id}
      pausedAtStage={job.pausedAtStage}
      pausedAt={job.pausedAt.toString()}
    />
  );
}
```

(`job` 객체가 `pausedAtStage`, `pausedAt`을 포함하도록 백엔드 select 확장 필요 — `getJobStatus` 또는 동등 query에서)

- [ ] **Step 3: getJobStatus query 확장**

`apps/web/src/server/trpc/routers/analysis.ts`의 `getJobStatus` (또는 동등) procedure에서 select에 `pausedAt`, `pausedAtStage`, `breakpoints` 포함:

Run: `grep -n "getJobStatus\|getStatus\|jobStatus" apps/web/src/server/trpc/routers/analysis.ts | head -5`

찾은 procedure에서 db.select 객체에 추가:

```typescript
pausedAt: collectionJobs.pausedAt,
pausedAtStage: collectionJobs.pausedAtStage,
breakpoints: collectionJobs.breakpoints,
```

- [ ] **Step 4: 빌드 검증**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/analysis/pipeline-monitor/breakpoint-control.tsx apps/web/src/components/analysis/pipeline-monitor/index.tsx apps/web/src/server/trpc/routers/analysis.ts
git commit -m "feat: 인라인 BP 정지 제어 패널 + getJobStatus 확장"
```

---

## Task 15: 워커 헬스 배지 + 모달

**Files:**

- Create: `apps/web/src/components/admin/worker-health-badge.tsx`
- Create: `apps/web/src/components/admin/worker-health-modal.tsx`
- Modify: `apps/web/src/app/admin/layout.tsx`

- [ ] **Step 1: worker-health-badge.tsx**

```tsx
'use client';

import { useState } from 'react';
import { Activity, AlertCircle, CircleSlash } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { WorkerHealthModal } from './worker-health-modal';

const HEALTH_COLOR: Record<string, string> = {
  healthy: 'text-green-600 bg-green-100 dark:bg-green-950',
  idle: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800',
  stuck: 'text-amber-600 bg-amber-100 dark:bg-amber-950',
  warn: 'text-amber-600 bg-amber-100 dark:bg-amber-950',
  down: 'text-red-600 bg-red-100 dark:bg-red-950',
};

const HEALTH_ICON: Record<string, typeof Activity> = {
  healthy: Activity,
  idle: Activity,
  stuck: AlertCircle,
  warn: AlertCircle,
  down: CircleSlash,
};

export function WorkerHealthBadge() {
  const [open, setOpen] = useState(false);
  const { data } = trpc.admin.workerStatus.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  if (!data) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
      >
        {data.map((q) => {
          const Icon = HEALTH_ICON[q.health] ?? Activity;
          const color = HEALTH_COLOR[q.health] ?? '';
          return (
            <span key={q.queue} className={`flex items-center gap-1 rounded px-2 py-0.5 ${color}`}>
              <Icon className="h-3 w-3" />
              {q.queue} ({q.workerCount})
            </span>
          );
        })}
      </button>
      {open && <WorkerHealthModal onClose={() => setOpen(false)} data={data} />}
    </>
  );
}
```

- [ ] **Step 2: worker-health-modal.tsx**

```tsx
'use client';

import { X } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/trpc/routers';

type Data = inferRouterOutputs<AppRouter>['admin']['workerStatus'];

interface Props {
  data: Data;
  onClose: () => void;
}

export function WorkerHealthModal({ data, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">워커 헬스 상태</h2>
          <button onClick={onClose} aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {data.map((q) => (
            <div key={q.queue} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">
                  {q.queue} <span className="text-xs text-muted-foreground">({q.health})</span>
                </h3>
                <span className="text-xs text-muted-foreground">워커 {q.workerCount}개</span>
              </div>
              <div className="mb-2 grid grid-cols-5 gap-2 text-xs">
                <div>active: {q.counts.active}</div>
                <div>waiting: {q.counts.waiting}</div>
                <div>delayed: {q.counts.delayed}</div>
                <div>failed: {q.counts.failed}</div>
                <div>paused: {q.counts.paused}</div>
              </div>
              {q.workers.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {q.workers.map((w) => (
                    <li key={w.id}>
                      {w.addr || w.id} · idle {Math.floor(w.idle / 1000)}s
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-red-600">⚠ 활성 워커 없음 — 프로세스 다운 의심</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md bg-muted p-3 font-mono text-xs">
          # 워커 재시작 명령
          <br />
          dserver restart ais-prod-worker
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: admin/layout.tsx에 배지 삽입**

`apps/web/src/app/admin/layout.tsx` 헤더 영역에 추가:

```tsx
import { WorkerHealthBadge } from '@/components/admin/worker-health-badge';

// 헤더 우측에:
<WorkerHealthBadge />;
```

- [ ] **Step 4: 빌드 검증**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/admin/worker-health-badge.tsx apps/web/src/components/admin/worker-health-modal.tsx apps/web/src/app/admin/layout.tsx
git commit -m "feat: admin 헤더에 워커 헬스 배지 + 상세 모달 추가"
```

---

## Task 16: 통합 검증 (수동 UAT)

**Files:** 변경 없음

- [ ] **Step 1: 개발 서버 + 워커 시작**

Run (터미널 2개):

```bash
pnpm dev        # 웹
pnpm worker     # 워커
```

- [ ] **Step 2: BP 사전 설정 시나리오**

브라우저에서 분석 트리거:

1. trigger-form 열기
2. 단계별 검수 정지 섹션 열기
3. "수집 완료 후" + "AI 분석 Stage 1 완료 후" 체크
4. 분석 시작
5. 수집 완료 시점에 stage-flow의 수집 카드가 앰버 강조 + 인라인 패널 표시 확인
6. [다음 단계 실행] 클릭 → 정규화/토큰최적화/Stage 1까지 진행 후 다시 정지 확인
7. [한 단계만 실행] 클릭 → Stage 2 완료 후 다시 정지 확인
8. [끝까지 실행] 클릭 → 끝까지 진행, 리포트 생성 확인

- [ ] **Step 3: 워커 죽음 시뮬레이션**

워커 프로세스 강제 종료:

```bash
# 워커 터미널에서 Ctrl+C 또는
pkill -f 'pnpm worker'
```

`/admin` 페이지 새로고침 → 헤더 배지에서 해당 큐가 🔴 down 표시 확인. 클릭 → 모달에 "활성 워커 없음" 메시지 + 재시작 명령 확인.

- [ ] **Step 4: 24h 만료 시뮬레이션 (선택)**

DB에서 paused 잡의 `paused_at`을 24시간 전으로 수동 업데이트:

```sql
UPDATE collection_jobs SET paused_at = now() - interval '25 hours' WHERE id = <jobId>;
```

cron 주기를 임시로 30초로 단축한 뒤 워커 재시작 → 30초 내 자동 cancelled 확인 후 cron 주기 원복.

- [ ] **Step 5: 검증 결과 기록 + 커밋 (검증 통과 시)**

검증 통과 후 별도 커밋 불필요. 실패 항목 발견 시 해당 Task로 돌아가 수정.

---

## Self-Review

**Spec coverage 확인:**

| Spec 섹션         | 구현 Task                                                                              |
| ----------------- | -------------------------------------------------------------------------------------- |
| §3 데이터 모델    | Task 1, 2                                                                              |
| §4 awaitStageGate | Task 3, 4                                                                              |
| §5 게이트 7곳     | Task 6 (5곳), Task 7 (2곳)                                                             |
| §6 tRPC API       | Task 10 (analysis), Task 11 (admin)                                                    |
| §7 UI/UX          | Task 12 (trigger-form), Task 13 (stage-flow), Task 14 (제어 패널), Task 15 (워커 배지) |
| §8 자동 만료 cron | Task 8                                                                                 |
| §9 워커 강화      | Task 9                                                                                 |
| §10 SSE 이벤트    | (생략 — getJobStatus polling으로 대체, Task 14 step 3에서 처리)                        |

**SSE 이벤트 추가는 polling으로 대체** — Task 14에서 `getJobStatus`에 paused 필드를 포함시켜 기존 polling으로 충분히 표시 가능. SSE 확장은 별도 개선 작업으로 분리.

**Placeholder/타입 일관성 확인 완료.** `BreakpointStage` 타입은 Task 1에서 정의되고 Task 4, 6, 10에서 사용. 모든 함수 시그니처 일치.

**Risk:**

- Task 7의 collection/normalize 게이트 위치는 `pipeline-worker.ts`의 persist 분기 정확한 위치를 실행 중에 확인해야 함. 분기가 명확하지 않으면 task 진행 중 추가 grep 필요.
- Task 13의 `analysis` 카드가 stage1/2/4를 묶어 표현 — 단일 카드 클릭으로 모든 stage 토글하는 게 더 직관적일 수 있음. 실용 단순화로 stage1만 토글 처리, 향후 카드 분리 고려.
