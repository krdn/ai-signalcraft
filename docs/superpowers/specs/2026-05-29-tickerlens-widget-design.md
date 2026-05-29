# 주식 분석 위젯 (`@krdn/tickerlens`) 설계

- **작성일**: 2026-05-29
- **상태**: 승인됨 (구현 대기)
- **요청**: `@krdn/tickerlens`를 사용하는 위젯을 웹 대시보드에 추가

## 1. 배경

`@krdn/tickerlens` 0.1.0은 미국 주식 티커 다중 관점 분석 라이브러리다.
`composeTickerAnalysis(ticker, options)`가 핵심 진입점으로, Value/Growth/Quant/Options
4개 페르소나 × Long/Mid/Short 3개 타임프레임의 분석을 반환한다.

이 프로젝트(AI SignalCraft)는 공인 여론 분석 도구로 도메인이 다르지만, tickerlens는
이 프로젝트와 동일한 `@krdn/llm-gateway`(v3.2.0, peerDependency `^3.0.0` 충족)를 쓴다.
tickerlens가 받는 `ModelConfigAdapter`에 이 프로젝트의 **provider_keys 복호화 인프라**를
재사용하여 LLM 키를 공급한다.

> **검증된 통합 제약 (구현 결정)**: 기존 `createModelConfigAdapter()`를 **그대로 주입할 수 없다.**
> 그 어댑터의 `resolve(moduleName)`은 이 프로젝트의 분석 모듈 이름(macroView 등)만 알며,
> `MODULE_MODEL_MAP`에 없는 이름은 `throw new Error("알 수 없는 모듈")`로 실패한다
> (`packages/core/src/analysis/model-config.ts:317`). 그런데 tickerlens는 자기 모듈 이름
> (`tickerlens.value.long` 등 16개)으로 `resolve`를 호출하므로, 그대로 주입하면 16개 슬롯이
> 전부 throw된다. 따라서 **모듈 이름을 무시하고 단일 provider/model + 복호화된 apiKey를
> 반환하는 작은 전용 어댑터를 새로 작성**한다(§5). provider_keys 복호화는
> `getProviderKeyInfo`(model-config.ts:240, `decrypt(encryptedKey)` 수행)를 재사용한다.
> 즉 "키 설정 작업"은 0이 아니라 "약 10줄짜리 어댑터 1개"다. provider/model 자체는 별도
> 설정 UI 없이 코드 상수로 고정한다(per-persona 모델 튜닝은 YAGNI).

### 결정 사항 (브레인스토밍)

| 질문        | 결정                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| 위젯 형태   | **독립 페이지** (`/stocks`) — 여론 분석 대시보드와 분리, 도메인 충돌 회피 |
| 실행 방식   | **동기 tRPC + 로딩** — BullMQ 잡 불필요, 소규모 팀 수동 트리거에 적합     |
| 결과 저장   | **DB 이력 저장** (`stock_analyses` 테이블)                                |
| 이력 범위   | **팀 전체 공유** — 소유자 격리 없음, `requestedBy`는 실행자 표시용        |
| 패키지 의존 | **B안: packages/core에 래퍼** — `web → core` 의존 규칙 준수               |
| 결과 표시   | **그리드, 페르소나별 그룹핑** — 4 페르소나 섹션 × 3 타임프레임 열         |

## 2. tickerlens API (검증된 사실)

```typescript
// @krdn/tickerlens
function composeTickerAnalysis(
  ticker: string,
  options: {
    configAdapter: ModelConfigAdapter; // @krdn/llm-gateway/adapters
    dataAdapter?: DataSourceAdapter; // 기본값: Yahoo Finance
    depth?: 'full' | 'lite'; // full=12 LLM 호출, lite=4 (기본 full)
  },
): Promise<AnalysisResult>;
```

`AnalysisResult` 핵심 구조:

```typescript
interface AnalysisResult {
  ticker: string;
  asOf: string;
  snapshot: TickerSnapshot; // price, fundamentals, indicators, options?, recommendations, news
  perspectives: {
    value: PersonaSlots; // { long, mid, short }
    growth: PersonaSlots;
    quant: PersonaSlots;
    options: PersonaSlots;
  };
  meta: { completed; failed; durationMs; depth; totalCostUsd? };
}

type PerspectiveSlot = Result<PerspectiveResult>; // ok: true/false (부분 실패 가능)

interface PerspectiveResult {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  thesis: string;
  evidence: { label; value }[];
  risks: string[];
  catalysts: string[];
  valueFields?: { fairValueLow; fairValueHigh; marginOfSafetyPct };
  growthFields?: { expectedRevenueCagrPct; expectedEpsCagrPct; pegFair };
  quantFields?: { trend; momentumScore; overbought; oversold };
  optionsFields?: { ivRegime; suggestedStructure; breakEvens };
}
```

## 3. 아키텍처

```
[/stocks 페이지]  ──tRPC mutation──>  [stocks 라우터]  ──>  analyzeTicker() (core 래퍼)
 (use client)                          (server, protected)        │
   │                                       │                       ├─ composeTickerAnalysis()
   │  로딩 스피너                          │                       ├─ createStockConfigAdapter() (전용, getProviderKeyInfo 재사용)
   │                                       │                       └─ Yahoo Finance (yahoo-finance2)
   │                                       │
   └── perspective-grid  <──AnalysisResult──┘  + DB 저장 (stock_analyses)
                                          │
       [history-panel]  <──tRPC query── (list / getById, 팀 공유)
```

의존성 방향: `web(라우터/UI) → core(analyzeTicker 래퍼) → @krdn/tickerlens`.
`web → core` 규칙 준수. tickerlens·yahoo-finance2 의존성은 core에 격리.

## 4. 파일 변경 목록

| 구분 | 파일                                                  | 역할                                                                 |
| ---- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| 신규 | `packages/core/src/analysis/stocks/analyze-ticker.ts` | tickerlens 래퍼 + 전용 ModelConfigAdapter (depth 기본 lite)          |
| 신규 | `packages/core/src/db/schema/stocks.ts`               | `stock_analyses` Drizzle 테이블                                      |
| 수정 | `packages/core/src/analysis/model-config.ts:240`      | `getProviderKeyInfo`를 `export`로 승격                               |
| 신규 | `apps/web/src/server/trpc/routers/stocks.ts`          | `analyze` / `list` / `getById` procedure                             |
| 신규 | `apps/web/src/app/stocks/page.tsx`                    | 독립 페이지 (`'use client'`, AppShell 래핑)                          |
| 신규 | `apps/web/src/components/stocks/ticker-input.tsx`     | 티커 입력 + depth 토글 + 실행                                        |
| 신규 | `apps/web/src/components/stocks/snapshot-card.tsx`    | TickerSnapshot 표시                                                  |
| 신규 | `apps/web/src/components/stocks/perspective-grid.tsx` | 페르소나 그룹 × 타임프레임 그리드                                    |
| 신규 | `apps/web/src/components/stocks/perspective-cell.tsx` | 단일 PerspectiveResult 셀 (펼침)                                     |
| 신규 | `apps/web/src/components/stocks/history-panel.tsx`    | 이력 리스트 (팀 공유)                                                |
| 신규 | `apps/web/src/components/stocks/stocks-view.tsx`      | 조합 + 로딩/에러 상태                                                |
| 수정 | `packages/core/src/db/schema/index.ts`                | `stocks` 스키마 re-export                                            |
| 수정 | `packages/core/src/analysis/index.ts`                 | `analyze-ticker` re-export                                           |
| 수정 | `apps/web/src/server/trpc/router.ts`                  | `stocks: stocksRouter` 등록                                          |
| 수정 | `apps/web/next.config.ts`                             | `serverExternalPackages`에 `@krdn/tickerlens`, `yahoo-finance2` 추가 |
| 수정 | `packages/core/package.json`                          | `@krdn/tickerlens` 의존성 추가 (core에 추가)                         |

## 5. core 래퍼 + 전용 어댑터

tickerlens 모듈 이름(`tickerlens.value.long` 등 16개)을 무시하고, 고정 provider/model에
provider_keys 복호화 apiKey를 붙여 resolve하는 전용 어댑터를 새로 만든다.
키 복호화는 기존 `getProviderKeyInfo`(model-config.ts:240)를 재사용하되, 이 함수가 현재
`export`되어 있지 않으므로 **export로 승격**한다.

```typescript
// packages/core/src/analysis/stocks/analyze-ticker.ts
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

- `getProviderKeyInfo`는 `model-config.ts:240`에서 `async function`으로 정의되어 있으나
  export가 없다 → `export async function getProviderKeyInfo`로 변경 (한 줄 수정).
- provider/model을 코드 상수로 고정 — 설정 UI/프리셋 연동은 초기 범위 밖(YAGNI).
- 키 미설정 시 명확한 한국어 에러 → tRPC 라우터가 그대로 사용자에게 전달.

## 6. DB 스키마

```typescript
// packages/core/src/db/schema/stocks.ts
export const stockAnalyses = pgTable('stock_analyses', {
  id: serial('id').primaryKey(),
  requestedBy: text('requested_by').notNull(), // 실행자 (표시용, 격리 아님)
  ticker: text('ticker').notNull(),
  depth: text('depth').notNull(), // 'full' | 'lite'
  asOf: timestamp('as_of').notNull(), // result.asOf
  result: jsonb('result').notNull(), // AnalysisResult 전체
  costUsd: numeric('cost_usd'), // result.meta.totalCostUsd (옵션)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

- 일반 PostgreSQL 테이블 — `pnpm db:push` 필요, `db:migrate-timescale`은 불필요 (하이퍼테이블 아님).
- `result`는 통째로 jsonb — 페르소나별 컬럼 분해는 화면 표시용이므로 불필요(YAGNI).
- `list`는 격리 필터 없이 `ORDER BY created_at DESC LIMIT n` — 팀 전원 공유.

## 7. tRPC 라우터

```typescript
// apps/web/src/server/trpc/routers/stocks.ts
analyze: protectedProcedure
  .input(z.object({
    ticker: z.string().trim().min(1).max(10).regex(/^[A-Za-z.\-]+$/),
    depth: z.enum(['full', 'lite']).default('lite'),
  }))
  .mutation(...)   // analyzeTicker → meta.completed===0 검사 → DB INSERT → 반환

list:    protectedProcedure.query(...)              // 최근 N건, 팀 공유 (필터 없음)
getById: protectedProcedure.input({ id }).query(...)  // 단건 재조회
```

## 8. 결과 표시 (perspective-grid)

```
┌─ Value (가치) ────────────────────────────────────────┐
│  Long          │  Mid           │  Short              │
│  🟢 buy 72%    │  ⚪ hold 55%   │  🔴 sell 60%        │
│  thesis...     │  thesis...     │  thesis...          │
├─ Growth (성장) ───────────────────────────────────────┤
│  ...                                                   │
├─ Quant (퀀트) ────────────────────────────────────────┤
│  ...                                                   │
├─ Options (옵션) ──────────────────────────────────────┤
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

- **페르소나 4행(섹션 헤더로 그룹핑) × 타임프레임 3열**.
- 셀 기본: 시그널 배지 + 신뢰도 + thesis 요약. 펼침: evidence / risks / catalysts + 페르소나별 추가 필드.
- 페르소나별 추가 필드 매핑: Value→fairValue/marginOfSafety, Growth→CAGR/pegFair,
  Quant→trend/momentum, Options→ivRegime/breakEvens. 각 셀이 자기 필드만 렌더.
- 모바일: 3열 → 1열 스택.
- **실패 슬롯**: `ok: false`인 셀은 에러 표시, 나머지는 정상 렌더 (부분 성공 허용).

## 9. 에러 처리 · 검증

| 계층          | 처리                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| 입력          | Zod 티커 형식 검증 (`^[A-Za-z.\-]+$`, 1~10자)                                                                   |
| 분석 실행     | `composeTickerAnalysis`는 슬롯별 `Result` 반환 (부분 성공). `meta.completed===0`일 때만 전체 실패 → `TRPCError` |
| LLM 키 미설정 | 전용 어댑터(`createStockConfigAdapter`)가 `keyInfo.apiKey` 없으면 명확한 한국어 에러 throw → 슬롯 실패로 전파   |

- **부분 성공이 정상 케이스**: 일부 슬롯 실패해도 DB 저장 + 실패 셀만 UI 에러 표시.
- **비용 주의**: full=12 LLM 호출. UI 기본값 lite, full 선택 시 "12회 LLM 호출, 비용 발생" 안내.

## 10. 테스트

- `analyzeTicker` 단위 테스트 — `composeTickerAnalysis` mock, adapter 주입·depth 기본값(lite) 확인.
- 라우터 테스트 — 잘못된 티커 거부, `meta.completed===0` 시 TRPCError, 성공 시 DB INSERT 확인.
- 컴포넌트 — 시그널 배지 색 매핑·실패 슬롯 분기만 가벼운 단위 테스트. 시각 검증은 실제 렌더 우선.
- 빌드 검증 — `pnpm build` (tickerlens가 web 번들에 안 새는지 / serverExternalPackages 확인), `pnpm lint`.

## 11. 네비게이션 연결

`apps/web/src/components/layout/app-sidebar.tsx`에 `/stocks` 진입점 추가 (기존 탭/링크 패턴 따름).
페이지는 `dashboard/page.tsx`와 동일하게 `AppShell + AppSidebar + AppHeader`로 래핑.
