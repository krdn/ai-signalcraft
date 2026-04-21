# 구독 기반 분석 단축 경로 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구독 모드에서 수집+정규화+감정분석을 건너뛰고 collector API에서 직접 데이터를 가져와 AI 분석만 실행하며, 전용 마법사 페이지(`/subscriptions/analyze`)를 제공한다.

**Architecture:** 구독 전용 tRPC mutation(`triggerSubscription`)이 `collection_jobs` 레코드 생성 후 직접 `analysis` 큐에 잡을 등록한다. Analysis worker는 잡 데이터의 `useCollectorLoader` 플래그로 collector API 경로를 선택하고, `skipItemAnalysis` 플래그로 Stage 0을 스킵한다. 프론트엔드는 `/subscriptions/analyze`에 4단계 마법사 페이지를 구현한다.

**Tech Stack:** Next.js 15 App Router, tRPC 11, BullMQ 5, Drizzle ORM, shadcn/ui, SSE

---

## File Structure

```
수정 파일:
  packages/core/src/db/schema/collections.ts          — options 타입에 subscriptionId, skipItemAnalysis 추가
  packages/core/src/queue/flows.ts                     — triggerSubscriptionAnalysis() 신규 함수
  packages/core/src/analysis/data-loader.ts            — loadAnalysisInputViaCollector()에 subscriptionId 전달
  packages/core/src/analysis/pipeline-orchestrator.ts  — useCollectorLoader 잡 데이터 기반 분기, Stage 0 스킵
  packages/core/src/queue/analysis-worker.ts            — 잡 데이터에서 useCollectorLoader 추출
  apps/web/src/server/trpc/routers/analysis.ts          — triggerSubscription mutation 추가, 기존 subscriptionId 분기 제거
  apps/web/src/app/subscriptions/layout.tsx             — NAV_ITEMS에 "분석 실행" 추가

신규 파일:
  apps/web/src/app/subscriptions/analyze/page.tsx                — 마법사 페이지
  apps/web/src/components/subscriptions/analyze/analyze-wizard.tsx            — 스텝퍼 + 레이아웃
  apps/web/src/components/subscriptions/analyze/subscription-select-step.tsx  — Step 1: 구독 카드 그리드
  apps/web/src/components/subscriptions/analyze/analysis-config-step.tsx      — Step 2: 분석 설정 폼
  apps/web/src/components/subscriptions/analyze/analysis-running-step.tsx     — Step 3: PipelineMonitor 래핑
  apps/web/src/components/subscriptions/analyze/analysis-result-step.tsx      — Step 4: ReportView 래핑
```

---

### Task 1: DB 스키마 options 타입 확장

**Files:**
- Modify: `packages/core/src/db/schema/collections.ts:53-65`

- [ ] **Step 1: options 타입에 subscriptionId, skipItemAnalysis, useCollectorLoader 추가**

`packages/core/src/db/schema/collections.ts`의 `options` 타입을 확장:

```typescript
options: jsonb('options').$type<{
  enableItemAnalysis?: boolean;
  tokenOptimization?:
    | 'none' | 'light' | 'standard' | 'aggressive'
    | 'rag-light' | 'rag-standard' | 'rag-aggressive';
  limitMode?: 'perDay' | 'total';
  subscriptionId?: number;
  skipItemAnalysis?: boolean;
  useCollectorLoader?: boolean;
}>(),
```

- [ ] **Step 2: 커밋**

```bash
git add packages/core/src/db/schema/collections.ts
git commit -m "feat: collection_jobs options 타입에 subscriptionId, skipItemAnalysis, useCollectorLoader 추가"
```

---

### Task 2: `triggerSubscriptionAnalysis()` 신규 함수

**Files:**
- Modify: `packages/core/src/queue/flows.ts`

- [ ] **Step 1: `triggerSubscriptionAnalysis` 함수 추가**

`packages/core/src/queue/flows.ts`의 `triggerAnalysis` 함수(라인 492) 아래에 추가:

```typescript
/**
 * 구독 분석 단축 경로 — 수집/정규화/persist/classify를 건너뛰고
 * analysis 큐에 바로 run-analysis 잡을 등록.
 */
export async function triggerSubscriptionAnalysis(
  dbJobId: number,
  keyword: string,
) {
  const queue = new Queue('analysis', getBullMQOptions());
  try {
    const job = await queue.add('run-analysis', {
      dbJobId,
      keyword,
      useCollectorLoader: true,
    }, {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    });
    return job;
  } finally {
    await queue.close();
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/core/src/queue/flows.ts
git commit -m "feat: triggerSubscriptionAnalysis() 신규 함수 — 구독 분석 단축 경로"
```

---

### Task 3: Data Loader — subscriptionId 전달 복원

**Files:**
- Modify: `packages/core/src/analysis/data-loader.ts:137-159`

- [ ] **Step 1: `loadAnalysisInputViaCollector()`에서 subscriptionId 전달**

```typescript
export async function loadAnalysisInputViaCollector(jobId: number): Promise<AnalysisInput> {
  const [job] = await getDb()
    .select()
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`Collection job not found: ${jobId}`);
  }

  const ensureDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
  const opts = job.options as Record<string, unknown> | undefined;

  return loadAnalysisInputFromCollector({
    jobId,
    keyword: job.keyword,
    dateRange: {
      start: ensureDate(job.startDate),
      end: ensureDate(job.endDate),
    },
    domain: (job.domain as AnalysisDomain) || undefined,
    subscriptionId: (opts?.subscriptionId as number) || undefined,
  });
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/core/src/analysis/data-loader.ts
git commit -m "fix: loadAnalysisInputViaCollector에서 subscriptionId를 collector API에 전달"
```

---

### Task 4: Pipeline Orchestrator — collector loader 분기 + Stage 0 스킵

**Files:**
- Modify: `packages/core/src/analysis/pipeline-orchestrator.ts`
- Modify: `packages/core/src/queue/analysis-worker.ts`

- [ ] **Step 1: analysis-worker에서 useCollectorLoader 추출 및 전달**

`packages/core/src/queue/analysis-worker.ts`의 `job.data` 디스트럭처링에 `useCollectorLoader` 추가:

```typescript
const { dbJobId, keyword, resumeOptions, useCollectorLoader } = job.data;
```

`runAnalysisPipeline` 호출에 옵션 전달:

```typescript
result = await runAnalysisPipeline(dbJobId, {
  ...resumeOptions,
  useCollectorLoader,
});
```

이를 위해 `ResumeOptions` 타입(또는 호출 옵션 타입)에 `useCollectorLoader?: boolean` 추가가 필요하다면 `pipeline-orchestrator.ts`의 `ResumeOptions` 인터페이스에 추가.

- [ ] **Step 2: pipeline-orchestrator에서 잡 데이터 기반 collector loader 선택**

`packages/core/src/analysis/pipeline-orchestrator.ts` 라인 72-74 수정:

```typescript
const job = await getDb()
  .select()
  .from(collectionJobs)
  .where(eq(collectionJobs.id, jobId))
  .limit(1)
  .then(r => r[0]);
const jobOptions = (job?.options as Record<string, unknown>) || {};

let input = (options?.useCollectorLoader || jobOptions.useCollectorLoader || shouldUseCollectorLoader())
  ? await loadAnalysisInputViaCollector(jobId)
  : await loadAnalysisInput(jobId);
```

- [ ] **Step 3: Stage 0 스킵 로직 추가**

같은 파일의 Stage 0 영역(라인 212-226) 수정:

```typescript
// Stage 0: 개별 항목 분석 — 구독 단축 경로에서는 스킵
const shouldSkipItemAnalysis =
  options?.skipItemAnalysis || jobOptions.skipItemAnalysis;

if (!shouldSkipItemAnalysis) {
  try {
    await analyzeItems(jobId);
  } catch (error) {
    console.error(`[runner] 개별 항목 분석 실패:`, error);
    await updateJobProgress(jobId, {
      'item-analysis': { status: 'failed', phase: 'error' },
    }).catch(() => {});
  }
} else {
  console.log(`[pipeline] 구독 단축 경로: Stage 0(개별 감정 분석) 스킵`);
  await appendJobEvent(jobId, 'info', '구독 단축 경로: 개별 감정 분석 스킵 (collector에서 이미 완료)').catch(() => {});
}
```

- [ ] **Step 4: `ResumeOptions` 타입에 `useCollectorLoader`, `skipItemAnalysis` 추가**

```typescript
export interface ResumeOptions {
  retryModules?: string[];
  reportOnly?: boolean;
  useCollectorLoader?: boolean;
  skipItemAnalysis?: boolean;
}
```

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/analysis/pipeline-orchestrator.ts packages/core/src/queue/analysis-worker.ts
git commit -m "feat: 구독 단축 경로 — collector loader 잡 데이터 분기 + Stage 0 스킵"
```

---

### Task 5: tRPC — `triggerSubscription` mutation

**Files:**
- Modify: `apps/web/src/server/trpc/routers/analysis.ts`

- [ ] **Step 1: `triggerSubscription` mutation 추가**

`analysisRouter`에 새 mutation 추가. 기존 `analysis.trigger` 라인 24~317 이후에 배치:

```typescript
triggerSubscription: protectedProcedure
  .input(
    z.object({
      subscriptionId: z.number(),
      startDate: z.string(),
      endDate: z.string(),
      domain: z.enum([
        'political', 'economic', 'social', 'technology',
        'fandom', 'pr', 'corporate', 'finance',
        'healthcare', 'sports', 'education', 'general',
      ]).optional(),
      optimizationPreset: z.enum([
        'none', 'light', 'standard', 'aggressive',
        'rag-light', 'rag-standard', 'rag-aggressive',
      ]).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // 1. 구독 검증
    const sub = await getCollectorClient().subscriptions.get.query({
      id: input.subscriptionId,
    });
    if (!sub || sub.ownerId !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: '해당 구독에 접근할 수 없습니다.' });
    }
    if (sub.status !== 'active') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '비활성 구독입니다.' });
    }

    // 2. collection_jobs 레코드 생성
    const [job] = await getDb()
      .insert(collectionJobs)
      .values({
        keyword: sub.keyword,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        sources: sub.sources,
        status: 'running',
        domain: input.domain || sub.domain || 'general',
        userId: ctx.userId,
        options: {
          subscriptionId: input.subscriptionId,
          skipItemAnalysis: true,
          useCollectorLoader: true,
          tokenOptimization: input.optimizationPreset ?? 'rag-standard',
        },
      })
      .returning({ id: collectionJobs.id });

    if (!job) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '잡 생성 실패' });

    // 3. 단축 경로 — analysis 큐에 직접 등록
    await triggerSubscriptionAnalysis(job.id, sub.keyword);

    return { jobId: job.id, keyword: sub.keyword };
  }),
```

- [ ] **Step 2: 기존 `analysis.trigger`에서 subscriptionId 분기 제거**

기존 `analysis.trigger` mutation에서:
- 라인 94 `subscriptionId: z.number().optional()` 제거
- 라인 248-254 `subscriptionId`를 `persistedOptions`에 저장하는 로직 제거
- 라인 257-272 subscriptionId 검증 블록 제거
- 라인 298 `effectiveForceRefetch`에서 subscriptionId 분기 제거
- `triggerSubscriptionAnalysis` import 추가

- [ ] **Step 3: lint 확인**

```bash
pnpm lint
```

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/server/trpc/routers/analysis.ts
git commit -m "feat: triggerSubscription mutation 추가, 기존 trigger에서 subscriptionId 분기 제거"
```

---

### Task 6: 프론트엔드 — 마법사 페이지 기본 구조

**Files:**
- Create: `apps/web/src/components/subscriptions/analyze/analyze-wizard.tsx`
- Create: `apps/web/src/app/subscriptions/analyze/page.tsx`

- [ ] **Step 1: analyze-wizard.tsx 생성**

4단계 스텝퍼 + 레이아웃 컴포넌트:

```tsx
'use client';

import { useState } from 'react';
import type { SubscriptionSummary } from '../../analysis/subscription-picker';

export type WizardStep = 'select' | 'config' | 'running' | 'result';

interface WizardState {
  step: WizardStep;
  subscription: SubscriptionSummary | null;
  jobId: number | null;
  keyword: string;
}

interface AnalyzeWizardProps {
  children: (state: WizardState, setState: (s: Partial<WizardState>) => void) => React.ReactNode;
}

const STEP_LABELS: Record<WizardStep, string> = {
  select: '구독 선택',
  config: '분석 설정',
  running: '실행 중',
  result: '결과',
};

const STEP_ORDER: WizardStep[] = ['select', 'config', 'running', 'result'];

export function AnalyzeWizard({ children }: AnalyzeWizardProps) {
  const [state, setStateRaw] = useState<WizardState>({
    step: 'select',
    subscription: null,
    jobId: null,
    keyword: '',
  });

  const setState = (partial: Partial<WizardState>) =>
    setStateRaw(prev => ({ ...prev, ...partial }));

  const currentIdx = STEP_ORDER.indexOf(state.step);

  return (
    <div className="space-y-6">
      {/* 스텝퍼 */}
      <div className="flex items-center gap-2">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                i < currentIdx
                  ? 'bg-primary text-primary-foreground'
                  : i === currentIdx
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-sm ${i === currentIdx ? 'font-medium' : 'text-muted-foreground'}`}>
              {STEP_LABELS[s]}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <div className={`h-0.5 w-8 ${i < currentIdx ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* 단계 컨텐츠 */}
      {children(state, setState)}
    </div>
  );
}
```

- [ ] **Step 2: page.tsx 생성**

```tsx
import { AnalyzeWizard } from '@/components/subscriptions/analyze/analyze-wizard';
import { SubscriptionSelectStep } from '@/components/subscriptions/analyze/subscription-select-step';
import { AnalysisConfigStep } from '@/components/subscriptions/analyze/analysis-config-step';
import { AnalysisRunningStep } from '@/components/subscriptions/analyze/analysis-running-step';
import { AnalysisResultStep } from '@/components/subscriptions/analyze/analysis-result-step';

export default function SubscriptionAnalyzePage() {
  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">구독 분석 실행</h1>
        <p className="text-muted-foreground">
          활성 구독에서 수집된 데이터로 AI 분석을 실행합니다
        </p>
      </div>
      <AnalyzeWizard>
        {(state, setState) => {
          switch (state.step) {
            case 'select':
              return (
                <SubscriptionSelectStep
                  onSelect={(sub) => setState({
                    step: 'config',
                    subscription: sub,
                    keyword: sub.keyword,
                  })}
                />
              );
            case 'config':
              return state.subscription ? (
                <AnalysisConfigStep
                  subscription={state.subscription}
                  onTrigger={(jobId) => setState({ step: 'running', jobId })}
                  onBack={() => setState({ step: 'select' })}
                />
              ) : null;
            case 'running':
              return state.jobId ? (
                <AnalysisRunningStep
                  jobId={state.jobId}
                  keyword={state.keyword}
                  onComplete={() => setState({ step: 'result' })}
                />
              ) : null;
            case 'result':
              return state.jobId ? (
                <AnalysisResultStep
                  jobId={state.jobId}
                  onNewAnalysis={() => setState({
                    step: 'select',
                    subscription: null,
                    jobId: null,
                    keyword: '',
                  })}
                />
              ) : null;
          }
        }}
      </AnalyzeWizard>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/app/subscriptions/analyze/page.tsx apps/web/src/components/subscriptions/analyze/analyze-wizard.tsx
git commit -m "feat: 구독 분석 마법사 페이지 기본 구조 (page + wizard)"
```

---

### Task 7: Step 1 — 구독 선택 컴포넌트

**Files:**
- Create: `apps/web/src/components/subscriptions/analyze/subscription-select-step.tsx`

- [ ] **Step 1: subscription-select-step.tsx 생성**

활성 구독 카드 그리드 + 선택:

```tsx
'use client';

import { useState } from 'react';
import { trpcClient } from '@/lib/trpc-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SourceIcons } from '@/components/analysis/source-icons';
import type { SubscriptionSummary } from '../../analysis/subscription-picker';

interface SubscriptionSelectStepProps {
  onSelect: (sub: SubscriptionSummary) => void;
}

export function SubscriptionSelectStep({ onSelect }: SubscriptionSelectStepProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: subscriptions, isLoading } = trpcClient.subscriptions.list.useQuery({
    status: 'active',
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">구독 목록을 불러오는 중...</div>;
  }

  if (!subscriptions?.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">활성 구독이 없습니다</p>
        <p className="mt-1 text-sm text-muted-foreground">먼저 구독을 등록해주세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subscriptions.map((sub) => (
          <Card
            key={sub.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedId === sub.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedId(sub.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{sub.keyword}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {sub.sources.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs">
                    <SourceIcons source={s} /> {s}
                  </Badge>
                ))}
              </div>
              {sub.domain && (
                <Badge variant="outline" className="text-xs">{sub.domain}</Badge>
              )}
              <div className="text-xs text-muted-foreground">
                1회 최대 {sub.limits.maxPerRun}건
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!selectedId}
          onClick={() => {
            const sub = subscriptions.find((s) => s.id === selectedId);
            if (sub) onSelect(sub as unknown as SubscriptionSummary);
          }}
        >
          다음
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/subscriptions/analyze/subscription-select-step.tsx
git commit -m "feat: 구독 분석 Step 1 — 구독 카드 그리드 선택 컴포넌트"
```

---

### Task 8: Step 2 — 분석 설정 컴포넌트

**Files:**
- Create: `apps/web/src/components/subscriptions/analyze/analysis-config-step.tsx`

- [ ] **Step 1: analysis-config-step.tsx 생성**

분석 기간, 도메인, 최적화 프리셋 설정 폼:

```tsx
'use client';

import { useState } from 'react';
import { trpcClient } from '@/lib/trpc-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SourceIcons } from '@/components/analysis/source-icons';
import type { SubscriptionSummary } from '../../analysis/subscription-picker';
import { Loader2 } from 'lucide-react';

const OPTIMIZATION_OPTIONS = [
  { value: 'rag-standard', label: 'RAG 표준 (권장)' },
  { value: 'rag-light', label: 'RAG 경량' },
  { value: 'rag-aggressive', label: 'RAG 적극적' },
  { value: 'standard', label: '표준' },
  { value: 'none', label: '없음' },
] as const;

const DOMAINS = [
  { value: 'general', label: '일반' },
  { value: 'political', label: '정치' },
  { value: 'economic', label: '경제' },
  { value: 'technology', label: '기술' },
  { value: 'social', label: '사회' },
  { value: 'fandom', label: '팬덤' },
  { value: 'pr', label: 'PR/홍보' },
  { value: 'corporate', label: '기업' },
  { value: 'finance', label: '금융' },
  { value: 'healthcare', label: '의료' },
  { value: 'sports', label: '스포츠' },
  { value: 'education', label: '교육' },
] as const;

const DATE_PRESETS = [
  { label: '최근 1일', days: 1 },
  { label: '최근 3일', days: 3 },
  { label: '최근 7일', days: 7 },
  { label: '최근 14일', days: 14 },
  { label: '최근 30일', days: 30 },
] as const;

interface AnalysisConfigStepProps {
  subscription: SubscriptionSummary;
  onTrigger: (jobId: number) => void;
  onBack: () => void;
}

export function AnalysisConfigStep({ subscription, onTrigger, onBack }: AnalysisConfigStepProps) {
  const [days, setDays] = useState(7);
  const [domain, setDomain] = useState(subscription.domain || 'general');
  const [optimization, setOptimization] = useState<string>('rag-standard');

  const triggerMutation = trpcClient.analysis.triggerSubscription.useMutation();

  const handleTrigger = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);

    triggerMutation.mutate(
      {
        subscriptionId: subscription.id,
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        domain: domain as typeof DOMAINS[number]['value'],
        optimizationPreset: optimization as typeof OPTIMIZATION_OPTIONS[number]['value'],
      },
      {
        onSuccess: (data) => {
          onTrigger(data.jobId);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* 선택된 구독 요약 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">선택된 구독</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="font-medium">{subscription.keyword}</span>
            <div className="flex gap-1">
              {subscription.sources.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  <SourceIcons source={s} /> {s}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 분석 기간 */}
      <div className="space-y-2">
        <Label>분석 기간</Label>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.days}
              variant={days === p.days ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 도메인 */}
      <div className="space-y-2">
        <Label>분석 도메인</Label>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOMAINS.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 토큰 최적화 */}
      <div className="space-y-2">
        <Label>토큰 최적화</Label>
        <Select value={optimization} onValueChange={setOptimization}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIMIZATION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 실행 버튼 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <Button
          onClick={handleTrigger}
          disabled={triggerMutation.isPending}
        >
          {triggerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          분석 실행
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/subscriptions/analyze/analysis-config-step.tsx
git commit -m "feat: 구독 분석 Step 2 — 분석 설정 폼 (기간/도메인/최적화)"
```

---

### Task 9: Step 3, 4 — 실행 중 + 결과 컴포넌트

**Files:**
- Create: `apps/web/src/components/subscriptions/analyze/analysis-running-step.tsx`
- Create: `apps/web/src/components/subscriptions/analyze/analysis-result-step.tsx`

- [ ] **Step 1: analysis-running-step.tsx 생성**

```tsx
'use client';

import { PipelineMonitor } from '@/components/analysis/pipeline-monitor';
import { Card, CardContent } from '@/components/ui/card';

interface AnalysisRunningStepProps {
  jobId: number;
  keyword: string;
  onComplete: () => void;
}

export function AnalysisRunningStep({ jobId, keyword, onComplete }: AnalysisRunningStepProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <PipelineMonitor
          jobId={jobId}
          keyword={keyword}
          onComplete={onComplete}
        />
      </CardContent>
    </Card>
  );
}
```

주의: 기존 `PipelineMonitor` 컴포넌트의 `onComplete` prop이 없다면, SSE 상태 폴링으로 `status === 'completed'` 감지 후 `onComplete` 호출하는 로직을 추가해야 함. 실제 `PipelineMonitor`의 props를 확인하고 필요시 래퍼 로직 추가.

- [ ] **Step 2: analysis-result-step.tsx 생성**

```tsx
'use client';

import { ReportView } from '@/components/report/report-view';
import { Button } from '@/components/ui/button';

interface AnalysisResultStepProps {
  jobId: number;
  onNewAnalysis: () => void;
}

export function AnalysisResultStep({ jobId, onNewAnalysis }: AnalysisResultStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={onNewAnalysis}>
          새 분석 실행
        </Button>
      </div>
      <ReportView jobId={jobId} />
    </div>
  );
}
```

주의: 기존 `ReportView` 컴포넌트의 실제 props를 확인하고 맞춰야 함. `ReportView`가 `jobId`를 직접 받는지, 아니면 다른 방식으로 데이터를 로드하는지 확인 필요.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/subscriptions/analyze/analysis-running-step.tsx apps/web/src/components/subscriptions/analyze/analysis-result-step.tsx
git commit -m "feat: 구독 분석 Step 3, 4 — 실행 중 + 결과 컴포넌트"
```

---

### Task 10: 내비게이션 + 통합 테스트

**Files:**
- Modify: `apps/web/src/app/subscriptions/layout.tsx:18-22`

- [ ] **Step 1: NAV_ITEMS에 "분석 실행" 추가**

```typescript
const NAV_ITEMS = [
  { label: '대시보드', href: '/subscriptions' },
  { label: '모니터링', href: '/subscriptions/monitor' },
  { label: '시스템 건강', href: '/subscriptions/health' },
  { label: '분석 실행', href: '/subscriptions/analyze' },
] as const;
```

- [ ] **Step 2: 빌드 확인**

```bash
pnpm build
```

Expected: 빌드 성공

- [ ] **Step 3: 개발 서버로 E2E 테스트**

```bash
pnpm dev
```

수동 확인:
1. `/subscriptions/analyze` 접속 → 활성 구독 카드 표시
2. 구독 선택 → 분석 설정 단계 이동
3. 설정 후 실행 → BullMQ `analysis` 큐에 `run-analysis` 잡만 생성 (collect/normalize 없음)
4. collector API에서 데이터 로드 → AI 분석 실행
5. 결과 표시

- [ ] **Step 4: 최종 커밋**

```bash
git add apps/web/src/app/subscriptions/layout.tsx
git commit -m "feat: 구독 내비게이션에 '분석 실행' 링크 추가"
```
