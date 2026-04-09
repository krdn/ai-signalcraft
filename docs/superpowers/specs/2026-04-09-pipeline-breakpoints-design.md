# 파이프라인 단계별 브레이크포인트 + 워커 헬스 모니터링

> 작성일: 2026-04-09
> 상태: 설계 승인 대기
> 작성자: brainstorming session

## 1. 목적

분석 파이프라인의 6단계(수집 → 정규화 → 토큰 최적화 → 개별 감정 → AI 분석 → 리포트)와 AI 분석 내부 Stage 경계에서 **사전 선택한 브레이크포인트(BP)**가 자동으로 발동, 사람이 결과를 검수한 뒤 수동으로 다음 단계를 진행할 수 있게 한다. 함께 워커 헬스 가시성을 확보해 "워커가 죽어 잡이 멈춘 줄 모르는" 운영 사고를 예방한다.

## 2. 요구사항 (확정)

| #   | 결정          | 내용                                                                                                |
| --- | ------------- | --------------------------------------------------------------------------------------------------- |
| 1   | 정지 모델     | 브레이크포인트 모드 — 트리거 시 사전 선택, 단계 완료 시 자동 정지                                   |
| 2   | BP 단위       | 6 메인 단계 + AI 분석 내부 Stage 1 / Stage 2(Stage 3 포함) / Stage 4                                |
| 3   | 재개 옵션     | (a) 다음 BP까지, (b) step-once(한 단계만), (c) 끝까지(BP 무시), (d) 취소                            |
| 4   | UI 배치       | trigger-form에 사전 설정, pipeline-monitor의 stage-flow에 정지 시 인라인 제어                       |
| 5   | 자동 만료     | 24시간 정지 지속 시 자동 취소                                                                       |
| 6   | 대기 메커니즘 | 적응형 polling (3s × 10회 → 10s × 30회 → 60s × 나머지)                                              |
| 7   | 만료 안전장치 | in-process timeout + 시간당 cron 2단 방어                                                           |
| 8   | 워커 모니터링 | BullMQ `Queue.getWorkers()` 기반 헬스 API, admin 헤더 배지, monitor 인디케이터, 죽음 자동 감지 배너 |

## 3. 데이터 모델

### 3.1 collection_jobs 테이블 컬럼 추가

```typescript
// packages/core/src/db/schema/collections.ts
breakpoints: jsonb('breakpoints').$type<BreakpointStage[]>().default([]),
pausedAt: timestamp('paused_at'),       // 정지 시각 (24h 카운트다운)
pausedAtStage: text('paused_at_stage'), // 어느 BP에서 멈췄는지
resumeMode: text('resume_mode'),        // 'continue' | 'step-once' | null
```

### 3.2 BreakpointStage 타입

```typescript
export type BreakpointStage =
  | 'collection'
  | 'normalize'
  | 'token-optimization'
  | 'item-analysis'
  | 'analysis-stage1'
  | 'analysis-stage2' // Stage 2 + Stage 3(finalSummary) 묶음
  | 'analysis-stage4';
```

리포트는 마지막 단계라 BP 의미가 없어 제외.

### 3.3 인덱스

```sql
CREATE INDEX idx_collection_jobs_paused_at
  ON collection_jobs(paused_at)
  WHERE status = 'paused';
```

cron이 시간당 한번씩 만료 잡을 스캔할 때 사용.

## 4. 핵심 메커니즘 — 단계 게이트 함수

### 4.1 awaitStageGate

```typescript
// packages/core/src/pipeline/pipeline-checks.ts (신규 함수)
export async function awaitStageGate(jobId: number, stageName: BreakpointStage): Promise<boolean>;
```

**동작 흐름:**

1. job 조회: `breakpoints`, `resumeMode` 확인
2. `resumeMode === 'continue'`이고 stageName이 다음 BP가 아니면 즉시 통과 (BP가 켜져있어도 step 모드 아니면 통과 아님—주의: 1번이 정확함)
3. 실제 로직:
   - `breakpoints.includes(stageName) === false` → 통과
   - `breakpoints.includes(stageName) === true`:
     - DB에 `status='paused', pausedAt=now(), pausedAtStage=stageName, resumeMode=null` 셋
     - 이벤트 로그 추가, SSE 푸시
     - **적응형 polling** (아래 4.2)
     - polling 결과:
       - `running` 복귀 → `pausedAt`/`pausedAtStage` 클리어 후 `true` 반환
       - `cancelled` → `false` 반환
       - 24h 초과 → `cancelPipeline(jobId)` 호출 + `false` 반환
4. 통과 후 `resumeMode === 'step-once'`이면 다음 호출에서 강제 정지하도록 메모리 플래그 또는 DB 필드 활용

### 4.2 적응형 polling 스케줄

```typescript
const POLL_SCHEDULE = [
  { intervalMs: 3000, count: 10 }, // 0 ~ 30s   (즉시 재개 고려)
  { intervalMs: 10000, count: 30 }, // 30s ~ 5.5m
  { intervalMs: 60000, count: 1437 }, // 5.5m ~ 24h
];
```

총 약 1,477회 쿼리 / 24h / job. PostgreSQL PK 단일 select라 부담 미미.

### 4.3 step-once 처리

`resumeMode='step-once'`로 재개되면:

1. 현재 BP를 통과 (이번 한번만)
2. 통과 직후 DB에 `resumeMode=null` 세팅 + 메모리에 `pendingStepStop=true` 플래그
3. **다음 awaitStageGate 호출**에서 `pendingStepStop===true`이면 BP 여부와 무관하게 강제 정지

플래그는 워커 프로세스 메모리에 저장 (`Map<jobId, boolean>`). 워커 죽으면 플래그 사라짐 → 다음 BP에서 정지하거나 끝까지 진행. 허용 가능한 손실.

## 5. 게이트 적용 위치 (총 7곳)

| #   | 단계 ID              | 위치                                     | 호출 시점                                              |
| --- | -------------------- | ---------------------------------------- | ------------------------------------------------------ |
| 1   | `collection`         | `pipeline-worker.ts` persist job 시작부  | 모든 collect+normalize children 완료 후 (persist 직전) |
| 2   | `normalize`          | `pipeline-worker.ts` persist job 본체 안 | DB persist 완료 후 (analysis 트리거 직전)              |
| 3   | `token-optimization` | `pipeline-orchestrator.ts`               | 토큰 최적화 try/catch 종료 후                          |
| 4   | `item-analysis`      | `pipeline-orchestrator.ts`               | itemAnalysisPromise await 완료 후                      |
| 5   | `analysis-stage1`    | `pipeline-orchestrator.ts`               | Stage 1 collectResults 후, checkFailAndAbort 후        |
| 6   | `analysis-stage2`    | `pipeline-orchestrator.ts`               | Stage 3(finalSummary) 완료 후                          |
| 7   | `analysis-stage4`    | `pipeline-orchestrator.ts`               | Stage 4b 완료 후, generateFinalReport 직전             |

> 주의: 1번(`collection`)과 2번(`normalize`)은 BullMQ Flow의 persist job 안에서 인접하게 처리. persist job이 children 완료 후 실행되므로 자연스러운 단일 지점.

## 6. tRPC API 확장

### 6.1 analysis 라우터

```typescript
trigger: {
  // 기존 + 신규 필드
  breakpoints: z.array(BreakpointStageSchema).default([]),
}

resume: publicProcedure
  .input(z.object({
    jobId: z.number(),
    mode: z.enum(['continue', 'step-once']),
  }))
  .mutation(async ({ input }) => {
    // DB 업데이트: status='running', resumeMode=mode, pausedAt=null
  })

runToEnd: publicProcedure
  .input(z.object({ jobId: z.number() }))
  .mutation(async ({ input }) => {
    // DB 업데이트: status='running', breakpoints=[], resumeMode=null, pausedAt=null
  })

updateBreakpoints: publicProcedure
  .input(z.object({
    jobId: z.number(),
    breakpoints: z.array(BreakpointStageSchema),
  }))
  .mutation(/* 실행 중에도 BP 추가/제거 가능 */)
```

`cancel`은 기존 `cancelPipeline` 재사용.

### 6.2 admin 라우터

```typescript
workerStatus: publicProcedure.query(async () => {
  const queues = ['collectors', 'pipeline', 'analysis'] as const;
  return Promise.all(queues.map(async (name) => {
    const queue = getQueue(name);
    const workers = await queue.getWorkers();
    const counts = await queue.getJobCounts(
      'active', 'waiting', 'delayed', 'failed', 'paused',
    );
    return {
      queue: name,
      workerCount: workers.length,
      workers: workers.map(w => ({
        id: w.id,
        addr: w.addr,
        started: w.started,
        idle: w.idle,
      })),
      counts,
      isPaused: await queue.isPaused(),
      health: deriveHealth(workers, counts),
    };
  }));
}),
```

**health 판정:**

```typescript
type WorkerHealth = 'healthy' | 'idle' | 'stuck' | 'down' | 'warn';

function deriveHealth(workers, counts): WorkerHealth {
  if (workers.length === 0) return 'down';
  if (counts.active > 0) {
    if (workers.some((w) => w.idle < 60_000)) return 'healthy';
    return 'warn';
  }
  if (counts.waiting > 0 || counts.delayed > 0) return 'stuck';
  return 'idle';
}
```

## 7. UI/UX 설계

### 7.1 trigger-form.tsx — 사전 BP 설정

분석 시작 폼 하단에 접기 가능한 섹션 추가:

```
▾ 단계별 검수 정지 (선택)
  ☐ 수집 완료 후
  ☐ 정규화 완료 후
  ☐ 토큰 최적화 완료 후
  ☐ 개별 감정 분석 완료 후
  ☐ AI 분석 Stage 1 완료 후 (병렬 4모듈)
  ☐ AI 분석 Stage 2 완료 후 (전략·최종요약)
  ☐ AI 분석 Stage 4 완료 후 (고급 분석)

  💡 체크한 단계가 끝나면 자동 정지되며,
     검수 후 [다음 단계 실행] 버튼으로 재개합니다.
     24시간 내 재개하지 않으면 자동 취소됩니다.
```

기본은 모두 OFF, 접힌 상태로 노출.

### 7.2 stage-flow.tsx — 6단계 바 강화

**상태별 시각 표현:**

| 상태             | 표현                                                         |
| ---------------- | ------------------------------------------------------------ |
| pending          | 회색 카드                                                    |
| running          | 파란 펄스                                                    |
| completed        | 초록 체크                                                    |
| BP 설정됨 (대기) | 카드 우상단 🔖 북마크 아이콘                                 |
| **BP 정지 중**   | 앰버 강조 + 카드 확대 + 펄스 + 인라인 제어 패널 슬라이드다운 |
| skipped          | 흐린 회색                                                    |

**실행 중 BP 토글:** pending/running 단계 카드 클릭 → 🔖 토글, completed는 비활성화. `updateBreakpoints` mutation 호출.

### 7.3 인라인 정지 제어 패널

정지된 단계 카드 바로 아래에 슬라이드다운:

```
┌─ ⏸ 정지됨: AI 분석 Stage 1 완료 ────────────┐
│  결과 확인 후 다음 작업을 선택하세요         │
│                                              │
│  ⏱ 정지 시각: 14:32 (남은 시간 23h 47m)      │
│                                              │
│  [▶ 다음 단계 실행]   ← 다음 BP까지 진행      │
│  [⏭ 한 단계만 실행]   ← step-once             │
│  [⏩ 끝까지 실행]     ← 모든 BP 무시           │
│  [✕ 취소]            ← 작업 중단              │
└──────────────────────────────────────────────┘
```

남은 시간은 1초마다 클라이언트에서 카운트다운, 5분 이내 빨간색 강조.

### 7.4 워커 헬스 표시 (2곳)

**A. /admin 페이지 상단 헤더 배지** — 모든 admin 페이지에서 항상 노출:

```
┌─ 워커 상태 ─────────────────────────────────────┐
│ 🟢 collectors (1) │ 🟢 pipeline (1) │ 🔴 analysis (0) │
└─────────────────────────────────────────────────┘
```

10초마다 자동 polling. 클릭 시 모달로 상세 정보:

- 큐별 워커 ID, addr, idle 시간, 시작 시각
- 큐별 active/waiting/delayed/failed/paused 카운트
- "워커 재시작 명령" 코드 블록 (`dserver restart ais-prod-worker`)

**B. pipeline-monitor의 pipeline-header.tsx 우측 인디케이터** — 분석 진행 화면 전용:

```
[← 헤더 좌측 정보] ............ [🟢 워커 정상] [⏸ 정지됨]
```

분석에 관련된 큐만 (`analysis`) 표시. 5초마다 polling. 죽음 감지 시:

```
⚠ analysis 워커가 응답하지 않습니다 (5분 이상 idle)
잡이 진행되지 않을 수 있습니다.
[워커 재시작 명령 보기]   [작업 취소]
```

붉은 배너 + 토스트.

## 8. 자동 만료 안전장치

### 8.1 1차: in-process timeout

`awaitStageGate` 내부 24h 폴링 → 초과 시 `cancelPipeline()` 호출.

### 8.2 2차: 시간당 cron

`packages/core/src/pipeline/expire-paused.ts` (신규):

```typescript
export async function expirePausedJobs() {
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
    await cancelPipeline(id);
    await appendJobEvent(id, 'warn', '24시간 정지 초과로 자동 취소되었습니다');
  }
}
```

워커 부트스트랩 시 `setInterval(expirePausedJobs, 60 * 60 * 1000)` 등록.

## 9. 워커 자체 강화

`packages/core/src/queue/worker-config.ts`에 추가:

```typescript
process.on('uncaughtException', (err) => {
  console.error('[worker] FATAL uncaughtException:', err);
  // BullMQ에서 진행 중 작업은 자동으로 stalled로 마킹됨
  process.exit(1); // Docker가 재시작
});

process.on('unhandledRejection', (err) => {
  console.error('[worker] FATAL unhandledRejection:', err);
  process.exit(1);
});
```

graceful shutdown 핸들러도 함께 추가 (SIGTERM 시 현재 잡 완료 후 종료).

## 10. SSE 이벤트 확장

기존 `pipeline-status` SSE 채널에 신규 이벤트:

```typescript
type PipelineEvent =
  | {
      type: 'breakpoint-paused';
      jobId: number;
      stage: BreakpointStage;
      pausedAt: string;
      autoCancelAt: string;
    }
  | {
      type: 'breakpoint-resumed';
      jobId: number;
      stage: BreakpointStage;
      mode: 'continue' | 'step-once';
    };
// ... 기존 이벤트
```

## 11. 위험 요소 (Risk)

| 위험                                       | 완화 방법                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 24h polling 부담                           | 적응형 간격으로 1,477회/24h로 제한                                                                |
| step-once 메모리 플래그 손실 (워커 재시작) | 다음 BP 또는 끝까지 진행으로 fallback. 사용자에게 미리 안내                                       |
| 워커 죽음 후 paused 잡이 영원히 남음       | 시간당 cron이 24h 초과 잡 정리                                                                    |
| BullMQ pause vs DB paused 혼동             | DB status `paused`만 정지 신호로 사용. BullMQ queue.pause()는 `pausePipeline`(전체 일시정지) 전용 |
| 동시 step-once 호출 race                   | 통과 직후 즉시 `resumeMode=null`로 클리어, 클리어 실패 시 다음 polling이 paused로 다시 진입       |

## 12. 변경 영향 파일 (예상)

### Backend

- `packages/core/src/db/schema/collections.ts` — 컬럼 추가
- `packages/core/src/pipeline/pipeline-checks.ts` — `awaitStageGate` 신규
- `packages/core/src/pipeline/control.ts` — `resumePipelineWithMode`, `runToEnd` 신규
- `packages/core/src/pipeline/expire-paused.ts` — 신규
- `packages/core/src/pipeline/index.ts` — exports
- `packages/core/src/analysis/pipeline-orchestrator.ts` — 5곳 게이트 삽입
- `packages/core/src/queue/pipeline-worker.ts` — collection/normalize 게이트 2곳
- `packages/core/src/queue/worker-config.ts` — 프로세스 핸들러 + cron
- `packages/core/src/queue/queue-management.ts` — `getWorkerStatus` 헬퍼
- `packages/core/src/types/index.ts` — `BreakpointStage` 타입 export

### tRPC

- `apps/web/src/server/trpc/routers/analysis.ts` — `resume`, `runToEnd`, `updateBreakpoints` + trigger 확장
- `apps/web/src/server/trpc/routers/admin/index.ts` — `workerStatus`
- `apps/web/src/server/pipeline-status/events.ts` — SSE 이벤트 추가

### Frontend

- `apps/web/src/components/analysis/trigger-form.tsx` — BP 사전 설정 섹션
- `apps/web/src/components/analysis/pipeline-monitor/stage-flow.tsx` — BP 시각화 + 인라인 제어 패널
- `apps/web/src/components/analysis/pipeline-monitor/pipeline-header.tsx` — 워커 인디케이터
- `apps/web/src/components/admin/worker-health-badge.tsx` — 신규 (헤더 배지)
- `apps/web/src/components/admin/worker-health-modal.tsx` — 신규 (상세 모달)
- `apps/web/src/app/admin/layout.tsx` — 헤더 배지 삽입
- `apps/web/src/components/analysis/pipeline-monitor/types.ts` — 타입 확장

## 13. 마이그레이션

`pnpm db:push` 한 번으로 컬럼 추가 + 인덱스 생성. 기존 데이터는 모든 신규 컬럼 NULL 또는 default `[]`이라 호환.

## 14. 테스트 전략

- **단위**: `awaitStageGate` 모킹 — paused → running 전환, cancelled, 24h 초과 각각
- **단위**: `deriveHealth` — workers/counts 조합별
- **통합**: 실제 BullMQ + Redis로 분석 트리거 → BP 정지 → resume(continue/step-once) → 끝까지 동작 검증
- **수동 UAT**: stage-flow 클릭, 인라인 제어 버튼, 워커 강제 종료 후 헬스 배지 변화

## 15. 단계 외 사항 (이번 작업 범위 밖)

- BP 정지 중 파라미터 수정 후 재개 (모델 변경, 프롬프트 수정 등) — 향후 별도 phase
- BP를 사용자별 프리셋으로 저장 — 향후
- 분산 워커 환경에서 step-once 플래그 공유 (Redis로) — 현재 워커는 단일 프로세스라 불필요
