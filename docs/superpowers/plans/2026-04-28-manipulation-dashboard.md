# Manipulation Dashboard Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2/2.5에서 저장된 manipulation_runs/_signals/_evidence 데이터를 두 진입점 — `/showcase/[jobId]` 새 탭 + `/subscriptions/[id]` 새 탭 — 에서 사용자에게 노출한다.

**Architecture:** 신규 tRPC `manipulationRouter`가 권한 검증 후 run+signals+evidence를 join 반환. 7개 visualization 컴포넌트로 evidence card의 viz JSONB 분기. Phase 2 dryrun으로 만들어진 jobId=273 (subscriptionId=37)에서 즉시 검증 가능.

**Tech Stack:** TypeScript 5, tRPC 11, Drizzle ORM, React 19, Recharts, TanStack Query 5, react-markdown, vitest 3, shadcn/ui Tabs.

**Spec:** `docs/superpowers/specs/2026-04-28-manipulation-dashboard-design.md`

**Worktree:** `.claude/worktrees/worktree-manipulation-phase3` (브랜치: `worktree-manipulation-phase3`, base: `main`)

---

## File Inventory

### tRPC layer
| 파일 | 변경 | 책임 |
|------|------|------|
| `apps/web/src/server/trpc/routers/manipulation.ts` | Create | `getRunByJobId` + `listRunsBySubscription` |
| `apps/web/src/server/trpc/routers/__tests__/manipulation.test.ts` | Create | 5 테스트 케이스 |
| `apps/web/src/server/trpc/router.ts` | Modify | manipulationRouter 등록 |

### Page integration
| 파일 | 변경 | 책임 |
|------|------|------|
| `apps/web/src/app/showcase/[jobId]/page.tsx` | Modify | 새 탭 (activeTab===7) 추가 |
| `apps/web/src/components/layout/showcase-sidebar.tsx` | Modify | 탭 메뉴 항목 추가 |
| `apps/web/src/app/subscriptions/[id]/page.tsx` | Modify | TabsTrigger + TabsContent 한 쌍 추가 |

### Components
| 파일 | 변경 | 책임 |
|------|------|------|
| `apps/web/src/components/manipulation/manipulation-view.tsx` | Create | 5탭 컨테이너 (상태 분기) |
| `apps/web/src/components/manipulation/manipulation-hero.tsx` | Create | 점수/신뢰도/narrative |
| `apps/web/src/components/manipulation/signal-grid.tsx` | Create | 7신호 grid |
| `apps/web/src/components/manipulation/evidence-card.tsx` | Create | viz 분기 카드 |
| `apps/web/src/components/manipulation/timeseries-view.tsx` | Create | 구독 탭 (라인+표) |
| `apps/web/src/components/manipulation/visualizations/index.ts` | Create | 7 viz re-export |
| `apps/web/src/components/manipulation/visualizations/burst-heatmap.tsx` | Create | BarChart |
| `apps/web/src/components/manipulation/visualizations/trend-line.tsx` | Create | LineChart |
| `apps/web/src/components/manipulation/visualizations/temporal-bars.tsx` | Create | BarChart (current vs baseline) |
| `apps/web/src/components/manipulation/visualizations/vote-scatter.tsx` | Create | ScatterChart |
| `apps/web/src/components/manipulation/visualizations/similarity-cluster.tsx` | Create | 표 |
| `apps/web/src/components/manipulation/visualizations/media-sync-timeline.tsx` | Create | 표 |
| `apps/web/src/components/manipulation/visualizations/cross-platform-flow.tsx` | Create | 표 (Phase 5에 Sankey) |

### Tests
| 파일 | 변경 | 책임 |
|------|------|------|
| `apps/web/src/components/manipulation/__tests__/manipulation-view.test.tsx` | Create | 6 상태 분기 |
| `apps/web/src/components/manipulation/__tests__/evidence-card.test.tsx` | Create | viz.kind 7+1 분기 |
| `apps/web/src/components/manipulation/__tests__/timeseries-view.test.tsx` | Create | 빈 결과 + 정상 렌더 + 링크 |

---

**중요한 코드베이스 사실 (작업 전 숙지):**

- showcase 페이지는 **이미 7개 탭이 존재**함 (`activeTab === 0~6`). 새 탭은 **`activeTab === 7`**.
- showcase sidebar (`showcase-sidebar.tsx`)에도 탭 메뉴 항목을 동시에 추가해야 함 (page만 수정하면 메뉴에 안 나타남).
- 구독 페이지는 shadcn `<Tabs>` 사용 — `<TabsTrigger value="manipulation">` + `<TabsContent value="manipulation">` 한 쌍 추가만 하면 됨.
- 권한 헬퍼 위치: `apps/web/src/server/trpc/shared/verify-job-ownership.ts`, `verify-subscription-ownership.ts` (둘 다 이미 존재).
- 검증 데이터: jobId=273, subscriptionId=37, runId=`25bc0a41-c398-4022-93b8-e9790a0914a9` (Phase 2 dryrun으로 만들어짐, 7 signals + 29 evidence)

---

## Task 1: tRPC manipulationRouter 구현 + 테스트

**TDD 사이클.** 권한 검증이 핵심이라 테스트 먼저 작성.

**Files:**
- Create: `apps/web/src/server/trpc/routers/manipulation.ts`
- Create: `apps/web/src/server/trpc/routers/__tests__/manipulation.test.ts`

- [ ] **Step 1: 테스트 5건 작성**

`apps/web/src/server/trpc/routers/__tests__/manipulation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mocks
const verifyJobOwnership = vi.fn();
const verifySubscriptionOwnership = vi.fn();
const dbSelect = vi.fn();

vi.mock('../../shared/verify-job-ownership', () => ({
  verifyJobOwnership: (...args: unknown[]) => verifyJobOwnership(...args),
}));
vi.mock('../../shared/verify-subscription-ownership', () => ({
  verifySubscriptionOwnership: (...args: unknown[]) => verifySubscriptionOwnership(...args),
}));
vi.mock('@ai-signalcraft/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@ai-signalcraft/core');
  return {
    ...actual,
    getDb: () => ({
      select: (...args: unknown[]) => dbSelect(...args),
    }),
  };
});

const ctx = { userId: 'u1', teamId: 1, isAuthenticated: true } as never;

describe('manipulationRouter', () => {
  beforeEach(() => {
    verifyJobOwnership.mockReset();
    verifySubscriptionOwnership.mockReset();
    dbSelect.mockReset();
  });

  it('getRunByJobId — 권한 거부는 verifyJobOwnership throw를 그대로 전파', async () => {
    verifyJobOwnership.mockRejectedValueOnce(
      new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' }),
    );
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    await expect(caller.getRunByJobId({ jobId: 999 })).rejects.toThrow('작업을 찾을 수 없습니다');
  });

  it('getRunByJobId — manipulation_runs 행 없으면 null', async () => {
    verifyJobOwnership.mockResolvedValueOnce(undefined);
    // run select → 빈 배열
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    });
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    const result = await caller.getRunByJobId({ jobId: 273 });
    expect(result).toBeNull();
  });

  it('getRunByJobId — 정상 흐름은 run + signals + evidence를 합쳐 반환', async () => {
    verifyJobOwnership.mockResolvedValueOnce(undefined);
    const run = { id: 'r1', jobId: 273, status: 'completed', manipulationScore: 57.2 };
    const signals = [{ id: 's1', signal: 'burst', score: 99 }];
    const evidence = [{ id: 'e1', signal: 'burst', rank: 1, severity: 'high' }];
    dbSelect
      // run query
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([run]) }) }),
        }),
      })
      // signals query
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve(signals) }),
      })
      // evidence query (rank ASC)
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ orderBy: () => Promise.resolve(evidence) }),
        }),
      });
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    const result = await caller.getRunByJobId({ jobId: 273 });
    expect(result).toMatchObject({ id: 'r1', signals, evidence });
  });

  it('listRunsBySubscription — 권한 거부 throw 전파', async () => {
    verifySubscriptionOwnership.mockRejectedValueOnce(
      new TRPCError({ code: 'FORBIDDEN', message: '접근 거부' }),
    );
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    await expect(
      caller.listRunsBySubscription({ subscriptionId: 99, limit: 30 }),
    ).rejects.toThrow('접근 거부');
  });

  it('listRunsBySubscription — limit 적용, startedAt DESC 요약 반환', async () => {
    verifySubscriptionOwnership.mockResolvedValueOnce(undefined);
    const rows = [
      { id: 'r2', jobId: 280, manipulationScore: 60.1, confidenceFactor: 0.8, startedAt: new Date('2026-04-28'), status: 'completed' },
      { id: 'r1', jobId: 273, manipulationScore: 57.2, confidenceFactor: 0.84, startedAt: new Date('2026-04-26'), status: 'completed' },
    ];
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rows) }) }),
      }),
    });
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    const result = await caller.listRunsBySubscription({ subscriptionId: 37, limit: 30 });
    expect(result).toEqual(rows);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd /home/gon/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-phase3
pnpm --filter @ai-signalcraft/web test manipulation 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../manipulation'`

- [ ] **Step 3: router 구현**

`apps/web/src/server/trpc/routers/manipulation.ts`:

```typescript
import { z } from 'zod';
import { eq, desc, asc } from 'drizzle-orm';
import {
  getDb,
  manipulationRuns,
  manipulationSignals,
  manipulationEvidence,
} from '@ai-signalcraft/core';
import { router, protectedProcedure } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';
import { verifySubscriptionOwnership } from '../shared/verify-subscription-ownership';

export const manipulationRouter = router({
  getRunByJobId: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      // 1. 권한 — 헬퍼가 NOT_FOUND throw 또는 통과
      await verifyJobOwnership(ctx, input.jobId);

      // 2. run 조회 (가장 최근 1건; retry로 여러 row 가능)
      const [run] = await getDb()
        .select()
        .from(manipulationRuns)
        .where(eq(manipulationRuns.jobId, input.jobId))
        .orderBy(desc(manipulationRuns.startedAt))
        .limit(1);
      if (!run) return null;

      // 3. signals + evidence
      const signals = await getDb()
        .select()
        .from(manipulationSignals)
        .where(eq(manipulationSignals.runId, run.id));

      const evidence = await getDb()
        .select()
        .from(manipulationEvidence)
        .where(eq(manipulationEvidence.runId, run.id))
        .orderBy(asc(manipulationEvidence.rank));

      return { ...run, signals, evidence };
    }),

  listRunsBySubscription: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifySubscriptionOwnership(ctx, input.subscriptionId);

      return getDb()
        .select({
          id: manipulationRuns.id,
          jobId: manipulationRuns.jobId,
          manipulationScore: manipulationRuns.manipulationScore,
          confidenceFactor: manipulationRuns.confidenceFactor,
          startedAt: manipulationRuns.startedAt,
          status: manipulationRuns.status,
        })
        .from(manipulationRuns)
        .where(eq(manipulationRuns.subscriptionId, input.subscriptionId))
        .orderBy(desc(manipulationRuns.startedAt))
        .limit(input.limit);
    }),
});
```

만약 `getDb`/`manipulationRuns` 등이 `@ai-signalcraft/core` public API에 없으면, public API에 export 추가 필요. `packages/core/src/index.ts` 확인 후 누락된 항목 추가.

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm --filter @ai-signalcraft/web test manipulation 2>&1 | tail -10
```

Expected: 5 PASS

- [ ] **Step 5: tsc**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
```

Expected: `No errors found`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/trpc/routers/manipulation.ts \
        apps/web/src/server/trpc/routers/__tests__/manipulation.test.ts
# core public API 변경했다면 함께 add
git commit -m "feat(web): manipulationRouter 구현 (getRunByJobId, listRunsBySubscription)

권한은 기존 verifyJobOwnership/verifySubscriptionOwnership 헬퍼 재사용.
getRunByJobId는 retry된 동일 jobId의 가장 최근 1건만 반환.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Root router 등록

**Files:**
- Modify: `apps/web/src/server/trpc/router.ts`

- [ ] **Step 1: import + 등록**

`apps/web/src/server/trpc/router.ts`에 다음 라인을 다른 router import들과 같은 그룹에 추가:

```typescript
import { manipulationRouter } from './routers/manipulation';
```

그리고 `appRouter = router({...})` 객체에 한 줄 추가 (subscriptions 옆 근처):

```typescript
manipulation: manipulationRouter,
```

- [ ] **Step 2: tsc**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/trpc/router.ts
git commit -m "feat(web): root router에 manipulation 등록

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: ManipulationView 컨테이너 + 상태 분기

5번째 탭의 핵심 컨테이너. 이 task에서는 6가지 상태 분기를 구현하되, 내부 `<CompletedView>`는 임시로 `<pre>{JSON.stringify(data)}</pre>` 같은 placeholder로 둔다 (Task 4-5에서 실제 렌더). EmptyState/Error/Loading만 정식 구현.

**Files:**
- Create: `apps/web/src/components/manipulation/manipulation-view.tsx`
- Create: `apps/web/src/components/manipulation/__tests__/manipulation-view.test.tsx`

- [ ] **Step 1: 테스트 작성 (6 상태 분기)**

`apps/web/src/components/manipulation/__tests__/manipulation-view.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManipulationView } from '../manipulation-view';

const mockQuery = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    manipulation: {
      getRunByJobId: { query: (...args: unknown[]) => mockQuery(...args) },
    },
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ManipulationView', () => {
  it('isLoading 시 Skeleton 표시', () => {
    mockQuery.mockReturnValueOnce(new Promise(() => {})); // never resolve
    renderWithClient(<ManipulationView jobId={273} />);
    expect(screen.getByTestId('manipulation-skeleton')).toBeInTheDocument();
  });

  it('null 응답 시 EmptyState (구독 토글 안내)', async () => {
    mockQuery.mockResolvedValueOnce(null);
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText(/조작 신호 검출을 활성화/)).toBeInTheDocument();
  });

  it('status:running 시 RunningSpinner', async () => {
    mockQuery.mockResolvedValueOnce({ id: 'r1', status: 'running' });
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText(/분석 진행 중/)).toBeInTheDocument();
  });

  it('status:failed 시 errorDetails.message 노출', async () => {
    mockQuery.mockResolvedValueOnce({
      id: 'r1', status: 'failed', errorDetails: { message: '데이터 부족' },
    });
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText('데이터 부족')).toBeInTheDocument();
  });

  it('status:completed 시 CompletedView 마운트', async () => {
    mockQuery.mockResolvedValueOnce({
      id: 'r1', status: 'completed', manipulationScore: 57.2, confidenceFactor: 0.84,
      signals: [], evidence: [],
    });
    renderWithClient(<ManipulationView jobId={273} />);
    // Task 3 단계에서는 placeholder 마커만 검증
    expect(await screen.findByTestId('manipulation-completed')).toBeInTheDocument();
  });

  it('error 시 ErrorAlert', async () => {
    mockQuery.mockRejectedValueOnce(new Error('네트워크 오류'));
    renderWithClient(<ManipulationView jobId={273} />);
    expect(await screen.findByText(/네트워크 오류/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm --filter @ai-signalcraft/web test manipulation-view 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../manipulation-view'`

- [ ] **Step 3: 컴포넌트 구현**

`apps/web/src/components/manipulation/manipulation-view.tsx`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ManipulationViewProps {
  jobId: number;
}

export function ManipulationView({ jobId }: ManipulationViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['manipulation', 'run-by-job', jobId],
    queryFn: () => trpcClient.manipulation.getRunByJobId.query({ jobId }),
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && typeof d === 'object' && 'status' in d && d.status === 'running'
        ? 5000
        : false;
    },
  });

  if (isLoading) {
    return (
      <div data-testid="manipulation-skeleton" className="space-y-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          이 분석은 조작 신호 검출을 활성화하지 않았습니다.
        </p>
        <p className="text-xs text-muted-foreground">
          구독 설정에서 "여론 조작 신호 분석" 토글을 켜면 다음 분석부터 표시됩니다.
        </p>
      </div>
    );
  }

  if (data.status === 'running') {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        분석 진행 중... (자동 새로고침)
      </div>
    );
  }

  if (data.status === 'failed') {
    const msg = data.errorDetails?.message ?? '알 수 없는 오류';
    return (
      <Alert variant="destructive" className="m-6">
        <AlertDescription>{msg}</AlertDescription>
      </Alert>
    );
  }

  // status === 'completed'
  return (
    <div data-testid="manipulation-completed" className="space-y-4 p-6">
      {/* TODO Task 4-5: Hero + SignalGrid + EvidenceCards */}
      <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pnpm --filter @ai-signalcraft/web test manipulation-view 2>&1 | tail -10
```

Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/manipulation/
git commit -m "feat(web): ManipulationView 컨테이너 + 6가지 상태 분기

Hero/SignalGrid/EvidenceCard는 후속 task에서 구현. 현재는 completed 상태에서
JSON 덤프만 표시.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: ManipulationHero + SignalGrid

`<CompletedView>`의 첫 두 섹션. evidence 카드는 Task 5-6에서.

**Files:**
- Create: `apps/web/src/components/manipulation/manipulation-hero.tsx`
- Create: `apps/web/src/components/manipulation/signal-grid.tsx`
- Modify: `apps/web/src/components/manipulation/manipulation-view.tsx` (Task 3의 `<pre>` placeholder 교체)

- [ ] **Step 1: ManipulationHero 구현**

`apps/web/src/components/manipulation/manipulation-hero.tsx`:

```typescript
'use client';

import ReactMarkdown from 'react-markdown';

interface ManipulationHeroProps {
  manipulationScore: number | null;
  confidenceFactor: number | null;
  weightsVersion: string;
  narrativeMd: string | null;
}

function severityFromScore(score: number | null): 'low' | 'medium' | 'high' {
  if (score == null) return 'low';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

const SEVERITY_BG: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-gradient-to-br from-green-500 to-green-600',
  medium: 'bg-gradient-to-br from-yellow-500 to-orange-500',
  high: 'bg-gradient-to-br from-red-500 to-red-600',
};

const SEVERITY_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
};

export function ManipulationHero({
  manipulationScore,
  confidenceFactor,
  weightsVersion,
  narrativeMd,
}: ManipulationHeroProps) {
  const severity = severityFromScore(manipulationScore);

  return (
    <div className="space-y-4">
      <div className={`rounded-lg p-6 text-white ${SEVERITY_BG[severity]}`}>
        <div className="text-xs opacity-90">조작 점수</div>
        <div className="text-4xl font-bold">
          {manipulationScore != null ? manipulationScore.toFixed(1) : 'N/A'}
        </div>
        <div className="mt-2 flex justify-between text-xs opacity-90">
          <span>심각도: {SEVERITY_LABEL[severity]}</span>
          <span>
            신뢰도 {confidenceFactor != null ? confidenceFactor.toFixed(2) : 'N/A'}
            {' · '}
            {weightsVersion}
          </span>
        </div>
      </div>
      {narrativeMd && (
        <div className="prose prose-sm max-w-none rounded-lg border bg-card p-4">
          <ReactMarkdown>{narrativeMd}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: SignalGrid 구현**

`apps/web/src/components/manipulation/signal-grid.tsx`:

```typescript
'use client';

interface SignalRow {
  signal: string;
  score: number;
  confidence: number;
}

interface SignalGridProps {
  signals: SignalRow[];
}

const SIGNAL_LABELS: Record<string, string> = {
  burst: '트래픽 폭주',
  similarity: '유사도 클러스터',
  vote: '투표 이상',
  'media-sync': '매체 동조',
  'trend-shape': '트렌드 형상',
  'cross-platform': '크로스 플랫폼',
  temporal: '시간대 이상',
};

function severityClass(score: number): string {
  if (score >= 70) return 'bg-red-100 text-red-900 border-red-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-900 border-yellow-200';
  return 'bg-green-100 text-green-900 border-green-200';
}

export function SignalGrid({ signals }: SignalGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
      {signals.map((s) => (
        <div
          key={s.signal}
          className={`rounded-md border p-2 text-center ${severityClass(s.score)}`}
        >
          <div className="text-xs">{SIGNAL_LABELS[s.signal] ?? s.signal}</div>
          <div className="text-lg font-bold">{s.score.toFixed(0)}</div>
          <div className="text-[10px] opacity-70">신뢰 {s.confidence.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: ManipulationView placeholder 교체**

`apps/web/src/components/manipulation/manipulation-view.tsx`의 `data-testid="manipulation-completed"` div 내부 `<pre>` 라인을 다음으로 교체:

```typescript
import { ManipulationHero } from './manipulation-hero';
import { SignalGrid } from './signal-grid';
```

(상단 import 추가)

```typescript
  return (
    <div data-testid="manipulation-completed" className="space-y-4 p-6">
      <ManipulationHero
        manipulationScore={data.manipulationScore}
        confidenceFactor={data.confidenceFactor}
        weightsVersion={data.weightsVersion}
        narrativeMd={data.narrativeMd}
      />
      <SignalGrid signals={data.signals} />
      {/* TODO Task 5-6: Evidence cards */}
    </div>
  );
```

- [ ] **Step 4: 테스트 실행 (회귀)**

```bash
pnpm --filter @ai-signalcraft/web test manipulation-view 2>&1 | tail -10
```

Expected: 6 PASS — 기존 테스트가 여전히 통과 (`manipulation-completed` testid가 그대로 있음)

- [ ] **Step 5: tsc**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/manipulation/
git commit -m "feat(web): ManipulationHero + SignalGrid 구현

Hero는 severity 색상 그라디언트로 점수 강조, narrative_md를 react-markdown 렌더.
SignalGrid는 7신호를 score 임계값으로 색상 구분.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: EvidenceCard + visualization 분기 frame

이 task에서는 7개 viz 컴포넌트의 **stub** (모두 `<pre>{JSON.stringify(data)}</pre>` 형태)을 만들고, EvidenceCard에서 분기만 작동하게 한다. 실제 viz는 Task 6에서.

**이유:** evidence 데이터가 바인딩되는 frame을 먼저 검증하면, Task 6의 7개 viz를 병렬로 작업할 수 있다.

**Files:**
- Create: `apps/web/src/components/manipulation/visualizations/index.ts`
- Create: `apps/web/src/components/manipulation/visualizations/burst-heatmap.tsx`
- Create: `apps/web/src/components/manipulation/visualizations/trend-line.tsx`
- Create: `apps/web/src/components/manipulation/visualizations/temporal-bars.tsx`
- Create: `apps/web/src/components/manipulation/visualizations/vote-scatter.tsx`
- Create: `apps/web/src/components/manipulation/visualizations/similarity-cluster.tsx`
- Create: `apps/web/src/components/manipulation/visualizations/media-sync-timeline.tsx`
- Create: `apps/web/src/components/manipulation/visualizations/cross-platform-flow.tsx`
- Create: `apps/web/src/components/manipulation/evidence-card.tsx`
- Create: `apps/web/src/components/manipulation/__tests__/evidence-card.test.tsx`
- Modify: `apps/web/src/components/manipulation/manipulation-view.tsx`

- [ ] **Step 1: 7개 viz stub 작성**

각 stub 파일은 동일 패턴. 예시 — `apps/web/src/components/manipulation/visualizations/burst-heatmap.tsx`:

```typescript
'use client';

interface Props {
  data: { kind: 'burst-heatmap'; buckets: { ts: string; count: number; zScore: number }[] } | unknown;
}

export function BurstHeatmap({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'burst-heatmap') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (burst-heatmap)</span>;
  }
  // TODO Task 6: Recharts BarChart로 교체
  return (
    <pre className="text-xs overflow-x-auto rounded bg-muted p-2">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
```

나머지 6개 파일도 같은 패턴 (이름·kind 문자열만 다름):
- `trend-line.tsx` — kind `'trend-line'`
- `temporal-bars.tsx` — kind `'temporal-bars'`
- `vote-scatter.tsx` — kind `'vote-scatter'`
- `similarity-cluster.tsx` — kind `'similarity-cluster'`
- `media-sync-timeline.tsx` — kind `'media-sync-timeline'`
- `cross-platform-flow.tsx` — kind `'cross-platform-flow'`

`apps/web/src/components/manipulation/visualizations/index.ts`:

```typescript
export { BurstHeatmap } from './burst-heatmap';
export { TrendLine } from './trend-line';
export { TemporalBars } from './temporal-bars';
export { VoteScatter } from './vote-scatter';
export { SimilarityCluster } from './similarity-cluster';
export { MediaSyncTimeline } from './media-sync-timeline';
export { CrossPlatformFlow } from './cross-platform-flow';
```

- [ ] **Step 2: EvidenceCard + 테스트**

`apps/web/src/components/manipulation/__tests__/evidence-card.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceCard } from '../evidence-card';

const baseEvidence = {
  id: 'e1',
  runId: 'r1',
  signal: 'burst',
  severity: 'high' as const,
  title: '댓글 폭주 패턴',
  summary: '평균 대비 4배 폭주 구간 발견',
  rank: 1,
  rawRefs: [],
};

describe('EvidenceCard', () => {
  it('viz.kind=burst-heatmap → BurstHeatmap 렌더', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'burst-heatmap', buckets: [] } }} />);
    expect(screen.getByText(/burst-heatmap/)).toBeInTheDocument();
  });

  it('viz.kind=trend-line → TrendLine 렌더', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'trend-line', series: [] } }} />);
    expect(screen.getByText(/trend-line/)).toBeInTheDocument();
  });

  it('viz.kind=temporal-bars → TemporalBars 렌더', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'temporal-bars', bars: [] } }} />);
    expect(screen.getByText(/temporal-bars/)).toBeInTheDocument();
  });

  it('viz.kind=vote-scatter → VoteScatter 렌더', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'vote-scatter', points: [] } }} />);
    expect(screen.getByText(/vote-scatter/)).toBeInTheDocument();
  });

  it('viz.kind=similarity-cluster → SimilarityCluster 렌더', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'similarity-cluster', representative: 'x', matches: [] } }} />);
    expect(screen.getByText(/similarity-cluster/)).toBeInTheDocument();
  });

  it('viz.kind=media-sync-timeline → MediaSyncTimeline 렌더', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'media-sync-timeline', cluster: 'x', items: [] } }} />);
    expect(screen.getByText(/media-sync-timeline/)).toBeInTheDocument();
  });

  it('viz.kind=cross-platform-flow → CrossPlatformFlow 렌더', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'cross-platform-flow', hops: [] } }} />);
    expect(screen.getByText(/cross-platform-flow/)).toBeInTheDocument();
  });

  it('알 수 없는 kind → 폴백 메시지', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'unknown' as never } }} />);
    expect(screen.getByText(/시각화 형태가 인식되지 않습니다/)).toBeInTheDocument();
  });

  it('헤더에 severity, signal, title 표시', () => {
    render(<EvidenceCard evidence={{ ...baseEvidence, visualization: { kind: 'burst-heatmap', buckets: [] } }} />);
    expect(screen.getByText(/높음/)).toBeInTheDocument();
    expect(screen.getByText('댓글 폭주 패턴')).toBeInTheDocument();
  });
});
```

`apps/web/src/components/manipulation/evidence-card.tsx`:

```typescript
'use client';

import {
  BurstHeatmap,
  TrendLine,
  TemporalBars,
  VoteScatter,
  SimilarityCluster,
  MediaSyncTimeline,
  CrossPlatformFlow,
} from './visualizations';

const SEVERITY_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: '낮음',
  medium: '중간',
  high: '높음',
};

const SEVERITY_BADGE: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

interface EvidenceCardProps {
  evidence: {
    id: string;
    signal: string;
    severity: 'low' | 'medium' | 'high';
    title: string;
    summary: string;
    visualization: { kind: string; [k: string]: unknown };
    rawRefs: { itemId: string; source: string; time: string; excerpt: string }[];
  };
}

function renderViz(viz: { kind: string; [k: string]: unknown }) {
  switch (viz.kind) {
    case 'burst-heatmap': return <BurstHeatmap data={viz} />;
    case 'trend-line': return <TrendLine data={viz} />;
    case 'temporal-bars': return <TemporalBars data={viz} />;
    case 'vote-scatter': return <VoteScatter data={viz} />;
    case 'similarity-cluster': return <SimilarityCluster data={viz} />;
    case 'media-sync-timeline': return <MediaSyncTimeline data={viz} />;
    case 'cross-platform-flow': return <CrossPlatformFlow data={viz} />;
    default:
      return <span className="text-xs text-muted-foreground">시각화 형태가 인식되지 않습니다 ({String(viz.kind)})</span>;
  }
}

export function EvidenceCard({ evidence }: EvidenceCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-medium ${SEVERITY_BADGE[evidence.severity]}`}>
          {SEVERITY_LABEL[evidence.severity]}
        </span>
        <span className="text-muted-foreground">{evidence.signal}</span>
      </div>
      <h4 className="font-semibold">{evidence.title}</h4>
      <p className="text-sm text-muted-foreground">{evidence.summary}</p>
      {renderViz(evidence.visualization)}
      {evidence.rawRefs.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            원본 보기 ({evidence.rawRefs.length}건)
          </summary>
          <div className="mt-2 space-y-1">
            {evidence.rawRefs.map((ref) => (
              <div key={ref.itemId} className="rounded border bg-muted p-2">
                <div className="text-[10px] text-muted-foreground">
                  {ref.source} · {ref.time}
                </div>
                <div className="text-xs">{ref.excerpt}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 3: ManipulationView에 EvidenceCard 통합**

`manipulation-view.tsx`의 `manipulation-completed` div를 다음으로 업데이트:

```typescript
import { EvidenceCard } from './evidence-card';
```

(상단 import 추가)

```typescript
  return (
    <div data-testid="manipulation-completed" className="space-y-4 p-6">
      <ManipulationHero ... />
      <SignalGrid signals={data.signals} />
      {data.evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">증거 카드가 없습니다 (점수만 산출됨).</p>
      ) : (
        <div className="space-y-3">
          {data.evidence.map((e) => <EvidenceCard key={e.id} evidence={e} />)}
        </div>
      )}
    </div>
  );
```

- [ ] **Step 4: 테스트 실행**

```bash
pnpm --filter @ai-signalcraft/web test manipulation 2>&1 | tail -10
```

Expected: PASS (5 router + 6 view + 9 evidence-card = 20 PASS)

- [ ] **Step 5: tsc**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/manipulation/
git commit -m "feat(web): EvidenceCard + 7개 viz stub + 분기 frame

각 viz 컴포넌트는 임시로 JSON 덤프. Task 6에서 Recharts/표 구현.
EvidenceCard는 severity 뱃지·원본 collapsible 포함.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 7개 visualization 실제 구현

각 viz를 실제 Recharts/표 형태로 교체. **task가 가장 큼** — subagent로 위임할 때는 이 task 하나에 모든 7개 viz 코드를 명시적으로 포함시켜 dispatch 단위를 1회로 유지.

**Files:**
- Modify: `apps/web/src/components/manipulation/visualizations/burst-heatmap.tsx`
- Modify: `apps/web/src/components/manipulation/visualizations/trend-line.tsx`
- Modify: `apps/web/src/components/manipulation/visualizations/temporal-bars.tsx`
- Modify: `apps/web/src/components/manipulation/visualizations/vote-scatter.tsx`
- Modify: `apps/web/src/components/manipulation/visualizations/similarity-cluster.tsx`
- Modify: `apps/web/src/components/manipulation/visualizations/media-sync-timeline.tsx`
- Modify: `apps/web/src/components/manipulation/visualizations/cross-platform-flow.tsx`

- [ ] **Step 1: BurstHeatmap (BarChart)**

```typescript
'use client';

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data: { kind: 'burst-heatmap'; buckets: { ts: string; count: number; zScore: number }[] } | unknown;
}

function colorForZ(z: number): string {
  if (z >= 3) return '#dc2626';
  if (z >= 2) return '#f97316';
  if (z >= 1) return '#eab308';
  return '#94a3b8';
}

export function BurstHeatmap({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'burst-heatmap') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (burst-heatmap)</span>;
  }
  const buckets = (data as { buckets: { ts: string; count: number; zScore: number }[] }).buckets;
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer>
        <BarChart data={buckets}>
          <XAxis dataKey="ts" tick={{ fontSize: 10 }} hide />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number, _n, p) => [`${v} (z=${p?.payload?.zScore?.toFixed(2)})`, '댓글 수']} />
          <Bar dataKey="count">
            {buckets.map((b, i) => <Cell key={i} fill={colorForZ(b.zScore)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: TrendLine (LineChart)**

```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, ReferenceDot, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data: { kind: 'trend-line'; series: { ts: string; count: number; isChangePoint: boolean }[] } | unknown;
}

export function TrendLine({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'trend-line') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (trend-line)</span>;
  }
  const series = (data as { series: { ts: string; count: number; isChangePoint: boolean }[] }).series;
  if (!Array.isArray(series) || series.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  const changePoints = series.filter((s) => s.isChangePoint);
  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer>
        <LineChart data={series}>
          <XAxis dataKey="ts" tick={{ fontSize: 10 }} hide />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" dot={false} strokeWidth={2} />
          {changePoints.map((cp, i) => (
            <ReferenceDot key={i} x={cp.ts} y={cp.count} r={4} fill="#fbbf24" stroke="#f59e0b" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: TemporalBars (BarChart, current vs baseline)**

```typescript
'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
  data: { kind: 'temporal-bars'; bars: { hour: number; current: number; baseline: number }[] } | unknown;
}

export function TemporalBars({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'temporal-bars') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (temporal-bars)</span>;
  }
  const bars = (data as { bars: { hour: number; current: number; baseline: number }[] }).bars;
  if (!Array.isArray(bars) || bars.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer>
        <BarChart data={bars}>
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="baseline" fill="#94a3b8" name="기준치" />
          <Bar dataKey="current" fill="#dc2626" name="현재" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: VoteScatter (ScatterChart)**

```typescript
'use client';

import { ScatterChart, Scatter, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data: { kind: 'vote-scatter'; points: { length: number; likes: number; isOutlier: boolean }[] } | unknown;
}

export function VoteScatter({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'vote-scatter') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (vote-scatter)</span>;
  }
  const points = (data as { points: { length: number; likes: number; isOutlier: boolean }[] }).points;
  if (!Array.isArray(points) || points.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer>
        <ScatterChart>
          <XAxis dataKey="length" name="댓글 길이" tick={{ fontSize: 10 }} />
          <YAxis dataKey="likes" name="좋아요" tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={points}>
            {points.map((p, i) => <Cell key={i} fill={p.isOutlier ? '#dc2626' : '#94a3b8'} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: SimilarityCluster (표)**

```typescript
'use client';

interface Props {
  data: {
    kind: 'similarity-cluster';
    representative: string;
    matches: { author: string | null; source: string; time: string; text: string }[];
  } | unknown;
}

export function SimilarityCluster({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'similarity-cluster') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (similarity-cluster)</span>;
  }
  const d = data as {
    representative: string;
    matches: { author: string | null; source: string; time: string; text: string }[];
  };
  return (
    <div className="space-y-2 text-xs">
      <div className="rounded bg-muted p-2">
        <span className="text-muted-foreground">대표 텍스트: </span>
        <span className="font-medium">{d.representative}</span>
      </div>
      {Array.isArray(d.matches) && d.matches.length > 0 ? (
        <div className="rounded border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-1 text-left">작성자</th>
                <th className="p-1 text-left">소스</th>
                <th className="p-1 text-left">시간</th>
                <th className="p-1 text-left">내용</th>
              </tr>
            </thead>
            <tbody>
              {d.matches.map((m, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{m.author ?? '익명'}</td>
                  <td className="p-1">{m.source}</td>
                  <td className="p-1">{m.time}</td>
                  <td className="p-1">{m.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">매치 없음</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: MediaSyncTimeline (표)**

```typescript
'use client';

interface Props {
  data: {
    kind: 'media-sync-timeline';
    cluster: string;
    items: { publisher: string | null; time: string; headline: string }[];
  } | unknown;
}

export function MediaSyncTimeline({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'media-sync-timeline') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (media-sync-timeline)</span>;
  }
  const d = data as {
    cluster: string;
    items: { publisher: string | null; time: string; headline: string }[];
  };
  return (
    <div className="space-y-2 text-xs">
      <div className="rounded bg-muted p-2">
        <span className="text-muted-foreground">클러스터: </span>
        <span className="font-medium">{d.cluster}</span>
      </div>
      {Array.isArray(d.items) && d.items.length > 0 ? (
        <div className="rounded border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="p-1 text-left">시간</th>
                <th className="p-1 text-left">매체</th>
                <th className="p-1 text-left">헤드라인</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{it.time}</td>
                  <td className="p-1">{it.publisher ?? '?'}</td>
                  <td className="p-1">{it.headline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground">항목 없음</p>
      )}
    </div>
  );
}
```

- [ ] **Step 7: CrossPlatformFlow (표)**

```typescript
'use client';

interface Props {
  data: {
    kind: 'cross-platform-flow';
    hops: { from: string; to: string; time: string; message: string; count: number }[];
  } | unknown;
}

export function CrossPlatformFlow({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'cross-platform-flow') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (cross-platform-flow)</span>;
  }
  const d = data as {
    hops: { from: string; to: string; time: string; message: string; count: number }[];
  };
  return Array.isArray(d.hops) && d.hops.length > 0 ? (
    <div className="rounded border overflow-hidden text-xs">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="p-1 text-left">시간</th>
            <th className="p-1 text-left">출처</th>
            <th className="p-1 text-left">→</th>
            <th className="p-1 text-left">대상</th>
            <th className="p-1 text-left">메시지</th>
            <th className="p-1 text-right">횟수</th>
          </tr>
        </thead>
        <tbody>
          {d.hops.map((h, i) => (
            <tr key={i} className="border-t">
              <td className="p-1">{h.time}</td>
              <td className="p-1">{h.from}</td>
              <td className="p-1 text-muted-foreground">→</td>
              <td className="p-1">{h.to}</td>
              <td className="p-1">{h.message}</td>
              <td className="p-1 text-right">{h.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">홉 없음</span>
  );
}
```

- [ ] **Step 8: 회귀 테스트**

```bash
cd /home/gon/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-phase3
pnpm --filter @ai-signalcraft/web test manipulation 2>&1 | tail -10
pnpm tsc --noEmit 2>&1 | tail -3
```

Expected:
- 모든 manipulation 테스트 PASS (Task 5의 evidence-card 테스트는 viz 컴포넌트의 `kind` 문자열을 본문에 출력하는지 검증했는데 — Task 6에서 stub의 `JSON.stringify` 출력이 사라졌으므로 테스트 방식이 깨질 수 있음. 검증 방식을 `data-testid`로 바꿔야 함 — 다음 step에서.)

- [ ] **Step 9: evidence-card 테스트를 testid 기반으로 갱신**

각 viz 컴포넌트에 정상 렌더 시 root에 `data-testid` 추가. 예: `BurstHeatmap`의 `<div className="h-[160px]...">`에 `data-testid="viz-burst-heatmap"` 추가. 모든 7개 viz 동일.

`apps/web/src/components/manipulation/__tests__/evidence-card.test.tsx`의 7개 case에서 `screen.getByText(/burst-heatmap/)` → `screen.getByTestId('viz-burst-heatmap')`로 교체. 같은 패턴으로 7개 모두.

`unknown kind` 케이스만 텍스트 검증 유지 (`/시각화 형태가 인식되지 않습니다/`).

- [ ] **Step 10: 테스트 통과**

```bash
pnpm --filter @ai-signalcraft/web test manipulation 2>&1 | tail -10
```

Expected: 모든 PASS

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/manipulation/
git commit -m "feat(web): 7개 visualization 실제 구현 (Recharts + 표)

burst/trend/temporal: BarChart/LineChart, vote: ScatterChart.
similarity/media-sync/cross-platform: 표 (Sankey는 Phase 5).
각 viz는 입력 shape 런타임 가드로 폴백 메시지 표시.
evidence-card 테스트는 data-testid 기반으로 갱신.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: TimeseriesView + 잡 표 (구독 탭)

**Files:**
- Create: `apps/web/src/components/manipulation/timeseries-view.tsx`
- Create: `apps/web/src/components/manipulation/__tests__/timeseries-view.test.tsx`

- [ ] **Step 1: 테스트 작성**

`apps/web/src/components/manipulation/__tests__/timeseries-view.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimeseriesView } from '../timeseries-view';

const mockQuery = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    manipulation: {
      listRunsBySubscription: { query: (...args: unknown[]) => mockQuery(...args) },
    },
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('TimeseriesView', () => {
  it('빈 결과 시 EmptyState', async () => {
    mockQuery.mockResolvedValueOnce([]);
    renderWithClient(<TimeseriesView subscriptionId={37} />);
    expect(await screen.findByText(/manipulation 분석 이력이 없습니다/)).toBeInTheDocument();
  });

  it('runs 배열 렌더 — 표에 jobId 표시', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 'r1', jobId: 273, manipulationScore: 57.2, confidenceFactor: 0.84, startedAt: '2026-04-28T07:00:00Z', status: 'completed' },
      { id: 'r2', jobId: 280, manipulationScore: 60.1, confidenceFactor: 0.81, startedAt: '2026-04-29T07:00:00Z', status: 'completed' },
    ]);
    renderWithClient(<TimeseriesView subscriptionId={37} />);
    expect(await screen.findByText('273')).toBeInTheDocument();
    expect(screen.getByText('280')).toBeInTheDocument();
  });

  it('상세 보기 링크가 /showcase/{jobId}를 가리킴', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 'r1', jobId: 273, manipulationScore: 57.2, confidenceFactor: 0.84, startedAt: '2026-04-28T07:00:00Z', status: 'completed' },
    ]);
    renderWithClient(<TimeseriesView subscriptionId={37} />);
    const link = (await screen.findByText(/상세 보기/)).closest('a');
    expect(link).toHaveAttribute('href', '/showcase/273');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
pnpm --filter @ai-signalcraft/web test timeseries 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../timeseries-view'`

- [ ] **Step 3: 컴포넌트 구현**

`apps/web/src/components/manipulation/timeseries-view.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { trpcClient } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';

interface TimeseriesViewProps {
  subscriptionId: number;
}

export function TimeseriesView({ subscriptionId }: TimeseriesViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['manipulation', 'list-by-sub', subscriptionId],
    queryFn: () =>
      trpcClient.manipulation.listRunsBySubscription.query({ subscriptionId, limit: 30 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="p-4 text-sm text-red-600">{error.message}</p>;
  }

  if (!data || data.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        이 구독의 manipulation 분석 이력이 없습니다.
      </p>
    );
  }

  // chart 시간 오름차순
  const chartData = [...data].reverse().map((r) => ({
    ts: typeof r.startedAt === 'string' ? r.startedAt : r.startedAt.toISOString(),
    score: r.manipulationScore ?? 0,
    jobId: r.jobId,
  }));

  return (
    <div className="space-y-4 p-4">
      <div className="h-[220px] w-full">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey="ts" tick={{ fontSize: 10 }} hide />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <ReferenceLine y={50} stroke="#fbbf24" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="score" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded border overflow-hidden text-sm">
        <table className="w-full">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-2 text-left">시간</th>
              <th className="p-2 text-left">jobId</th>
              <th className="p-2 text-right">점수</th>
              <th className="p-2 text-right">신뢰도</th>
              <th className="p-2 text-left">상태</th>
              <th className="p-2 text-right">상세</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const ts = typeof r.startedAt === 'string'
                ? new Date(r.startedAt).toLocaleString('ko-KR')
                : r.startedAt.toLocaleString('ko-KR');
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{ts}</td>
                  <td className="p-2">{r.jobId}</td>
                  <td className="p-2 text-right">
                    {r.manipulationScore != null ? r.manipulationScore.toFixed(1) : '—'}
                  </td>
                  <td className="p-2 text-right">
                    {r.confidenceFactor != null ? r.confidenceFactor.toFixed(2) : '—'}
                  </td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2 text-right">
                    <Link href={`/showcase/${r.jobId}`} className="text-blue-600 hover:underline">
                      상세 보기 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과**

```bash
pnpm --filter @ai-signalcraft/web test timeseries 2>&1 | tail -10
```

Expected: 3 PASS

- [ ] **Step 5: tsc**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/manipulation/
git commit -m "feat(web): TimeseriesView — 라인 차트 + 잡 표 + showcase 링크

Y축 0-100 고정, 임계선 50. 표는 startedAt DESC, 각 row의 상세 링크는
/showcase/{jobId}로 점프.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 페이지 통합 — showcase 새 탭 + 구독 새 탭

**Files:**
- Modify: `apps/web/src/app/showcase/[jobId]/page.tsx`
- Modify: `apps/web/src/components/layout/showcase-sidebar.tsx`
- Modify: `apps/web/src/app/subscriptions/[id]/page.tsx`

### showcase 탭

- [ ] **Step 1: showcase page에 탭 7 추가**

`apps/web/src/app/showcase/[jobId]/page.tsx`의 import 그룹에 추가:

```typescript
import { ManipulationView } from '@/components/manipulation/manipulation-view';
```

기존 `{activeTab === 6 && <ExploreView jobId={jobId} />}` 다음 줄에 추가:

```typescript
      {activeTab === 7 && <ManipulationView jobId={jobId} />}
```

- [ ] **Step 2: showcase-sidebar에 메뉴 추가**

`apps/web/src/components/layout/showcase-sidebar.tsx`에서 기존 6개 탭 메뉴 항목과 같은 패턴으로 7번째를 추가. 정확한 패턴은 파일 내 기존 6번째 메뉴 항목(`Explore`)을 그대로 복사하고 라벨/인덱스만 변경:

```typescript
// 기존 마지막 항목 다음에:
{
  id: 7,
  label: '조작 신호',
  // 기존 항목과 동일한 icon prop 패턴 (파일 내 다른 메뉴 참조)
}
```

(메뉴 데이터 형태는 파일에서 직접 확인 후 동일하게 매칭)

- [ ] **Step 3: 구독 page에 manipulation 탭 추가**

`apps/web/src/app/subscriptions/[id]/page.tsx`의 import에 추가:

```typescript
import { TimeseriesView } from '@/components/manipulation/timeseries-view';
```

기존 4개 `<TabsTrigger>` 다음 줄에 추가 (line 148 부근):

```typescript
              <TabsTrigger value="manipulation">조작 분석</TabsTrigger>
```

기존 `<TabsContent value="settings">` 직전에 추가:

```typescript
            <TabsContent value="manipulation">
              <TimeseriesView subscriptionId={Number(params.id)} />
            </TabsContent>
```

(`params.id`의 정확한 변수명은 파일 상단을 보고 일치시킬 것 — `id`, `subscriptionId`, `params.id` 중 어떤지)

- [ ] **Step 4: tsc + 전체 테스트**

```bash
cd /home/gon/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-phase3
pnpm tsc --noEmit 2>&1 | tail -3
pnpm --filter @ai-signalcraft/web test 2>&1 | tail -5
```

Expected:
- tsc: No errors
- 모든 web 테스트 PASS (50 + 신규 ~20 = ~70 PASS)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/showcase/[jobId]/page.tsx \
        apps/web/src/components/layout/showcase-sidebar.tsx \
        apps/web/src/app/subscriptions/[id]/page.tsx
git commit -m "feat(web): showcase 7번째 탭 + 구독 manipulation 탭 통합

showcase는 sidebar 메뉴 + page activeTab 둘 다 추가.
구독은 shadcn Tabs에 한 쌍 추가.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 회귀 게이트 + E2E

전체 검증.

- [ ] **Step 1: 전체 tsc**

```bash
cd /home/gon/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-phase3
pnpm tsc --noEmit 2>&1 | tail -3
```

Expected: `No errors found`

- [ ] **Step 2: core 테스트 (회귀)**

```bash
pnpm --filter @ai-signalcraft/core test 2>&1 | tail -5
```

Expected: 452 PASS (Phase 2.5 baseline)

- [ ] **Step 3: web 전체 테스트**

```bash
pnpm --filter @ai-signalcraft/web test 2>&1 | tail -5
```

Expected: ~70 PASS (50 기존 + 신규 ~20)

- [ ] **Step 4: lint**

```bash
pnpm lint 2>&1 | tail -5
```

Expected: 0 errors. warnings는 pre-existing 384건 정도 유지.

- [ ] **Step 5: dev 서버에서 E2E 수동 검증 (선택, sanity check)**

```bash
# COLLECTOR_URL을 192.168.0.5:3401로 override (worktree에 .env 없을 수 있음)
COLLECTOR_URL=http://192.168.0.5:3401 pnpm dev 2>&1 &
```

브라우저에서:
1. `/showcase/273` → 7번째 탭 "조작 신호" 클릭 → Hero(57.2) + 7신호 그리드 + 29개 evidence card 표시 확인
2. `/subscriptions/37` → "조작 분석" 탭 → LineChart + 잡 표 (jobId=273 포함) → "상세 보기" 클릭 → /showcase/273로 이동 확인
3. 토글 OFF 구독의 잡 (예: 다른 jobId) → /showcase/{X} 7탭 → EmptyState 메시지 확인

E2E는 Phase 2 dryrun으로 만든 데이터 그대로 활용 가능 — 추가 데이터 생성 불필요.

- [ ] **Step 6: 게이트 통과 확인 — 추가 커밋 없음**

위 4단계가 모두 통과하면 Task 9 완료.

---

## Self-Review Checklist (작성자 확인용)

**1. Spec coverage:**
- tRPC router 2 procedures + 권한 → Task 1
- root router 등록 → Task 2
- ManipulationView 6 상태 → Task 3
- ManipulationHero + SignalGrid → Task 4
- EvidenceCard 분기 frame + 7 viz stub → Task 5
- 7 viz 실제 구현 → Task 6
- TimeseriesView (라인+표+링크) → Task 7
- showcase 7탭 + sidebar + 구독 새 탭 → Task 8
- 회귀 + E2E → Task 9
- 모든 Spec 항목이 task에 매핑됨 ✓

**2. Placeholder scan:**
- "TODO Task X" 같은 코드 내 marker는 placeholder 아닌 *task 내 단계 포인터*. 명확히 후속 task 번호 명시 ✓
- "기존 항목과 동일한 icon prop 패턴 (파일 내 다른 메뉴 참조)" — sidebar 메뉴 형태가 파일별로 다양해 일반화하기 어려움. implementer가 파일 직접 확인하라고 명시. 이건 내재적 한계 ✓
- `params.id` 변수명 확인 지시 → 같은 이유. file 직접 확인 필요 ✓

**3. Type consistency:**
- `manipulation_runs` 컬럼명 (`manipulationScore`, `confidenceFactor`, `startedAt`, `status`) — Task 1 router, Task 4 Hero, Task 7 TimeseriesView 모두 일치 ✓
- `evidence` shape (`id`, `signal`, `severity`, `title`, `summary`, `visualization`, `rawRefs`, `rank`) — Task 1 router, Task 5 EvidenceCard 일치 ✓
- viz.kind 7개 문자열 — Spec, Task 5, Task 6 모두 동일 (`burst-heatmap`, `trend-line`, `temporal-bars`, `vote-scatter`, `similarity-cluster`, `media-sync-timeline`, `cross-platform-flow`) ✓

---

## Estimated Effort

- Task 1: 30분 (router + 5 mock 테스트)
- Task 2: 5분
- Task 3: 20분 (6 상태 분기)
- Task 4: 15분 (Hero + SignalGrid)
- Task 5: 25분 (7 stub + EvidenceCard + 9 테스트)
- Task 6: 45분 (7 viz 실제 구현)
- Task 7: 25분 (LineChart + 표 + 3 테스트)
- Task 8: 20분 (3 페이지 통합 + sidebar 메뉴)
- Task 9: 10분 (검증)

**총 ~3.5시간.** subagent-driven-development로 진행 시 task 1+2 병합, task 5+6 병합 가능 — dispatch 6회 정도.
