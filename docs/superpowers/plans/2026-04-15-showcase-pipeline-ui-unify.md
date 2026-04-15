# Showcase Pipeline UI Unify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 쇼케이스(/showcase/[jobId])의 "분석 실행" 탭을 대시보드의 `PipelineMonitor`와 동일한 디자인으로 통일한다.

**Architecture:** `showcase.getDetail` 응답을 `PipelineStatusData` 타입으로 변환하는 어댑터 훅(`useShowcasePipelineStatus`)을 신규 생성하고, `PipelineMonitor`에 `readOnly` prop을 추가하여 제어 버튼을 숨긴다. Showcase 페이지의 탭 0(`ShowcaseDetailPanel`)을 어댑터 + `PipelineMonitor(readOnly)`로 교체한다.

**Tech Stack:** Next.js 15 App Router · React 19 · TanStack Query 5 · TypeScript 5 · tRPC 11

---

## 파일 구조

| 파일                                                          | 동작                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/web/src/hooks/use-showcase-pipeline-status.ts`          | **신규** — showcase.getDetail → PipelineStatusData 어댑터 훅 |
| `apps/web/src/components/analysis/pipeline-monitor/index.tsx` | **수정** — `readOnly?: boolean` prop 추가, 제어 버튼 분기    |
| `apps/web/src/app/showcase/[jobId]/page.tsx`                  | **수정** — 탭 0을 어댑터 + PipelineMonitor(readOnly)로 교체  |

---

## Task 1: `useShowcasePipelineStatus` 어댑터 훅 신규 생성

**Files:**

- Create: `apps/web/src/hooks/use-showcase-pipeline-status.ts`

showcase.getDetail 응답을 PipelineMonitor가 기대하는 `PipelineStatusData` 형태로 변환한다. SSE 없이 TanStack Query로 단순 조회.

- [ ] **Step 1: 파일 생성**

```typescript
// apps/web/src/hooks/use-showcase-pipeline-status.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import type {
  PipelineStatusData,
  SourceDetail,
  AnalysisModuleDetailed,
} from '@/components/analysis/pipeline-monitor/types';

/**
 * showcase.getDetail 응답을 PipelineStatusData 타입으로 변환하는 어댑터 훅.
 * PipelineMonitor(readOnly)에 staticData로 전달할 수 있는 형태를 반환한다.
 */
export function useShowcasePipelineStatus(jobId: number) {
  const { data, isLoading } = useQuery({
    queryKey: ['showcase', 'getDetail', jobId],
    queryFn: () => trpcClient.showcase.getDetail.query({ jobId }),
    staleTime: Infinity,
    enabled: !isNaN(jobId),
  });

  if (!data) return { data: null, isLoading };

  // sourceDetails: Record<string, SourceDetail>
  const sourceDetails: Record<string, SourceDetail> = {};
  for (const src of data.sources) {
    sourceDetails[src.key] = {
      status: 'completed',
      count: src.articles + src.comments,
      label: src.label,
      articles: src.articles,
      comments: src.comments,
      videos: 0,
      posts: 0,
    };
  }

  // pipelineStages: Record<string, { status: string }>
  const pipelineStages: Record<string, { status: string }> = {};
  for (const stage of data.pipelineStages) {
    pipelineStages[stage.key] = { status: stage.status };
  }

  // analysisModulesDetailed
  const analysisModulesDetailed: AnalysisModuleDetailed[] = data.analysisModules.map((mod) => ({
    module: mod.module,
    label: mod.label,
    status: 'completed' as const,
    stage: mod.stage,
    usage:
      mod.totalTokens > 0
        ? { input: 0, output: mod.totalTokens, provider: mod.provider, model: mod.model }
        : null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    durationSeconds: mod.durationSeconds,
  }));

  const totalTokens = data.stats.totalTokens;

  const pipelineData: PipelineStatusData = {
    status: 'completed',
    keyword: data.keyword,
    domain: data.domain,
    keywordType: null,
    progress: null,
    errorDetails: null,
    pipelineStages,
    analysisModuleCount: {
      total: data.stats.modulesTotal,
      completed: data.stats.modulesCompleted,
    },
    hasReport: true,
    sourceDetails,
    analysisModules: data.analysisModules.map((m) => ({
      module: m.module,
      status: 'completed' as const,
      label: m.label,
    })),
    elapsedSeconds: data.stats.durationSeconds,
    costLimitUsd: null,
    skippedModules: [],
    overallProgress: 100,
    tokenUsage: {
      total: { input: 0, output: totalTokens },
      byModule: [],
      estimatedCostUsd: 0,
    },
    timeline: {
      jobCreatedAt: new Date().toISOString(),
      jobUpdatedAt: new Date().toISOString(),
      analysisStartedAt: null,
      analysisCompletedAt: null,
      reportCompletedAt: null,
    },
    analysisModulesDetailed,
    events: [],
    itemAnalysis: null,
  };

  return { data: pipelineData, isLoading };
}
```

- [ ] **Step 2: TypeScript 오류 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm --filter @ai-signalcraft/web tsc --noEmit 2>&1 | grep "use-showcase-pipeline-status" | head -20
```

오류 없으면 계속. 타입 오류 있으면 해당 필드 수정.

- [ ] **Step 3: 커밋**

```bash
cd /home/gon/projects/ai/ai-signalcraft
git add apps/web/src/hooks/use-showcase-pipeline-status.ts
git commit -m "feat: useShowcasePipelineStatus 어댑터 훅 추가"
```

---

## Task 2: `PipelineMonitor`에 `readOnly` prop 추가

**Files:**

- Modify: `apps/web/src/components/analysis/pipeline-monitor/index.tsx`

`readOnly` prop이 `true`일 때 제어 버튼(`PipelineControls`)과 완료/취소/에러 배너의 "결과 보기" 버튼을 숨기고, 외부에서 `staticData`를 주입받아 SSE 없이 렌더링할 수 있게 한다.

- [ ] **Step 1: PipelineMonitorProps 인터페이스 수정**

`apps/web/src/components/analysis/pipeline-monitor/index.tsx`의 `PipelineMonitorProps` 인터페이스를 아래처럼 변경:

```typescript
interface PipelineMonitorProps {
  jobId: number | null;
  onComplete?: () => void;
  onRetry?: () => void;
  /** 읽기 전용 모드 — 제어 버튼 숨김 */
  readOnly?: boolean;
  /** SSE 대신 외부 정적 데이터를 직접 주입 (쇼케이스용) */
  staticData?: PipelineStatusData;
}
```

- [ ] **Step 2: `PipelineMonitor` 함수 시그니처에 새 prop 추가 및 데이터 소스 분기**

기존:

```typescript
export function PipelineMonitor({ jobId, onComplete, onRetry }: PipelineMonitorProps) {
  const { data, isLoading } = usePipelineStatus(jobId);
```

변경 후:

```typescript
export function PipelineMonitor({ jobId, onComplete, onRetry, readOnly, staticData }: PipelineMonitorProps) {
  const liveResult = usePipelineStatus(staticData ? null : jobId);
  const data = staticData ?? liveResult.data;
  const isLoading = staticData ? false : liveResult.isLoading;
```

- [ ] **Step 3: `isInProgress` 조건과 제어 버튼 렌더링 분기 적용**

`PipelineControls` 블록을 아래처럼 감싸기:

```typescript
{/* 제어 버튼 — readOnly 또는 정적 데이터 모드에서는 숨김 */}
{!readOnly && isInProgress && jobId && (
  <PipelineControls
    jobId={jobId}
    status={data.status}
    isPaused={isPaused}
    skippedModules={statusData.skippedModules}
    costLimitUsd={statusData.costLimitUsd}
    currentCost={statusData.tokenUsage.estimatedCostUsd}
  />
)}
```

- [ ] **Step 4: `PipelineHeader`의 재실행 드롭다운도 readOnly일 때 숨김**

`PipelineHeader`에 `readOnly?: boolean` prop을 추가하고, `canRetry` 조건을 `!readOnly && jobId != null && terminalStatuses.includes(status)`로 변경.

`apps/web/src/components/analysis/pipeline-monitor/pipeline-header.tsx`:

인터페이스:

```typescript
interface PipelineHeaderProps {
  keyword: string;
  domain?: string | null;
  status: string;
  overallProgress: number;
  elapsedSeconds: number;
  isInProgress: boolean;
  isPaused: boolean;
  jobId?: number | null;
  readOnly?: boolean;
}
```

canRetry 줄:

```typescript
const canRetry = !readOnly && jobId != null && terminalStatuses.includes(status);
```

`index.tsx`에서 `PipelineHeader` 호출 시 `readOnly` prop 전달:

```typescript
<PipelineHeader
  keyword={data.keyword}
  domain={(data as any).domain}
  status={data.status}
  overallProgress={statusData.overallProgress}
  elapsedSeconds={data.elapsedSeconds ?? 0}
  isInProgress={isInProgress}
  isPaused={isPaused}
  jobId={jobId}
  readOnly={readOnly}
/>
```

- [ ] **Step 5: TypeScript 오류 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm --filter @ai-signalcraft/web tsc --noEmit 2>&1 | grep -E "pipeline-monitor|pipeline-header" | head -30
```

오류 없으면 계속.

- [ ] **Step 6: 커밋**

```bash
cd /home/gon/projects/ai/ai-signalcraft
git add apps/web/src/components/analysis/pipeline-monitor/index.tsx \
        apps/web/src/components/analysis/pipeline-monitor/pipeline-header.tsx
git commit -m "feat: PipelineMonitor에 readOnly/staticData prop 추가"
```

---

## Task 3: Showcase 페이지 탭 0 교체

**Files:**

- Modify: `apps/web/src/app/showcase/[jobId]/page.tsx`

탭 0(`ShowcaseDetailPanel`)을 `useShowcasePipelineStatus` + `PipelineMonitor(readOnly, staticData)`로 교체한다.

- [ ] **Step 1: import 교체**

기존:

```typescript
import { ShowcaseDetailPanel } from '@/components/landing/showcase-detail-panel';
```

변경 후:

```typescript
import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { useShowcasePipelineStatus } from '@/hooks/use-showcase-pipeline-status';
```

- [ ] **Step 2: `ShowcaseDetailPage` 컴포넌트 내부에 어댑터 훅 호출 추가**

기존에 `detail` 쿼리만 있는 위치 아래에 추가:

```typescript
// 탭 0용 — PipelineMonitor에 주입할 어댑터 데이터
const { data: pipelineData } = useShowcasePipelineStatus(jobId);
```

- [ ] **Step 3: 탭 0 렌더링 교체**

기존:

```typescript
{activeTab === 0 && <ShowcaseDetailPanel jobId={jobId} onClose={() => {}} embedded />}
```

변경 후:

```typescript
{activeTab === 0 && (
  <PipelineMonitor
    jobId={null}
    staticData={pipelineData ?? undefined}
    readOnly
  />
)}
```

- [ ] **Step 4: TypeScript 오류 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm --filter @ai-signalcraft/web tsc --noEmit 2>&1 | grep "showcase" | head -20
```

오류 없으면 계속.

- [ ] **Step 5: 전체 빌드 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm --filter @ai-signalcraft/web build 2>&1 | tail -20
```

Build 성공 확인.

- [ ] **Step 6: 커밋**

```bash
cd /home/gon/projects/ai/ai-signalcraft
git add apps/web/src/app/showcase/[jobId]/page.tsx
git commit -m "feat: showcase 분석 탭을 PipelineMonitor(readOnly)로 교체"
```

---

## Task 4: 브라우저 UI 검증

개발 서버를 켜서 실제 화면을 확인한다.

- [ ] **Step 1: 개발 서버 시작 (백그라운드)**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm dev &
```

- [ ] **Step 2: showcase 목록에서 jobId 확인**

```bash
# DB에서 isFeatured=true인 job 조회
psql -h 192.168.0.5 -p 5438 -U postgres -d ai_signalcraft \
  -c "SELECT id, keyword FROM collection_jobs WHERE is_featured = true LIMIT 5;"
```

- [ ] **Step 3: 브라우저에서 showcase 분석 탭 확인**

playwright로 `/showcase/{jobId}` 접속, 탭 0("분석 실행") 클릭 후 스크린샷 비교.

기대 결과:

- 키워드 + 완료 Badge 헤더
- 5열 통계 바 (본문/댓글/분석/토큰/경과)
- 파이프라인 단계 흐름 (6단계)
- 소스별 수집 현황 (CollectionLanes)
- 분석 모듈 그리드 (Stage 그룹)
- 제어 버튼 없음 (중지/일시정지 숨김)
- 재실행 드롭다운 없음

- [ ] **Step 4: 대시보드 탭 0과 시각적 비교**

`/dashboard`의 분석 실행 탭과 나란히 비교하여 디자인 일관성 확인.

---

## Self-Review

### Spec 커버리지

- ✅ 공개 분석 리프트 화면 → PipelineMonitor 디자인 통일
- ✅ showcase.getDetail → PipelineStatusData 어댑터
- ✅ readOnly: 제어 버튼(중지/일시정지/재개/스킵/비용한도) 숨김
- ✅ readOnly: 재실행 드롭다운 숨김
- ✅ 기존 ShowcaseDetailPanel은 교체 (landing/showcase-list에서 아직 사용 중이므로 파일 삭제 안 함)

### 타입 일관성

- `useShowcasePipelineStatus` 반환 타입: `{ data: PipelineStatusData | null, isLoading: boolean }`
- `PipelineMonitor` 추가 props: `readOnly?: boolean`, `staticData?: PipelineStatusData`
- `PipelineHeader` 추가 prop: `readOnly?: boolean`
- 모든 필드명이 `types.ts`의 `PipelineStatusData` 인터페이스와 일치

### 주의사항

- `ShowcaseDetailPanel`은 landing 섹션(쇼케이스 목록 팝업)에서 아직 사용되므로 삭제하지 않는다
- `usePipelineStatus`는 `staticData`가 있을 때 `null` jobId를 받아 SSE를 열지 않는다 (기존 코드: `if (!jobId) return null` → 안전)
