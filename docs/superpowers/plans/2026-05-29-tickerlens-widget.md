# tickerlens 주식 분석 위젯 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@krdn/tickerlens`를 사용해 미국 주식 티커를 4 페르소나 × 3 타임프레임으로 분석하는 독립 페이지(`/stocks`)를 추가하고, 결과를 팀 공유 이력으로 DB에 저장한다.

**Architecture:** `packages/core`에 tickerlens 래퍼 + 전용 ModelConfigAdapter를 두고(의존성 방향 `web → core` 준수), web의 tRPC `stocks` 라우터가 이를 동기 호출하여 결과를 `stock_analyses` 테이블에 저장한다. UI는 `/stocks` 페이지에서 티커 입력 → 로딩 → 페르소나별 그룹핑 그리드로 결과 표시.

**Tech Stack:** Next.js 15 (App Router) · tRPC 11 · Drizzle ORM · PostgreSQL · Zod · @krdn/tickerlens · @krdn/llm-gateway · Vitest · shadcn/ui · Tailwind 4

**설계 출처:** `docs/superpowers/specs/2026-05-29-tickerlens-widget-design.md`

---

## 핵심 통합 제약 (반드시 숙지)

tickerlens는 `configAdapter.resolve(moduleName)`을 자기 모듈 이름(`tickerlens.value.long` 등 16개)으로 호출한다. 이 프로젝트의 기존 `createModelConfigAdapter()`는 `MODULE_MODEL_MAP`에 없는 이름에 `throw new Error("알 수 없는 모듈")` 하므로(`packages/core/src/analysis/model-config.ts:317`) **그대로 주입하면 16개 슬롯이 전부 실패**한다. 따라서 모듈 이름을 무시하고 고정 provider/model + 복호화 apiKey를 반환하는 **전용 어댑터**를 새로 만든다 (Task 2). 키 복호화는 기존 `getProviderKeyInfo`(model-config.ts:240, `decrypt()` 수행)를 재사용한다.

---

## 파일 구조

| 구분 | 파일                                                  | 책임                             |
| ---- | ----------------------------------------------------- | -------------------------------- |
| 신규 | `packages/core/src/analysis/stocks/analyze-ticker.ts` | tickerlens 래퍼 + 전용 어댑터    |
| 신규 | `packages/core/src/db/schema/stocks.ts`               | `stock_analyses` 테이블          |
| 신규 | `apps/web/src/server/trpc/routers/stocks.ts`          | `analyze` / `list` / `getById`   |
| 신규 | `apps/web/src/components/stocks/*`                    | UI 컴포넌트 6개                  |
| 신규 | `apps/web/src/app/stocks/page.tsx`                    | 독립 페이지                      |
| 수정 | `packages/core/src/analysis/model-config.ts:240`      | `getProviderKeyInfo` export 승격 |
| 수정 | `packages/core/src/analysis/index.ts`                 | stocks 래퍼 re-export            |
| 수정 | `packages/core/src/db/schema/index.ts`                | stocks 스키마 re-export          |
| 수정 | `packages/core/package.json`                          | `@krdn/tickerlens` 의존성        |
| 수정 | `apps/web/src/server/trpc/router.ts`                  | `stocks` 라우터 등록             |
| 수정 | `apps/web/next.config.ts`                             | serverExternalPackages           |

---

## Task 1: `@krdn/tickerlens` 의존성 추가 + `getProviderKeyInfo` export 승격

**Files:**

- Modify: `packages/core/package.json`
- Modify: `packages/core/src/analysis/model-config.ts:240`

- [ ] **Step 1: package.json에 의존성 추가**

`packages/core/package.json`의 `dependencies`에 추가:

```json
"@krdn/tickerlens": "^0.1.0"
```

- [ ] **Step 2: 설치**

Run: `pnpm install`
Expected: `@krdn/tickerlens`와 그 의존성(`yahoo-finance2`) 설치 완료. zod peer dependency 경고는 무시 가능(기존과 동일).

- [ ] **Step 3: `getProviderKeyInfo`를 export로 변경**

`packages/core/src/analysis/model-config.ts:240`의 함수 선언을 수정:

```typescript
// 변경 전
async function getProviderKeyInfo(
// 변경 후
export async function getProviderKeyInfo(
```

본문은 그대로 둔다. 반환 타입은 `Promise<{ selectedModel: string | null; baseUrl: string | null; apiKey: string | null } | null>`.

- [ ] **Step 4: 타입 체크**

Run: `pnpm --filter @ai-signalcraft/core exec tsc --noEmit`
Expected: 에러 없음 (export 추가는 기존 호출부에 영향 없음).

- [ ] **Step 5: 커밋**

```bash
git add packages/core/package.json packages/core/src/analysis/model-config.ts pnpm-lock.yaml
git commit -m "feat: @krdn/tickerlens 의존성 추가 및 getProviderKeyInfo export"
```

---

## Task 2: tickerlens 래퍼 + 전용 ModelConfigAdapter

**Files:**

- Create: `packages/core/src/analysis/stocks/analyze-ticker.ts`
- Test: `packages/core/src/analysis/stocks/__tests__/analyze-ticker.test.ts`
- Modify: `packages/core/src/analysis/index.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/core/src/analysis/stocks/__tests__/analyze-ticker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// tickerlens와 키 조회를 모킹 — 실제 LLM/Yahoo 호출 차단
const composeMock = vi.fn();
vi.mock('@krdn/tickerlens', () => ({
  composeTickerAnalysis: (...args: unknown[]) => composeMock(...args),
}));

const getProviderKeyInfoMock = vi.fn();
vi.mock('../../model-config', () => ({
  getProviderKeyInfo: (...args: unknown[]) => getProviderKeyInfoMock(...args),
}));

import { analyzeTicker } from '../analyze-ticker';

describe('analyzeTicker', () => {
  beforeEach(() => {
    composeMock.mockReset();
    getProviderKeyInfoMock.mockReset();
  });

  it('depth 미지정 시 lite를 기본값으로 composeTickerAnalysis에 전달', async () => {
    composeMock.mockResolvedValue({ ticker: 'AAPL' });
    await analyzeTicker('AAPL');
    expect(composeMock).toHaveBeenCalledWith('AAPL', expect.objectContaining({ depth: 'lite' }));
  });

  it('어댑터 resolve가 복호화된 apiKey와 고정 provider/model을 반환', async () => {
    getProviderKeyInfoMock.mockResolvedValue({
      selectedModel: null,
      baseUrl: null,
      apiKey: 'sk-decrypted',
    });
    composeMock.mockImplementation(async (_ticker, opts) => {
      const resolved = await opts.configAdapter.resolve('tickerlens.value.long');
      expect(resolved).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-decrypted',
      });
      return { ticker: 'AAPL' };
    });
    await analyzeTicker('AAPL', { depth: 'full' });
    expect(composeMock).toHaveBeenCalledWith('AAPL', expect.objectContaining({ depth: 'full' }));
  });

  it('apiKey 미설정 시 어댑터 resolve가 한국어 에러 throw', async () => {
    getProviderKeyInfoMock.mockResolvedValue({ selectedModel: null, baseUrl: null, apiKey: null });
    composeMock.mockImplementation(async (_ticker, opts) => {
      await opts.configAdapter.resolve('tickerlens.value.long');
      return { ticker: 'AAPL' };
    });
    await expect(analyzeTicker('AAPL')).rejects.toThrow(/프로바이더 키가 설정되지 않/);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @ai-signalcraft/core exec vitest run src/analysis/stocks/__tests__/analyze-ticker.test.ts`
Expected: FAIL — `analyze-ticker` 모듈이 없어 import 실패.

- [ ] **Step 3: 래퍼 구현**

`packages/core/src/analysis/stocks/analyze-ticker.ts`:

```typescript
import { composeTickerAnalysis, type AnalysisResult } from '@krdn/tickerlens';
import type { ModelConfigAdapter, AIProvider } from '@krdn/llm-gateway';
import { getProviderKeyInfo } from '../model-config';

// 주식 분석용 고정 모델 (per-persona 튜닝은 YAGNI — 단일 모델로 16개 모듈 모두 처리)
const STOCK_PROVIDER: AIProvider = 'anthropic';
const STOCK_MODEL = 'claude-sonnet-4-6';

/** 모듈 이름과 무관하게 단일 provider/model + 복호화 키를 resolve하는 어댑터 */
function createStockConfigAdapter(): ModelConfigAdapter {
  return {
    async resolve(_moduleName: string) {
      const keyInfo = await getProviderKeyInfo(STOCK_PROVIDER, STOCK_MODEL);
      if (!keyInfo?.apiKey) {
        throw new Error(
          `주식 분석용 프로바이더 키가 설정되지 않았습니다 (${STOCK_PROVIDER}). 설정에서 키를 등록하세요.`,
        );
      }
      return {
        provider: STOCK_PROVIDER,
        model: STOCK_MODEL,
        apiKey: keyInfo.apiKey,
        ...(keyInfo.baseUrl ? { baseUrl: keyInfo.baseUrl } : {}),
      };
    },
  };
}

export async function analyzeTicker(
  ticker: string,
  opts?: { depth?: 'full' | 'lite' },
): Promise<AnalysisResult> {
  return composeTickerAnalysis(ticker, {
    configAdapter: createStockConfigAdapter(),
    depth: opts?.depth ?? 'lite',
  });
}
```

> 주의: `ModelConfigAdapter`/`AIProvider`가 `@krdn/llm-gateway` 루트에서 export되지 않으면 타입 에러가 난다. 그 경우 `@krdn/llm-gateway/adapters`에서 `ModelConfigAdapter`를 import한다 (spec §2의 tickerlens index.d.ts가 `@krdn/llm-gateway/adapters`에서 `ModelConfigAdapter`를, `@krdn/llm-gateway`에서 `AIProvider`를 import함). 타입 위치는 Step 4 타입체크 에러 메시지로 확정한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @ai-signalcraft/core exec vitest run src/analysis/stocks/__tests__/analyze-ticker.test.ts`
Expected: PASS (3 tests). 타입 import 위치 에러가 나면 위 주의사항대로 `@krdn/llm-gateway/adapters`로 수정 후 재실행.

- [ ] **Step 5: index.ts에 re-export 추가**

`packages/core/src/analysis/index.ts` 끝에 추가:

```typescript
export { analyzeTicker } from './stocks/analyze-ticker';
```

- [ ] **Step 6: 커밋**

```bash
git add packages/core/src/analysis/stocks packages/core/src/analysis/index.ts
git commit -m "feat: tickerlens 래퍼 analyzeTicker + 전용 ModelConfigAdapter"
```

---

## Task 3: `stock_analyses` DB 스키마

**Files:**

- Create: `packages/core/src/db/schema/stocks.ts`
- Modify: `packages/core/src/db/schema/index.ts`

- [ ] **Step 1: 스키마 작성**

`packages/core/src/db/schema/stocks.ts`:

```typescript
import { pgTable, serial, text, timestamp, jsonb, numeric } from 'drizzle-orm/pg-core';

export const stockAnalyses = pgTable('stock_analyses', {
  id: serial('id').primaryKey(),
  requestedBy: text('requested_by').notNull(), // 실행자 (표시용, 격리 아님)
  ticker: text('ticker').notNull(),
  depth: text('depth').notNull(), // 'full' | 'lite'
  asOf: timestamp('as_of').notNull(),
  result: jsonb('result').notNull(), // tickerlens AnalysisResult 전체
  costUsd: numeric('cost_usd'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

> `pgTable`/컬럼 헬퍼의 정확한 import 경로는 기존 스키마 파일(예: `packages/core/src/db/schema/analysis.ts`)의 상단 import 라인을 표본으로 맞춘다. drizzle 버전에 따라 `drizzle-orm/pg-core`가 표준이다.

- [ ] **Step 2: index.ts에 re-export 추가**

`packages/core/src/db/schema/index.ts` 끝에 추가:

```typescript
export * from './stocks';
```

- [ ] **Step 3: 타입 체크**

Run: `pnpm --filter @ai-signalcraft/core exec tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: DB 스키마 동기화**

Run: `pnpm db:push`
Expected: `stock_analyses` 테이블 생성. (일반 PG 테이블이므로 `db:migrate-timescale` 불필요 — 하이퍼테이블 아님.)

> 주의(CLAUDE.md): 개발/운영이 DB를 공유한다. `db:push`는 테이블 생성(비파괴적)이므로 안전하나, 프롬프트가 기존 테이블 변경/삭제를 제안하면 중단하고 사용자에게 확인.

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/db/schema/stocks.ts packages/core/src/db/schema/index.ts
git commit -m "feat: stock_analyses 테이블 스키마 추가"
```

---

## Task 4: tRPC `stocks` 라우터

**Files:**

- Create: `apps/web/src/server/trpc/routers/stocks.ts`
- Test: `apps/web/src/server/trpc/routers/__tests__/stocks.test.ts`
- Modify: `apps/web/src/server/trpc/router.ts`

- [ ] **Step 1: 실패하는 라우터 테스트 작성**

`apps/web/src/server/trpc/routers/__tests__/stocks.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupTrpcTestEnv, makeProtectedCtx } from '../../__tests__/test-helpers';

setupTrpcTestEnv();

const analyzeTickerMock = vi.fn();
vi.mock('@ai-signalcraft/core', () => ({
  analyzeTicker: (...a: unknown[]) => analyzeTickerMock(...a),
  stockAnalyses: {}, // drizzle 테이블 참조 자리표시
}));

import { stocksRouter } from '../stocks';

function ctxWithInsert() {
  const ctx = makeProtectedCtx() as Record<string, unknown>;
  // 라우터 본문의 ctx.db.insert(...).values(...).returning() 체인 모킹
  (ctx as { db: unknown }).db = {
    ...(ctx.db as object),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 1 }]) }) }),
  };
  return ctx as never;
}

describe('stocksRouter.analyze', () => {
  beforeEach(() => {
    analyzeTickerMock.mockReset();
  });

  it('잘못된 티커 형식은 입력 검증에서 거부', async () => {
    const caller = stocksRouter.createCaller(ctxWithInsert());
    await expect(caller.analyze({ ticker: '123!@#', depth: 'lite' })).rejects.toThrow();
    expect(analyzeTickerMock).not.toHaveBeenCalled();
  });

  it('meta.completed===0이면 TRPCError로 전체 실패 처리', async () => {
    analyzeTickerMock.mockResolvedValue({
      ticker: 'AAPL',
      asOf: '2026-05-29T00:00:00Z',
      perspectives: {},
      meta: { completed: 0, failed: 12, durationMs: 100, depth: 'lite' },
    });
    const caller = stocksRouter.createCaller(ctxWithInsert());
    await expect(caller.analyze({ ticker: 'AAPL', depth: 'lite' })).rejects.toThrow();
  });

  it('부분 성공(completed>0)이면 DB 저장 후 결과 반환', async () => {
    analyzeTickerMock.mockResolvedValue({
      ticker: 'AAPL',
      asOf: '2026-05-29T00:00:00Z',
      perspectives: {},
      meta: { completed: 8, failed: 4, durationMs: 100, depth: 'lite', totalCostUsd: 0.12 },
    });
    const caller = stocksRouter.createCaller(ctxWithInsert());
    const res = await caller.analyze({ ticker: 'AAPL', depth: 'lite' });
    expect(res.ticker).toBe('AAPL');
    expect(analyzeTickerMock).toHaveBeenCalledWith('AAPL', { depth: 'lite' });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @ai-signalcraft/web exec vitest run src/server/trpc/routers/__tests__/stocks.test.ts`
Expected: FAIL — `../stocks` 모듈 없음.

- [ ] **Step 3: 라우터 구현**

`apps/web/src/server/trpc/routers/stocks.ts`:

```typescript
import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { analyzeTicker, stockAnalyses } from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';

export const stocksRouter = router({
  analyze: protectedProcedure
    .input(
      z.object({
        ticker: z
          .string()
          .trim()
          .min(1)
          .max(10)
          .regex(/^[A-Za-z.\-]+$/, '티커는 영문/마침표/하이픈만 허용됩니다'),
        depth: z.enum(['full', 'lite']).default('lite'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticker = input.ticker.toUpperCase();
      const result = await analyzeTicker(ticker, { depth: input.depth });

      if (result.meta.completed === 0) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `${ticker} 분석에 실패했습니다 (모든 관점 실패). 프로바이더 키 설정을 확인하세요.`,
        });
      }

      const [row] = await ctx.db
        .insert(stockAnalyses)
        .values({
          requestedBy: ctx.userId,
          ticker,
          depth: input.depth,
          asOf: new Date(result.asOf),
          result,
          costUsd: result.meta.totalCostUsd != null ? String(result.meta.totalCostUsd) : null,
        })
        .returning({ id: stockAnalyses.id });

      return { id: row.id, ...result };
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: stockAnalyses.id,
          ticker: stockAnalyses.ticker,
          depth: stockAnalyses.depth,
          requestedBy: stockAnalyses.requestedBy,
          asOf: stockAnalyses.asOf,
          createdAt: stockAnalyses.createdAt,
        })
        .from(stockAnalyses)
        .orderBy(desc(stockAnalyses.createdAt))
        .limit(input?.limit ?? 20);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(stockAnalyses)
        .where(eq(stockAnalyses.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '분석 이력을 찾을 수 없습니다' });
      }
      return row;
    }),
});
```

> `protectedProcedure`/`router` import 경로(`../init`)와 `ctx.userId`/`ctx.db` 사용은 기존 라우터(`apps/web/src/server/trpc/routers/analysis.ts` 상단 + `test-helpers.ts`의 ctx 형태)와 동일하다. 다르면 표본을 따른다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @ai-signalcraft/web exec vitest run src/server/trpc/routers/__tests__/stocks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 루트 라우터에 등록**

`apps/web/src/server/trpc/router.ts`에서:

1. import 블록에 추가:

```typescript
import { stocksRouter } from './routers/stocks';
```

2. `appRouter` 객체에 추가:

```typescript
  stocks: stocksRouter,
```

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/server/trpc/routers/stocks.ts apps/web/src/server/trpc/routers/__tests__/stocks.test.ts apps/web/src/server/trpc/router.ts
git commit -m "feat: stocks tRPC 라우터 (analyze/list/getById) 추가"
```

---

## Task 5: next.config.ts serverExternalPackages

**Files:**

- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: 현재 serverExternalPackages 확인**

Run: `grep -n -A6 "serverExternalPackages" apps/web/next.config.ts`
Expected: 기존 배열 확인 (예: `@krdn/llm-gateway` 관련 항목 포함).

- [ ] **Step 2: tickerlens·yahoo-finance2 추가**

`serverExternalPackages` 배열에 두 항목 추가 (서버 전용 라이브러리가 web 클라이언트 번들에 새지 않도록):

```typescript
    '@krdn/tickerlens',
    'yahoo-finance2',
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/next.config.ts
git commit -m "chore: tickerlens/yahoo-finance2 serverExternalPackages 추가"
```

---

## Task 6: UI — 시그널 배지 유틸 + perspective-cell

**Files:**

- Create: `apps/web/src/components/stocks/signal-badge.tsx`
- Create: `apps/web/src/components/stocks/perspective-cell.tsx`
- Test: `apps/web/src/components/stocks/__tests__/signal-badge.test.ts`

- [ ] **Step 1: 시그널 색 매핑 실패 테스트 작성**

`apps/web/src/components/stocks/__tests__/signal-badge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { signalMeta } from '../signal-badge';

describe('signalMeta', () => {
  it('strong_buy/buy는 초록 계열, sell/strong_sell은 빨강 계열, hold는 중립', () => {
    expect(signalMeta('strong_buy').tone).toBe('positive');
    expect(signalMeta('buy').tone).toBe('positive');
    expect(signalMeta('hold').tone).toBe('neutral');
    expect(signalMeta('sell').tone).toBe('negative');
    expect(signalMeta('strong_sell').tone).toBe('negative');
  });

  it('각 시그널에 한국어 라벨 제공', () => {
    expect(signalMeta('strong_buy').label).toBe('적극 매수');
    expect(signalMeta('hold').label).toBe('보유');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @ai-signalcraft/web exec vitest run src/components/stocks/__tests__/signal-badge.test.ts`
Expected: FAIL — `signal-badge` 모듈 없음.

- [ ] **Step 3: signal-badge 구현**

`apps/web/src/components/stocks/signal-badge.tsx`:

```typescript
type Signal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
type Tone = 'positive' | 'neutral' | 'negative';

interface SignalMeta {
  label: string;
  tone: Tone;
  className: string;
}

const MAP: Record<Signal, SignalMeta> = {
  strong_buy: { label: '적극 매수', tone: 'positive', className: 'bg-green-100 text-green-800' },
  buy: { label: '매수', tone: 'positive', className: 'bg-green-50 text-green-700' },
  hold: { label: '보유', tone: 'neutral', className: 'bg-slate-100 text-slate-700' },
  sell: { label: '매도', tone: 'negative', className: 'bg-red-50 text-red-700' },
  strong_sell: { label: '적극 매도', tone: 'negative', className: 'bg-red-100 text-red-800' },
};

export function signalMeta(signal: Signal): SignalMeta {
  return MAP[signal];
}

export function SignalBadge({ signal }: { signal: Signal }) {
  const meta = signalMeta(signal);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @ai-signalcraft/web exec vitest run src/components/stocks/__tests__/signal-badge.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: perspective-cell 구현**

`apps/web/src/components/stocks/perspective-cell.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { SignalBadge } from './signal-badge';

// tickerlens 타입 (spec §2). import 대신 로컬 정의 — 클라이언트 번들에 tickerlens 끌어오지 않기 위함.
interface PerspectiveResult {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  thesis: string;
  evidence: { label: string; value: string }[];
  risks: string[];
  catalysts: string[];
}
type Slot = { ok: true; value: PerspectiveResult } | { ok: false; error: { message: string } };

export function PerspectiveCell({ slot, timeframe }: { slot: Slot; timeframe: string }) {
  const [open, setOpen] = useState(false);

  if (!slot.ok) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        <div className="font-medium">{timeframe}</div>
        <div className="mt-1">분석 실패: {slot.error.message}</div>
      </div>
    );
  }

  const p = slot.value;
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded border border-slate-200 p-3 text-left text-xs transition hover:border-slate-300"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-500">{timeframe}</span>
        <SignalBadge signal={p.signal} />
      </div>
      <div className="mt-1 text-slate-400">신뢰도 {Math.round(p.confidence * 100)}%</div>
      <p className="mt-2 line-clamp-2 text-slate-700">{p.thesis}</p>
      {open && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
          {p.evidence.length > 0 && (
            <div>
              <div className="font-medium text-slate-600">근거</div>
              <ul className="mt-1 space-y-0.5">
                {p.evidence.map((e, i) => (
                  <li key={i} className="text-slate-600">
                    {e.label}: {e.value}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.risks.length > 0 && (
            <div>
              <div className="font-medium text-slate-600">리스크</div>
              <ul className="mt-1 list-disc pl-4 text-slate-600">
                {p.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {p.catalysts.length > 0 && (
            <div>
              <div className="font-medium text-slate-600">촉매</div>
              <ul className="mt-1 list-disc pl-4 text-slate-600">
                {p.catalysts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 6: 타입 체크 + 커밋**

Run: `pnpm --filter @ai-signalcraft/web exec tsc --noEmit`
Expected: 에러 없음.

```bash
git add apps/web/src/components/stocks/signal-badge.tsx apps/web/src/components/stocks/perspective-cell.tsx apps/web/src/components/stocks/__tests__/signal-badge.test.ts
git commit -m "feat: 주식 분석 시그널 배지 + perspective-cell 컴포넌트"
```

---

## Task 7: UI — perspective-grid (페르소나별 그룹핑) + snapshot-card

**Files:**

- Create: `apps/web/src/components/stocks/perspective-grid.tsx`
- Create: `apps/web/src/components/stocks/snapshot-card.tsx`

- [ ] **Step 1: perspective-grid 구현**

`apps/web/src/components/stocks/perspective-grid.tsx`:

```typescript
'use client';

import { PerspectiveCell } from './perspective-cell';

type PerspectiveResult = {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  thesis: string;
  evidence: { label: string; value: string }[];
  risks: string[];
  catalysts: string[];
};
type Slot = { ok: true; value: PerspectiveResult } | { ok: false; error: { message: string } };
type PersonaSlots = { long: Slot; mid: Slot; short: Slot };

interface Perspectives {
  value: PersonaSlots;
  growth: PersonaSlots;
  quant: PersonaSlots;
  options: PersonaSlots;
}

const PERSONAS: { key: keyof Perspectives; label: string }[] = [
  { key: 'value', label: 'Value (가치)' },
  { key: 'growth', label: 'Growth (성장)' },
  { key: 'quant', label: 'Quant (퀀트)' },
  { key: 'options', label: 'Options (옵션)' },
];
const TIMEFRAMES: { key: keyof PersonaSlots; label: string }[] = [
  { key: 'long', label: 'Long' },
  { key: 'mid', label: 'Mid' },
  { key: 'short', label: 'Short' },
];

export function PerspectiveGrid({ perspectives }: { perspectives: Perspectives }) {
  return (
    <div className="space-y-6">
      {PERSONAS.map((persona) => (
        <section key={persona.key}>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">{persona.label}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {TIMEFRAMES.map((tf) => (
              <PerspectiveCell
                key={tf.key}
                timeframe={tf.label}
                slot={perspectives[persona.key][tf.key]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: snapshot-card 구현**

`apps/web/src/components/stocks/snapshot-card.tsx`:

```typescript
'use client';

interface Snapshot {
  ticker: string;
  asOf: string;
  price: { last: number; change: number; changePct: number };
  fundamentals: { marketCap: number; pe: number | null };
  recommendations: { rating: string; targetMean: number };
}

export function SnapshotCard({ snapshot }: { snapshot: Snapshot }) {
  const { price, fundamentals, recommendations } = snapshot;
  const up = price.change >= 0;
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-slate-900">{snapshot.ticker}</h2>
        <span className="text-xs text-slate-400">
          {new Date(snapshot.asOf).toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-2xl font-semibold">${price.last.toFixed(2)}</span>
        <span className={up ? 'text-green-600' : 'text-red-600'}>
          {up ? '+' : ''}
          {price.change.toFixed(2)} ({price.changePct.toFixed(2)}%)
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <dt className="text-slate-400">시가총액</dt>
          <dd>${(fundamentals.marketCap / 1e9).toFixed(1)}B</dd>
        </div>
        <div>
          <dt className="text-slate-400">PER</dt>
          <dd>{fundamentals.pe?.toFixed(1) ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-400">애널리스트</dt>
          <dd>{recommendations.rating}</dd>
        </div>
        <div>
          <dt className="text-slate-400">목표가(평균)</dt>
          <dd>${recommendations.targetMean.toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크 + 커밋**

Run: `pnpm --filter @ai-signalcraft/web exec tsc --noEmit`
Expected: 에러 없음.

```bash
git add apps/web/src/components/stocks/perspective-grid.tsx apps/web/src/components/stocks/snapshot-card.tsx
git commit -m "feat: perspective-grid (페르소나 그룹핑) + snapshot-card"
```

---

## Task 8: UI — ticker-input + history-panel + stocks-view

**Files:**

- Create: `apps/web/src/components/stocks/ticker-input.tsx`
- Create: `apps/web/src/components/stocks/history-panel.tsx`
- Create: `apps/web/src/components/stocks/stocks-view.tsx`

- [ ] **Step 1: ticker-input 구현**

`apps/web/src/components/stocks/ticker-input.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TickerInputProps {
  onAnalyze: (ticker: string, depth: 'full' | 'lite') => void;
  isLoading: boolean;
}

export function TickerInput({ onAnalyze, isLoading }: TickerInputProps) {
  const [ticker, setTicker] = useState('');
  const [depth, setDepth] = useState<'full' | 'lite'>('lite');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="티커 (예: AAPL)"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          maxLength={10}
        />
        <Button onClick={() => onAnalyze(ticker.trim(), depth)} disabled={isLoading || !ticker.trim()}>
          {isLoading ? '분석 중…' : '분석'}
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="radio" checked={depth === 'lite'} onChange={() => setDepth('lite')} />
          빠른 분석 (4회 호출)
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={depth === 'full'} onChange={() => setDepth('full')} />
          정밀 분석 (12회 LLM 호출, 비용 발생)
        </label>
      </div>
    </div>
  );
}
```

> `Button` import 경로(`@/components/ui/button`)는 dashboard/page.tsx에서 확인된 기존 패턴.

- [ ] **Step 2: history-panel 구현**

`apps/web/src/components/stocks/history-panel.tsx`:

```typescript
'use client';

import { trpcClient } from '@/lib/trpc';
import { useState, useEffect } from 'react';

interface HistoryRow {
  id: number;
  ticker: string;
  depth: string;
  requestedBy: string;
  createdAt: string | Date;
}

export function HistoryPanel({
  onSelect,
  refreshKey,
}: {
  onSelect: (id: number) => void;
  refreshKey: number;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);

  useEffect(() => {
    trpcClient.stocks.list
      .query({ limit: 20 })
      .then((r) => setRows(r as HistoryRow[]))
      .catch(() => setRows([]));
  }, [refreshKey]);

  if (rows.length === 0) {
    return <p className="text-xs text-slate-400">분석 이력이 없습니다.</p>;
  }

  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onSelect(row.id)}
            className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
          >
            <span className="font-medium text-slate-800">{row.ticker}</span>{' '}
            <span className="text-slate-400">
              · {row.requestedBy} · {new Date(row.createdAt).toLocaleString('ko-KR')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

> `trpcClient` import(`@/lib/trpc`)는 dashboard/page.tsx에서 확인된 기존 패턴. `trpcClient.stocks.list.query(...)`는 Task 4 라우터 등록 후 타입이 생긴다.

- [ ] **Step 3: stocks-view 구현**

`apps/web/src/components/stocks/stocks-view.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { trpcClient } from '@/lib/trpc';
import { TickerInput } from './ticker-input';
import { SnapshotCard } from './snapshot-card';
import { PerspectiveGrid } from './perspective-grid';
import { HistoryPanel } from './history-panel';

// 라우터 analyze/getById 반환 형태 (tickerlens AnalysisResult + id). 컴포넌트 props 타입에서 역추론.
type AnalysisResult = {
  ticker: string;
  asOf: string;
  snapshot: Parameters<typeof SnapshotCard>[0]['snapshot'];
  perspectives: Parameters<typeof PerspectiveGrid>[0]['perspectives'];
};

export function StocksView() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAnalyze = useCallback((ticker: string, depth: 'full' | 'lite') => {
    setIsLoading(true);
    setError(null);
    trpcClient.stocks.analyze
      .mutate({ ticker, depth })
      .then((res) => {
        setResult(res as unknown as AnalysisResult);
        setRefreshKey((k) => k + 1);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '분석 실패'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectHistory = useCallback((id: number) => {
    setIsLoading(true);
    setError(null);
    trpcClient.stocks.getById
      .query({ id })
      .then((row) => setResult((row as { result: AnalysisResult }).result))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <TickerInput onAnalyze={handleAnalyze} isLoading={isLoading} />
        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {isLoading && (
          <p className="text-sm text-slate-500">분석 중입니다… (정밀 분석은 수십 초 소요)</p>
        )}
        {result && !isLoading && (
          <div className="space-y-4">
            <SnapshotCard snapshot={result.snapshot} />
            <PerspectiveGrid perspectives={result.perspectives} />
          </div>
        )}
      </div>
      <aside>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">최근 분석 (팀 공유)</h3>
        <HistoryPanel onSelect={handleSelectHistory} refreshKey={refreshKey} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: 타입 체크 + 커밋**

Run: `pnpm --filter @ai-signalcraft/web exec tsc --noEmit`
Expected: 에러 없음 (Task 4 라우터가 등록되어 `trpcClient.stocks.*` 타입 존재).

```bash
git add apps/web/src/components/stocks/ticker-input.tsx apps/web/src/components/stocks/history-panel.tsx apps/web/src/components/stocks/stocks-view.tsx
git commit -m "feat: ticker-input + history-panel + stocks-view 조합 컴포넌트"
```

---

## Task 9: `/stocks` 페이지 + 네비게이션 연결

**Files:**

- Create: `apps/web/src/app/stocks/page.tsx`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: 페이지 작성**

`apps/web/src/app/stocks/page.tsx`:

```typescript
'use client';

import { AppShell } from '@/components/layout/app-shell';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { StocksView } from '@/components/stocks/stocks-view';

export default function StocksPage() {
  return (
    <AppShell
      sidebar={(_open, onClose) => (
        <AppSidebar
          activeTab={-1}
          onTabChange={() => onClose()}
          activeJobId={null}
          isRunning={false}
          onJobSelect={() => {}}
        />
      )}
      header={(onMenuClick) => (
        <AppHeader activeTab={-1} activeJobId={null} onMenuClick={onMenuClick} />
      )}
    >
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-900">주식 분석</h1>
          <p className="mt-1 text-sm text-slate-500">
            미국 주식 티커를 다중 관점으로 분석합니다 (powered by tickerlens)
          </p>
        </div>
        <StocksView />
      </div>
    </AppShell>
  );
}
```

> `AppShell`/`AppSidebar`/`AppHeader`의 props(`sidebar`/`header` render-prop, `activeTab` 등)는 dashboard/page.tsx에서 확인된 시그니처. `activeTab={-1}`은 "탭 미선택" 의미 — AppSidebar가 음수 인덱스를 어떻게 처리하는지 Step 2에서 확인하고, 렌더 에러가 나면 AppSidebar의 activeTab prop 타입에 맞춰 안전한 값(예: 기존 페이지가 쓰는 sentinel)으로 조정. 페이지가 렌더 에러 없이 뜨면 충분.

- [ ] **Step 2: app-sidebar에 /stocks 링크 추가**

`apps/web/src/components/layout/app-sidebar.tsx`를 읽고, 기존 네비게이션 항목(탭/링크) 패턴을 확인한다. 사이드바가 탭 인덱스 기반이면 별도 `<Link href="/stocks">` 항목을 하단에 추가하고, 라우트 링크 목록이 따로 있으면 거기에 "주식 분석 → /stocks"를 추가한다. 정확한 추가 위치는 파일 구조에 맞춘다 (기존 `/dashboard` 등 라우트 링크와 동일한 컴포넌트/스타일 사용).

> 이 단계는 기존 사이드바 구조에 의존하므로 파일을 먼저 읽고 패턴을 맞춘다. 링크 한 개 추가가 목표 — 사이드바 구조를 재설계하지 않는다.

- [ ] **Step 3: 페이지 렌더 확인 (개발 서버)**

Run: `pnpm dev` (백그라운드) 후 브라우저에서 `http://localhost:3000/stocks` 접속.
Expected: 페이지가 에러 없이 렌더. 티커 입력창 + "주식 분석" 헤더 표시. (실제 분석 실행은 LLM 키 설정 필요 — 키 없으면 명확한 에러 메시지 표시되면 정상.)

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/app/stocks/page.tsx apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat: /stocks 페이지 + 사이드바 네비게이션 추가"
```

---

## Task 10: 최종 검증 (빌드 · 린트 · 전체 테스트)

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `pnpm test`
Expected: 신규 테스트(analyze-ticker 3, stocks 라우터 3, signal-badge 2) 포함 전체 PASS.

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 에러 없음. (경고는 기존 수준 유지.)

- [ ] **Step 3: 프로덕션 빌드**

Run: `pnpm build`
Expected: 빌드 성공. tickerlens/yahoo-finance2가 serverExternalPackages로 처리되어 클라이언트 번들 에러 없음.

- [ ] **Step 4: 빌드 실패 시 대응**

빌드가 `@krdn/tickerlens`/`yahoo-finance2` 관련으로 실패하면:

- "Module not found" / "can't be bundled" → Task 5의 serverExternalPackages 항목 누락 확인.
- 타입 import 에러 → Task 2 Step 3 주의사항(`@krdn/llm-gateway/adapters`) 적용 여부 확인.
  수정 후 Step 1~3 재실행.

- [ ] **Step 5: 최종 커밋 (수정 발생 시)**

```bash
git add -A
git commit -m "fix: tickerlens 위젯 빌드/린트 수정"
```

---

## 검증 체크리스트 (구현 완료 후)

- [ ] `/stocks` 페이지가 렌더되고 사이드바에서 진입 가능
- [ ] 유효한 티커 입력 → 분석 실행 → 페르소나별 그리드 표시 (LLM 키 설정 시)
- [ ] 잘못된 티커 형식 거부
- [ ] 분석 결과가 `stock_analyses`에 저장되고 이력 패널에 나타남
- [ ] 이력 항목 클릭 시 `getById`로 재표시
- [ ] 일부 슬롯 실패해도 나머지 정상 렌더 (부분 성공)
- [ ] LLM 키 미설정 시 명확한 한국어 에러
- [ ] `pnpm build` / `pnpm lint` / `pnpm test` 통과
