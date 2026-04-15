# LLM 인사이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바에 "LLM 인사이트" 독립 메뉴를 추가하여 선택된 분석 작업(jobId)의 모듈별 모델 현황·문제점·업그레이드 추천·토큰 비용을 탭 4개로 표시한다.

**Architecture:** tRPC 라우터 1개를 새로 추가해 DB에서 jobId 기준 analysisResults를 조회한다. 프론트엔드는 LlmInsightsView 컴포넌트 + 탭 4개로 구성되며, 추천 데이터는 정적 상수 파일로 관리한다. 사이드바는 기존 ADVANCED_ITEMS 배열에 index 7을 추가하고, dashboard/page.tsx panels 배열에 해당 탭 패널을 추가한다.

**Tech Stack:** Next.js 15 App Router, tRPC 11, shadcn/ui (Tabs, Badge, Card, Table), Drizzle ORM, TanStack Query 5, lucide-react

---

## 파일 구조

**신규 생성:**

- `apps/web/src/server/trpc/routers/llm-insights.ts` — tRPC 라우터 (getModuleModels, getTokenCosts)
- `apps/web/src/components/llm-insights/llm-recommendation-data.ts` — 추천 데이터 정적 상수
- `apps/web/src/components/llm-insights/llm-insights-view.tsx` — 메인 뷰 (탭 컨테이너)
- `apps/web/src/components/llm-insights/model-overview-tab.tsx` — 탭 1: 모델 현황
- `apps/web/src/components/llm-insights/problem-diagnosis-tab.tsx` — 탭 2: 문제점 진단
- `apps/web/src/components/llm-insights/upgrade-suggestions-tab.tsx` — 탭 3: 업그레이드 추천
- `apps/web/src/components/llm-insights/token-cost-tab.tsx` — 탭 4: 토큰 비용

**수정:**

- `apps/web/src/server/trpc/router.ts` — llmInsightsRouter 등록
- `apps/web/src/components/layout/app-sidebar.tsx` — ADVANCED_ITEMS index 7 추가
- `apps/web/src/app/dashboard/page.tsx` — panels index 7 추가

---

## Task 1: tRPC 라우터 생성

**Files:**

- Create: `apps/web/src/server/trpc/routers/llm-insights.ts`

- [ ] **Step 1: 라우터 파일 생성**

```typescript
// apps/web/src/server/trpc/routers/llm-insights.ts
import { TRPCError } from '@trpc/server';
import { eq, and, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { analysisResults, collectionJobs } from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';
import { calculateCost } from '@ai-signalcraft/core/analysis/cost-calculator';

export const llmInsightsRouter = router({
  // 모듈별 사용 모델 조회 (모델 현황 + 문제점 진단 + 업그레이드 추천에 사용)
  getModuleModels: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.filterMode);

      const rows = await ctx.db
        .select({
          module: analysisResults.module,
          status: analysisResults.status,
          usage: analysisResults.usage,
        })
        .from(analysisResults)
        .where(and(eq(analysisResults.jobId, input.jobId), isNotNull(analysisResults.usage)));

      return rows.map((row) => ({
        moduleName: row.module,
        status: row.status,
        provider: row.usage!.provider,
        model: row.usage!.model,
      }));
    }),

  // 모듈별 토큰 비용 조회 (토큰 비용 탭에 사용)
  getTokenCosts: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.filterMode);

      const rows = await ctx.db
        .select({
          module: analysisResults.module,
          usage: analysisResults.usage,
        })
        .from(analysisResults)
        .where(and(eq(analysisResults.jobId, input.jobId), isNotNull(analysisResults.usage)));

      const items = rows.map((row) => {
        const u = row.usage!;
        return {
          moduleName: row.module,
          provider: u.provider,
          model: u.model,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          costUsd: calculateCost(u.inputTokens, u.outputTokens, u.model),
        };
      });

      const total = items.reduce(
        (acc, item) => ({
          inputTokens: acc.inputTokens + item.inputTokens,
          outputTokens: acc.outputTokens + item.outputTokens,
          costUsd: acc.costUsd + item.costUsd,
        }),
        { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      );

      return { items, total };
    }),
});
```

- [ ] **Step 2: router.ts에 라우터 등록**

`apps/web/src/server/trpc/router.ts` 에서:

```typescript
// 기존 import 목록 마지막에 추가
import { llmInsightsRouter } from './routers/llm-insights';

// appRouter 객체에 추가
export const appRouter = router({
  // ... 기존 항목들 ...
  llmInsights: llmInsightsRouter,
});
```

- [ ] **Step 3: 빌드 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm --filter @ai-signalcraft/web tsc --noEmit 2>&1 | head -30
```

Expected: 에러 없음 (또는 기존 에러만)

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/server/trpc/routers/llm-insights.ts apps/web/src/server/trpc/router.ts
git commit -m "feat: LLM 인사이트 tRPC 라우터 추가 (getModuleModels, getTokenCosts)"
```

---

## Task 2: 추천 데이터 상수 파일 생성

**Files:**

- Create: `apps/web/src/components/llm-insights/llm-recommendation-data.ts`

- [ ] **Step 1: 추천 데이터 상수 파일 생성**

`docs/llm-model-recommendations.md` Part 2의 모듈 추천 매트릭스를 코드로 정리한다.

```typescript
// apps/web/src/components/llm-insights/llm-recommendation-data.ts

export type KoreanLevel = '상' | '중' | '하';
export type Tier = 'best' | 'standard' | 'minimal';

export interface ModelRecommendation {
  provider: string;
  model: string;
  reason: string;
}

export interface ModuleRecommendation {
  best: ModelRecommendation;
  standard: ModelRecommendation;
  minimal: ModelRecommendation;
}

// 모듈별 추천 매트릭스 (llm-model-recommendations.md Part 2.3 기반)
export const MODULE_RECOMMENDATIONS: Record<string, ModuleRecommendation> = {
  'macro-view': {
    best: {
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      reason: '1M 컨텍스트, 할루시네이션 0.7%, 한국어 상급',
    },
    standard: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '속도·비용 균형, 1M 컨텍스트',
    },
    minimal: { provider: 'gemini', model: 'gemini-2.5-flash-lite', reason: '초저가 $0.10/MTok' },
  },
  segmentation: {
    best: {
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      reason: '1M 컨텍스트, 패턴 분류 최고 정확도',
    },
    standard: { provider: 'gemini', model: 'gemini-2.5-flash', reason: '패턴 분류에 비용 효율적' },
    minimal: { provider: 'openai', model: 'gpt-4.1-nano', reason: '단순 분류용 최저가' },
  },
  'sentiment-framing': {
    best: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '한국어 최고 수준, JSON 신뢰성 최상',
    },
    standard: {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      reason: '감정 분류에 비용 대비 성능 우수',
    },
    minimal: {
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      reason: '초저가, 배치 모드 가능',
    },
  },
  'message-impact': {
    best: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      reason: '메시지 영향 분석 최고 성능',
    },
    standard: { provider: 'openai', model: 'gpt-4.1-mini', reason: '정량적 분석에 적합' },
    minimal: { provider: 'gemini', model: 'gemini-2.5-flash-lite', reason: '초저가' },
  },
  'risk-map': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '최고 지능, 복잡한 추론' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '품질·비용 균형 최적' },
    minimal: { provider: 'deepseek', model: 'deepseek-reasoner', reason: '추론 특화 초저가' },
  },
  opportunity: {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '창의적 인사이트 도출 최고' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '창의적 인사이트 강점' },
    minimal: { provider: 'deepseek', model: 'deepseek-reasoner', reason: '추론 특화 초저가' },
  },
  strategy: {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '전략 수립 최고 추론' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '전략 수립 깊은 추론' },
    minimal: { provider: 'deepseek', model: 'deepseek-reasoner', reason: '추론 특화' },
  },
  'final-summary': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '다중 결과 종합 최고 성능' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '정리 능력 뛰어남' },
    minimal: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      reason: '한국어 상급, 고속',
    },
  },
  'approval-rating': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '복잡한 시나리오 최적' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '수치 추정 정밀 추론' },
    minimal: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      reason: '한국어 상급 유지',
    },
  },
  'frame-war': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '미묘한 언어 전략 분석' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '담론 분석 고급 모델' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'crisis-scenario': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '복합 시나리오 최적' },
    standard: { provider: 'openai', model: 'o4-mini', reason: '추론 특화, o3 대비 절반 가격' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'win-simulation': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '전체 결과 종합 시뮬레이션' },
    standard: { provider: 'openai', model: 'o4-mini', reason: '추론 특화' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  // 팬덤 모듈
  'fan-loyalty-index': {
    best: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '팬덤 심리 고이해력' },
    standard: { provider: 'gemini', model: 'gemini-2.5-flash', reason: '비용 효율적' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'fandom-narrative-war': {
    best: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '복합 내러티브 고급 추론' },
    standard: { provider: 'gemini', model: 'gemini-2.5-flash', reason: '비용 효율' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'fandom-crisis-scenario': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '팬덤 위기 전문 분석' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '시뮬레이션 품질' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
  'release-reception-prediction': {
    best: { provider: 'anthropic', model: 'claude-opus-4-6', reason: '예측 정확도 최고' },
    standard: { provider: 'anthropic', model: 'claude-sonnet-4-6', reason: '예측 성능 충분' },
    minimal: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', reason: '한국어 상급' },
  },
};

// 모델의 한국어 성능 등급 (llm-model-recommendations.md Part 1.1/1.2 기반)
export const MODEL_KOREAN_LEVEL: Record<string, KoreanLevel> = {
  // Anthropic — 모두 상
  'claude-opus-4-6': '상',
  'claude-sonnet-4-6': '상',
  'claude-haiku-4-5-20251001': '상',
  'claude-sonnet-4-20250514': '상',
  'claude-haiku-4-20250414': '상',
  // Google — Flash-Lite는 중
  'gemini-2.5-pro': '상',
  'gemini-2.5-flash': '상',
  'gemini-2.5-flash-lite': '중',
  'gemini-2.0-flash': '상',
  // OpenAI
  'gpt-4.1': '상',
  'gpt-4.1-mini': '상',
  'gpt-4.1-nano': '중',
  'gpt-4o': '상',
  'gpt-4o-mini': '상',
  o3: '상',
  'o4-mini': '상',
  // DeepSeek — 모두 중
  'deepseek-chat': '중',
  'deepseek-v4': '중',
  'deepseek-reasoner': '중',
};

// Stage 매핑 (모듈명 → Stage)
export const MODULE_STAGE: Record<string, 1 | 2 | 3 | 4> = {
  'macro-view': 1,
  segmentation: 1,
  'sentiment-framing': 1,
  'message-impact': 1,
  'risk-map': 2,
  opportunity: 2,
  strategy: 2,
  'final-summary': 3,
  'approval-rating': 4,
  'frame-war': 4,
  'crisis-scenario': 4,
  'win-simulation': 4,
  'fan-loyalty-index': 4,
  'fandom-narrative-war': 4,
  'fandom-crisis-scenario': 4,
  'release-reception-prediction': 4,
  // 기업 평판 Stage 4
  'stakeholder-map': 4,
  'esg-sentiment': 4,
  'reputation-index': 4,
  'crisis-type-classifier': 4,
  'media-framing-dominance': 4,
  'csr-communication-gap': 4,
  'reputation-recovery-simulation': 4,
  // 헬스케어
  'health-risk-perception': 4,
  'compliance-predictor': 4,
  // 금융
  'market-sentiment-index': 4,
  'information-asymmetry': 4,
  'catalyst-scenario': 4,
  'investment-signal': 4,
  // 스포츠
  'performance-narrative': 4,
  'season-outlook-prediction': 4,
  // 교육
  'institutional-reputation-index': 4,
  'education-opinion-frame': 4,
  'education-crisis-scenario': 4,
  'education-outcome-simulation': 4,
};

// 문제점 진단: 현재 모델에서 경고를 생성
export interface ModelWarning {
  type: 'korean-limited' | 'underspec' | 'context-limit';
  label: string;
}

export function getModelWarnings(moduleName: string, model: string): ModelWarning[] {
  const warnings: ModelWarning[] = [];
  const koreanLevel = MODEL_KOREAN_LEVEL[model];

  if (koreanLevel === '중' || koreanLevel === '하') {
    warnings.push({ type: 'korean-limited', label: '한국어 뉘앙스 제한' });
  }

  const rec = MODULE_RECOMMENDATIONS[moduleName];
  if (rec) {
    // 추천 최소 티어 모델과 현재 모델 비교
    // DeepSeek이 minimal로 추천된 모듈에서 DeepSeek 사용 중이면 OK
    // 그 외 minimal 추천이 Claude Haiku인데 GPT-4.1-nano 사용 중이면 경고
    const minimalModel = rec.minimal.model;
    const isMinimalMatch =
      model === minimalModel || model === rec.standard.model || model === rec.best.model;
    if (!isMinimalMatch) {
      warnings.push({ type: 'underspec', label: '추천 미달' });
    }
  }

  return warnings;
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/llm-insights/llm-recommendation-data.ts
git commit -m "feat: LLM 추천 데이터 정적 상수 파일 추가"
```

---

## Task 3: 탭 1 — 모델 현황 컴포넌트

**Files:**

- Create: `apps/web/src/components/llm-insights/model-overview-tab.tsx`

- [ ] **Step 1: 모델 현황 탭 컴포넌트 생성**

```typescript
// apps/web/src/components/llm-insights/model-overview-tab.tsx
'use client';

import { PROVIDER_REGISTRY, type AIProvider } from '@ai-signalcraft/core/ai-meta';
import { MODULE_META } from '@/components/settings/module-meta';
import { MODULE_STAGE } from './llm-recommendation-data';
import { Badge } from '@/components/ui/badge';

interface ModuleModel {
  moduleName: string;
  provider: string;
  model: string;
  status: string;
}

interface ModelOverviewTabProps {
  modules: ModuleModel[];
}

function ProviderBadge({ provider }: { provider: string }) {
  const meta = PROVIDER_REGISTRY[provider as AIProvider];
  const displayName = meta?.displayName ?? provider;

  const colorMap: Record<string, string> = {
    anthropic: 'bg-amber-100 text-amber-800 border-amber-200',
    gemini: 'bg-blue-100 text-blue-800 border-blue-200',
    openai: 'bg-green-100 text-green-800 border-green-200',
    deepseek: 'bg-purple-100 text-purple-800 border-purple-200',
    xai: 'bg-red-100 text-red-800 border-red-200',
    openrouter: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'claude-cli': 'bg-amber-100 text-amber-800 border-amber-200',
    'gemini-cli': 'bg-teal-100 text-teal-800 border-teal-200',
  };
  const colorClass = colorMap[provider] ?? 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {displayName}
    </span>
  );
}

export function ModelOverviewTab({ modules }: ModelOverviewTabProps) {
  const stageGroups: Record<string, ModuleModel[]> = { '1': [], '2': [], '3': [], '4': [] };
  for (const m of modules) {
    const stage = String(MODULE_STAGE[m.moduleName] ?? 4);
    stageGroups[stage].push(m);
  }

  const stageLabels: Record<string, string> = {
    '1': 'Stage 1 — 구조 분석 (병렬)',
    '2': 'Stage 2 — 전략 심화 (순차)',
    '3': 'Stage 3 — 최종 요약',
    '4': 'Stage 4 — 고급 시뮬레이션',
  };

  return (
    <div className="space-y-6">
      {(['1', '2', '3', '4'] as const).map((stage) => {
        const items = stageGroups[stage];
        if (items.length === 0) return null;
        return (
          <div key={stage}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {stageLabels[stage]}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((m) => {
                const meta = MODULE_META[m.moduleName];
                return (
                  <div key={m.moduleName} className="rounded-lg border bg-card p-3">
                    <p className="mb-2 text-sm font-semibold">
                      {meta?.name ?? m.moduleName}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <ProviderBadge provider={m.provider} />
                      <Badge variant="secondary" className="text-xs">
                        {m.model}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/llm-insights/model-overview-tab.tsx
git commit -m "feat: LLM 인사이트 모델 현황 탭 컴포넌트 추가"
```

---

## Task 4: 탭 2 — 문제점 진단 컴포넌트

**Files:**

- Create: `apps/web/src/components/llm-insights/problem-diagnosis-tab.tsx`

- [ ] **Step 1: 문제점 진단 탭 컴포넌트 생성**

```typescript
// apps/web/src/components/llm-insights/problem-diagnosis-tab.tsx
'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';
import { MODULE_META } from '@/components/settings/module-meta';
import { getModelWarnings } from './llm-recommendation-data';
import { Badge } from '@/components/ui/badge';

interface ModuleModel {
  moduleName: string;
  provider: string;
  model: string;
  status: string;
}

interface ProblemDiagnosisTabProps {
  modules: ModuleModel[];
}

const WARNING_STYLE: Record<string, string> = {
  'korean-limited': 'bg-amber-100 text-amber-800 border-amber-200',
  underspec: 'bg-red-100 text-red-800 border-red-200',
  'context-limit': 'bg-orange-100 text-orange-800 border-orange-200',
};

export function ProblemDiagnosisTab({ modules }: ProblemDiagnosisTabProps) {
  const diagnosed = modules.map((m) => ({
    ...m,
    warnings: getModelWarnings(m.moduleName, m.model),
  }));

  const problemModules = diagnosed.filter((m) => m.warnings.length > 0);
  const okModules = diagnosed.filter((m) => m.warnings.length === 0);

  return (
    <div className="space-y-4">
      {/* 요약 배너 */}
      <div className={`rounded-lg border p-3 ${problemModules.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
        <p className="text-sm font-medium">
          {problemModules.length > 0
            ? `⚠️ ${problemModules.length}개 모듈에서 주의가 필요합니다`
            : '✅ 모든 모듈이 최적 상태입니다'}
        </p>
      </div>

      {/* 문제 있는 모듈 */}
      {problemModules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">주의 필요</p>
          {problemModules.map((m) => {
            const meta = MODULE_META[m.moduleName];
            return (
              <div key={m.moduleName} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{meta?.name ?? m.moduleName}</p>
                    <p className="text-xs text-muted-foreground">{m.model}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.warnings.map((w) => (
                        <span
                          key={w.type}
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${WARNING_STYLE[w.type] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {w.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 정상 모듈 */}
      {okModules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">정상</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {okModules.map((m) => {
              const meta = MODULE_META[m.moduleName];
              return (
                <div key={m.moduleName} className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{meta?.name ?? m.moduleName}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.model}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/llm-insights/problem-diagnosis-tab.tsx
git commit -m "feat: LLM 인사이트 문제점 진단 탭 컴포넌트 추가"
```

---

## Task 5: 탭 3 — 업그레이드 추천 컴포넌트

**Files:**

- Create: `apps/web/src/components/llm-insights/upgrade-suggestions-tab.tsx`

- [ ] **Step 1: 업그레이드 추천 탭 컴포넌트 생성**

```typescript
// apps/web/src/components/llm-insights/upgrade-suggestions-tab.tsx
'use client';

import { ArrowRight, CheckCircle } from 'lucide-react';
import { MODULE_META } from '@/components/settings/module-meta';
import { MODULE_RECOMMENDATIONS } from './llm-recommendation-data';
import { Badge } from '@/components/ui/badge';

interface ModuleModel {
  moduleName: string;
  provider: string;
  model: string;
  status: string;
}

interface UpgradeSuggestionsTabProps {
  modules: ModuleModel[];
}

const TIER_LABEL: Record<string, string> = {
  best: '최고',
  standard: '보통',
  minimal: '최소',
};

const TIER_STYLE: Record<string, string> = {
  best: 'bg-purple-100 text-purple-800 border-purple-200',
  standard: 'bg-blue-100 text-blue-800 border-blue-200',
  minimal: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function UpgradeSuggestionsTab({ modules }: UpgradeSuggestionsTabProps) {
  return (
    <div className="space-y-3">
      {modules.map((m) => {
        const meta = MODULE_META[m.moduleName];
        const rec = MODULE_RECOMMENDATIONS[m.moduleName];

        if (!rec) return null;

        const tiers = [
          { key: 'best', ...rec.best },
          { key: 'standard', ...rec.standard },
          { key: 'minimal', ...rec.minimal },
        ] as const;

        return (
          <div key={m.moduleName} className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">{meta?.name ?? m.moduleName}</p>

            {/* 현재 모델 */}
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span>현재:</span>
              <Badge variant="outline" className="text-xs">{m.model}</Badge>
            </div>

            {/* 추천 티어 목록 */}
            <div className="space-y-2">
              {tiers.map((tier) => {
                const isCurrent = tier.model === m.model;
                return (
                  <div
                    key={tier.key}
                    className={`flex items-start gap-3 rounded-md p-2 ${isCurrent ? 'bg-green-50 border border-green-200' : 'bg-muted/40'}`}
                  >
                    <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium ${TIER_STYLE[tier.key]}`}>
                      {TIER_LABEL[tier.key]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{tier.model}</span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="h-3 w-3" /> 현재 사용 중
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tier.reason}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/llm-insights/upgrade-suggestions-tab.tsx
git commit -m "feat: LLM 인사이트 업그레이드 추천 탭 컴포넌트 추가"
```

---

## Task 6: 탭 4 — 토큰 비용 컴포넌트

**Files:**

- Create: `apps/web/src/components/llm-insights/token-cost-tab.tsx`

- [ ] **Step 1: 토큰 비용 탭 컴포넌트 생성**

```typescript
// apps/web/src/components/llm-insights/token-cost-tab.tsx
'use client';

import { MODULE_META } from '@/components/settings/module-meta';

interface TokenCostItem {
  moduleName: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface TokenCostTabProps {
  items: TokenCostItem[];
  total: { inputTokens: number; outputTokens: number; costUsd: number };
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatUsd(n: number): string {
  if (n < 0.0001) return '<$0.0001';
  return `$${n.toFixed(4)}`;
}

export function TokenCostTab({ items, total }: TokenCostTabProps) {
  return (
    <div className="space-y-4">
      {/* KPI 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold text-blue-600">{formatTokens(total.inputTokens)}</p>
          <p className="text-xs text-muted-foreground">총 입력 토큰</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold text-purple-600">{formatTokens(total.outputTokens)}</p>
          <p className="text-xs text-muted-foreground">총 출력 토큰</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-lg font-bold text-green-600">{formatUsd(total.costUsd)}</p>
          <p className="text-xs text-muted-foreground">총 비용 (USD)</p>
        </div>
      </div>

      {/* 모듈별 테이블 */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">모듈</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">모델</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">입력</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">출력</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">비용</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const meta = MODULE_META[item.moduleName];
              return (
                <tr key={item.moduleName} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium">{meta?.name ?? item.moduleName}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">{item.model}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">
                    {formatTokens(item.inputTokens)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">
                    {formatTokens(item.outputTokens)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-medium tabular-nums">
                    {formatUsd(item.costUsd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50 font-semibold">
              <td className="px-3 py-2 text-xs" colSpan={2}>합계</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">{formatTokens(total.inputTokens)}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">{formatTokens(total.outputTokens)}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums">{formatUsd(total.costUsd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/llm-insights/token-cost-tab.tsx
git commit -m "feat: LLM 인사이트 토큰 비용 탭 컴포넌트 추가"
```

---

## Task 7: 메인 뷰 컴포넌트 조립

**Files:**

- Create: `apps/web/src/components/llm-insights/llm-insights-view.tsx`

- [ ] **Step 1: 메인 뷰 컴포넌트 생성**

```typescript
// apps/web/src/components/llm-insights/llm-insights-view.tsx
'use client';

import { BrainCircuit } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModelOverviewTab } from './model-overview-tab';
import { ProblemDiagnosisTab } from './problem-diagnosis-tab';
import { UpgradeSuggestionsTab } from './upgrade-suggestions-tab';
import { TokenCostTab } from './token-cost-tab';

interface LlmInsightsViewProps {
  jobId: number | null;
}

export function LlmInsightsView({ jobId }: LlmInsightsViewProps) {
  const modelsQuery = useQuery({
    queryKey: ['llmInsights', 'moduleModels', jobId],
    queryFn: () => trpcClient.llmInsights.getModuleModels.query({ jobId: jobId! }),
    enabled: jobId !== null,
  });

  const costsQuery = useQuery({
    queryKey: ['llmInsights', 'tokenCosts', jobId],
    queryFn: () => trpcClient.llmInsights.getTokenCosts.query({ jobId: jobId! }),
    enabled: jobId !== null,
  });

  if (!jobId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <BrainCircuit className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">분석을 먼저 선택하세요</p>
        <p className="text-xs text-muted-foreground">사이드바에서 분석 작업을 선택하면 LLM 정보를 확인할 수 있습니다.</p>
      </div>
    );
  }

  const isLoading = modelsQuery.isPending || costsQuery.isPending;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">LLM 인사이트</h2>
        <span className="text-sm text-muted-foreground">— Job #{jobId}</span>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        </div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">🤖 모델 현황</TabsTrigger>
            <TabsTrigger value="problems">⚠️ 문제점 진단</TabsTrigger>
            <TabsTrigger value="upgrades">⬆️ 업그레이드 추천</TabsTrigger>
            <TabsTrigger value="costs">💰 토큰 비용</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <ModelOverviewTab modules={modelsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="problems" className="mt-4">
            <ProblemDiagnosisTab modules={modelsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="upgrades" className="mt-4">
            <UpgradeSuggestionsTab modules={modelsQuery.data ?? []} />
          </TabsContent>

          <TabsContent value="costs" className="mt-4">
            {costsQuery.data ? (
              <TokenCostTab items={costsQuery.data.items} total={costsQuery.data.total} />
            ) : (
              <p className="text-sm text-muted-foreground">비용 데이터가 없습니다.</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/llm-insights/llm-insights-view.tsx
git commit -m "feat: LLM 인사이트 메인 뷰 컴포넌트 조립"
```

---

## Task 8: 사이드바 + 대시보드 페이지 연결

**Files:**

- Modify: `apps/web/src/components/layout/app-sidebar.tsx`
- Modify: `apps/web/src/app/dashboard/page.tsx`

- [ ] **Step 1: app-sidebar.tsx — ADVANCED_ITEMS에 LLM 인사이트 추가**

`apps/web/src/components/layout/app-sidebar.tsx` 에서:

```typescript
// 기존 import에 BrainCircuit 추가
import {
  // ... 기존 아이콘들 ...
  BrainCircuit,
} from 'lucide-react';

// ADVANCED_ITEMS 배열에 추가
const ADVANCED_ITEMS: NavItem[] = [
  { label: '히스토리', icon: History, index: 4 },
  { label: '고급 분석', icon: Brain, index: 5 },
  { label: '탐색', icon: Telescope, index: 6 },
  { label: 'LLM 인사이트', icon: BrainCircuit, index: 7 }, // 추가
];
```

`RESULT_TAB_INDICES` 상수도 업데이트:

```typescript
const RESULT_TAB_INDICES = [1, 2, 3, 5, 6, 7]; // 7 추가
```

- [ ] **Step 2: dashboard/page.tsx — LlmInsightsTab 추가**

`apps/web/src/app/dashboard/page.tsx` 에서:

import 추가:

```typescript
import { LlmInsightsView } from '@/components/llm-insights/llm-insights-view';
```

`LlmInsightsTab` 함수 추가 (기존 `AdvancedTab` 아래):

```typescript
function LlmInsightsTab({
  jobId,
  onGoToAnalysis,
}: {
  jobId: number | null;
  onGoToAnalysis: () => void;
}) {
  return (
    <ResultTabWrapper jobId={jobId} onGoToAnalysis={onGoToAnalysis}>
      <LlmInsightsView jobId={jobId} />
    </ResultTabWrapper>
  );
}
```

`panels` 배열에 index 7 패널 추가:

```typescript
panels={[
  // ... 기존 0~6 ...
  <LlmInsightsTab
    key="llm-insights"
    jobId={activeJobId}
    onGoToAnalysis={handleGoToAnalysis}
  />,
]}
```

- [ ] **Step 3: 빌드 타입 체크**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm --filter @ai-signalcraft/web tsc --noEmit 2>&1 | head -30
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/layout/app-sidebar.tsx apps/web/src/app/dashboard/page.tsx
git commit -m "feat: 사이드바 + 대시보드에 LLM 인사이트 탭(index 7) 연결"
```

---

## Task 9: 브라우저 검증

- [ ] **Step 1: 개발 서버 시작**

```bash
cd /home/gon/projects/ai/ai-signalcraft
pnpm dev
```

- [ ] **Step 2: 기능 검증 체크리스트**

브라우저에서 `http://localhost:3000` 접속 후:

1. 사이드바에 "LLM 인사이트" 메뉴 항목이 보이는지 확인
2. jobId 없는 상태에서 LLM 인사이트 메뉴가 비활성(클릭 불가)인지 확인
3. 히스토리에서 분석 작업을 선택 → LLM 인사이트 메뉴 활성화 확인
4. LLM 인사이트 클릭 → 탭 4개(모델 현황/문제점 진단/업그레이드 추천/토큰 비용) 확인
5. 모델 현황 탭: Stage별 그룹, 프로바이더 배지 색상 확인
6. 문제점 진단 탭: 경고 배지 표시 확인
7. 업그레이드 추천 탭: 현재 모델에 "현재 사용 중" 표시 확인
8. 토큰 비용 탭: KPI 3개 + 테이블 + 합계 행 확인
9. usage 데이터 없는 작업 선택 시 빈 상태 처리 확인

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: LLM 인사이트 페이지 구현 완료

- 사이드바 독립 메뉴 추가 (index 7, jobId 있을 때만 활성)
- 탭 4개: 모델 현황 / 문제점 진단 / 업그레이드 추천 / 토큰 비용
- tRPC getModuleModels / getTokenCosts 엔드포인트
- llm-model-recommendations.md 기반 정적 추천 데이터"
```
