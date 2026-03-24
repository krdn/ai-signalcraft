# Phase 2: AI Analysis Engine + Report - Research

**Researched:** 2026-03-24
**Domain:** AI-powered text analysis pipeline, structured output generation, report automation
**Confidence:** HIGH

## Summary

Phase 2는 Phase 1에서 수집/저장된 네이버 뉴스/유튜브 데이터를 8개 독립 분석 모듈로 처리하고, 결과를 통합한 종합 전략 리포트를 자동 생성하는 것이 목표이다. 핵심 기술 스택은 이미 Phase 1에서 구축된 AI Gateway(`generateObject`, `generateText`), BullMQ Flow, Drizzle ORM이며, Phase 2에서는 이를 확장하여 분석 파이프라인을 구축한다.

기존 `ai-gateway` 패키지의 `analyzeStructured()`는 이미 Zod 스키마 기반 `generateObject`를 지원하므로, 8개 분석 모듈 각각이 자체 Zod 스키마와 시스템 프롬프트를 정의하고 AI Gateway를 호출하는 패턴으로 구현한다. BullMQ Flow는 현재 `collect -> normalize -> persist` 체인이며, 여기에 `analyze` (병렬 모듈 실행) -> `report` (통합 리포트 생성) 단계를 추가한다. D-10에 따라 1단계 병렬(모듈1~4) -> 2단계 순차(모듈5~7, 1단계 결과 의존) -> 3단계 리포트(모듈8) 구조를 BullMQ Flow의 다단계 의존성으로 표현한다.

**Primary recommendation:** 각 분석 모듈을 `AnalysisModule` 인터페이스로 통일하고, AI Gateway의 `analyzeStructured()` + 모듈별 Zod 스키마로 구조화된 결과를 생성한 뒤, `analysis_results` JSONB 테이블에 저장. 최종 리포트는 `analyzeText()`로 자연어 마크다운 생성 후 `analysis_reports` 테이블에 저장.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 8개 분석 항목을 각각 독립된 모듈로 분리. 각 모듈이 개별 프롬프트 + Zod 스키마로 구조화된 결과 반환.
- **D-02:** Phase 2 범위: 분석 1~7 + 최종 요약(8번). 추가 기능 1~4(ADVN-01~04)는 Phase 4.
  - 모듈 1: 전체 여론 구조 분석 (Macro View) -> ANLZ-01
  - 모듈 2: 집단별 반응 분석 (Segmentation) -> ANLZ-04
  - 모듈 3: 감정 및 프레임 분석 (Sentiment & Framing) -> ANLZ-01, DEEP-01
  - 모듈 4: 메시지 효과 분석 (Message Impact) -> DEEP-02
  - 모듈 5: 리스크 분석 (Risk Map) -> DEEP-03
  - 모듈 6: 기회 분석 (Opportunity) -> DEEP-04
  - 모듈 7: 전략 도출 (Actionable Strategy) -> DEEP-05
  - 모듈 8: 최종 전략 요약 -> REPT-02
- **D-03:** 모듈별 최적 AI 모델 지정. 감성/키워드 등 정량 분석은 GPT-4o-mini(비용 절감), 심층 분석(리스크/전략)은 Claude Sonnet(품질 우선). AI Gateway에서 모듈별 모델 라우팅.
- **D-04:** 2단계 하이브리드 생성. 1단계: 각 모듈이 독립적으로 Zod 구조화 결과 생성. 2단계: 모든 모듈 결과를 AI에 넘겨 자연어 종합 리포트 생성.
- **D-05:** 최종 포맷은 마크다운 우선. PDF 내보내기 기능 제공. 두 단계 모두 DB에 저장.
- **D-06:** 단일 `analysis_results` 테이블 + JSONB 구조. jobId, module(감성/키워드/프레임 등), result(JSONB) 저장.
- **D-07:** 별도 `analysis_reports` 테이블에 종합 리포트(마크다운) 저장.
- **D-08:** 히스토리 비교 기능은 Phase 3 대시보드에서 구현. Phase 2에서는 저장만.
- **D-09:** 수집 완료 후 자동 분석 실행. BullMQ Flow에 analyze 단계 추가: collect -> normalize -> persist -> analyze -> report.
- **D-10:** 병렬 분석 -> 순차 통합 패턴. 1단계: 모듈1~4 병렬 실행. 2단계: 1단계 결과 기반으로 모듈5~7 순차 실행. 3단계: 종합 리포트 생성.

### Claude's Discretion
- 각 분석 모듈의 구체적 프롬프트 엔지니어링
- Zod 스키마의 세부 필드 설계
- PDF 내보내기 라이브러리 선택
- 에러 핸들링 및 부분 실패 처리 전략
- 분석 결과 캐싱 전략

### Deferred Ideas (OUT OF SCOPE)
- 추가 기능 1~4 (지지율 추정, 프레임 전쟁, 위기 시나리오, 승리 시뮬레이션) -- Phase 4
- 분석 히스토리 비교/조회 UI -- Phase 3
- 재분석(기존 수집 데이터에 대해 다시 분석) 기능 -- Phase 3 대시보드에서 트리거
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANLZ-01 | 감성 분석 (긍정/부정/중립 분류, 감정 비율 산출) | 모듈1(Macro View) + 모듈3(Sentiment & Framing)에서 커버. `generateObject` + Zod 스키마로 감정 비율 구조화. GPT-4o-mini 사용(D-03) |
| ANLZ-02 | 연관어/키워드 분석 (반복 키워드 추출, 연관어 네트워크) | 모듈3(Sentiment & Framing)에서 키워드 추출. kiwi-nlp 형태소 분석 보조 가능하나 AI 프롬프트 기반 추출이 주력 |
| ANLZ-03 | 시계열 트렌드 분석 (일별 언급량, 감성 추이, 변곡점 탐지) | 모듈1(Macro View)에서 시간 흐름 분석 + 변곡점 정의. DB에서 publishedAt 기반 집계 후 AI에 전달 |
| ANLZ-04 | 집단별 반응 분석 (플랫폼별, 담론 클러스터별 세분화) | 모듈2(Segmentation)에서 전담. source 필드로 플랫폼 구분, AI가 담론 클러스터 식별 |
| DEEP-01 | 프레임 분석 (프레임 유형 분류, 긍정/부정 프레임 TOP5, 충돌 구조) | 모듈3(Sentiment & Framing)에서 커버. Claude Sonnet 사용(D-03) |
| DEEP-02 | 메시지 효과 분석 (여론 변화 유발 발언/콘텐츠 식별) | 모듈4(Message Impact)에서 전담. 성공/실패 메시지 구분 |
| DEEP-03 | 리스크 분석 (Top 3 리스크 + 영향도 + 확산 가능성) | 모듈5(Risk Map)에서 전담. 2단계 순차 실행(1단계 결과 의존) |
| DEEP-04 | 기회 분석 (확장 가능한 긍정 요소, 미활용 영역) | 모듈6(Opportunity)에서 전담. 2단계 순차 실행 |
| DEEP-05 | 전략 도출 (타겟/메시지/콘텐츠/리스크 대응 전략) | 모듈7(Actionable Strategy)에서 전담. 모든 선행 분석 결과 참조 |
| REPT-01 | AI 종합 분석 리포트 자동 생성 (8개 분석 모듈 결과 통합) | 모듈8(최종 전략 요약) + 2단계 자연어 통합 리포트 생성. `analyzeText()`로 마크다운 생성 |
| REPT-02 | 최종 전략 요약 (현재 상태 + 승부 핵심 한 줄 요약) | 모듈8 Zod 스키마에 oneLiner 필드 포함. 통합 리포트 최상단에 배치 |
| REPT-03 | 리포트 PDF/마크다운 내보내기 | md-to-pdf 라이브러리로 마크다운 -> PDF 변환. Playwright(이미 설치됨) headless Chrome 활용 |
</phase_requirements>

## Standard Stack

### Core (이미 설치됨 -- Phase 1 산출물)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ai (Vercel AI SDK) | 6.0.x | AI 모델 호출 통합 | `generateObject`로 Zod 스키마 기반 구조화 출력, `generateText`로 자유 텍스트 생성. usage 필드로 토큰 추적 |
| @ai-sdk/anthropic | 3.0.x | Claude 프로바이더 | Claude Sonnet 4 모델 지원. 심층 분석용 |
| @ai-sdk/openai | 3.0.x | GPT 프로바이더 | GPT-4o-mini 모델 지원. 정량 분석용(비용 절감) |
| zod | 4.x | 스키마 검증 | AI SDK `generateObject` 스키마 정의. 분석 결과 타입 안전성 |
| bullmq | 5.x | 작업 큐 | FlowProducer로 analyze 파이프라인 단계 추가. 병렬/순차 실행 패턴 |
| drizzle-orm | 0.45.x | ORM | analysis_results, analysis_reports 테이블 스키마 + CRUD |

### New (Phase 2에서 추가)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| md-to-pdf | 5.2.x | PDF 내보내기 | 마크다운 리포트를 PDF로 변환. Puppeteer/Chromium 기반 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| md-to-pdf | Playwright PDF (이미 설치됨) | Playwright가 이미 의존성에 있으므로 md-to-pdf 대신 Playwright의 `page.pdf()` 사용 가능. md-to-pdf도 내부적으로 Puppeteer 사용. **권장: Playwright 직접 사용으로 추가 의존성 제거** |
| generateObject (모듈별) | 단일 거대 프롬프트 | 모듈 분리가 테스트/디버깅/비용 관리에 유리. D-01 결정 |

**Installation:**
```bash
# Phase 2에서 추가 설치 불필요 -- 기존 스택 활용
# PDF 내보내기를 Playwright로 처리하면 새 의존성 없음
# md-to-pdf 사용 시:
pnpm --filter @ai-signalcraft/core add md-to-pdf
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/
├── analysis/                    # 분석 모듈 디렉토리
│   ├── modules/                 # 8개 개별 분석 모듈
│   │   ├── macro-view.ts        # 모듈1: 전체 여론 구조 분석
│   │   ├── segmentation.ts      # 모듈2: 집단별 반응 분석
│   │   ├── sentiment-framing.ts # 모듈3: 감정 및 프레임 분석
│   │   ├── message-impact.ts    # 모듈4: 메시지 효과 분석
│   │   ├── risk-map.ts          # 모듈5: 리스크 분석
│   │   ├── opportunity.ts       # 모듈6: 기회 분석
│   │   ├── strategy.ts          # 모듈7: 전략 도출
│   │   └── final-summary.ts     # 모듈8: 최종 전략 요약
│   ├── schemas/                 # 모듈별 Zod 스키마
│   │   ├── macro-view.schema.ts
│   │   ├── segmentation.schema.ts
│   │   ├── sentiment-framing.schema.ts
│   │   ├── message-impact.schema.ts
│   │   ├── risk-map.schema.ts
│   │   ├── opportunity.schema.ts
│   │   ├── strategy.schema.ts
│   │   └── final-summary.schema.ts
│   ├── prompts/                 # 모듈별 시스템 프롬프트
│   │   └── [module-name].prompt.ts
│   ├── runner.ts                # 분석 실행 오케스트레이터 (병렬/순차 관리)
│   ├── data-loader.ts           # DB에서 수집 데이터 로드 + 전처리
│   └── index.ts                 # barrel export
├── report/                      # 리포트 생성
│   ├── generator.ts             # 통합 리포트 마크다운 생성
│   ├── pdf-exporter.ts          # PDF 내보내기
│   └── index.ts
├── db/schema/
│   ├── collections.ts           # 기존
│   └── analysis.ts              # 신규: analysis_results + analysis_reports 테이블
├── queue/
│   ├── flows.ts                 # 기존 + analyze/report 단계 추가
│   └── worker-process.ts        # 기존 + analyze/report 핸들러 추가
└── pipeline/                    # 기존 (수집 파이프라인)
```

### Pattern 1: Analysis Module Interface
**What:** 모든 분석 모듈이 동일한 인터페이스를 구현하여 일관된 실행/테스트/에러 처리
**When to use:** 8개 분석 모듈 각각 구현 시

```typescript
// 분석 모듈 공통 인터페이스
interface AnalysisModule<T> {
  readonly name: string;           // 'macro-view', 'segmentation', etc.
  readonly displayName: string;    // '전체 여론 구조 분석'
  readonly provider: AIProvider;   // D-03: 모듈별 AI 모델 지정
  readonly model: string;          // 'gpt-4o-mini' or 'claude-sonnet-4-20250514'
  readonly schema: z.ZodType<T>;   // 모듈별 Zod 스키마

  buildPrompt(data: AnalysisInput): string;     // 입력 데이터 -> 프롬프트
  buildSystemPrompt(): string;                   // 시스템 프롬프트

  // 선택: 선행 분석 결과가 필요한 모듈용 (모듈5~7)
  buildPromptWithContext?(
    data: AnalysisInput,
    priorResults: Record<string, unknown>
  ): string;
}

// 분석 입력 데이터 (DB에서 로드)
interface AnalysisInput {
  jobId: number;
  keyword: string;
  articles: Array<{ title: string; content: string; publisher: string; publishedAt: Date }>;
  videos: Array<{ title: string; description: string; channelTitle: string; viewCount: number; likeCount: number }>;
  comments: Array<{ content: string; source: string; likeCount: number; publishedAt: Date }>;
  dateRange: { start: Date; end: Date };
}
```

### Pattern 2: 3-Stage Execution (D-10)
**What:** 병렬 -> 순차 -> 리포트 3단계 실행
**When to use:** 분석 파이프라인 오케스트레이션

```typescript
// Stage 1: 병렬 실행 (독립 모듈)
const stage1Results = await Promise.allSettled([
  runModule(macroView, input),      // 모듈1
  runModule(segmentation, input),   // 모듈2
  runModule(sentimentFraming, input),// 모듈3
  runModule(messageImpact, input),  // 모듈4
]);

// Stage 2: 순차 실행 (Stage 1 결과 의존)
const stage1Data = collectFulfilledResults(stage1Results);
const riskResult = await runModuleWithContext(riskMap, input, stage1Data);
const opportunityResult = await runModuleWithContext(opportunity, input, { ...stage1Data, risk: riskResult });
const strategyResult = await runModuleWithContext(strategy, input, { ...stage1Data, risk: riskResult, opportunity: opportunityResult });

// Stage 3: 종합 리포트
const allResults = { ...stage1Data, risk: riskResult, opportunity: opportunityResult, strategy: strategyResult };
const finalSummary = await runModuleWithContext(finalSummaryModule, input, allResults);
const report = await generateIntegratedReport(allResults, finalSummary);
```

### Pattern 3: AI Gateway 모델 라우팅 (D-03)
**What:** 모듈별로 최적 AI 모델을 지정하여 비용/품질 트레이드오프 관리
**When to use:** 각 분석 모듈 실행 시

```typescript
// 모듈별 모델 매핑 (D-03)
const MODULE_MODEL_MAP: Record<string, { provider: AIProvider; model: string }> = {
  'macro-view':        { provider: 'openai',    model: 'gpt-4o-mini' },      // 정량 분석
  'segmentation':      { provider: 'openai',    model: 'gpt-4o-mini' },      // 정량 분석
  'sentiment-framing': { provider: 'openai',    model: 'gpt-4o-mini' },      // 정량 분석
  'message-impact':    { provider: 'openai',    model: 'gpt-4o-mini' },      // 정량 분석
  'risk-map':          { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }, // 심층 분석
  'opportunity':       { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }, // 심층 분석
  'strategy':          { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }, // 심층 분석
  'final-summary':     { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }, // 심층 분석
  'integrated-report': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' }, // 통합 리포트
};

// 모듈 실행 함수
async function runModule<T>(module: AnalysisModule<T>, input: AnalysisInput) {
  const config = MODULE_MODEL_MAP[module.name];
  const result = await analyzeStructured(
    module.buildPrompt(input),
    module.schema,
    { provider: config.provider, model: config.model }
  );
  return {
    module: module.name,
    result: result.object,
    usage: result.usage,  // 토큰 추적
  };
}
```

### Pattern 4: DB 스키마 설계 (D-06, D-07)
**What:** analysis_results (모듈별 JSONB) + analysis_reports (통합 리포트) 테이블
**When to use:** Drizzle 스키마 정의 시

```typescript
// packages/core/src/db/schema/analysis.ts
import { pgTable, text, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { collectionJobs } from './collections';

// D-06: 분석 결과 (모듈별)
export const analysisResults = pgTable('analysis_results', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id).notNull(),
  module: text('module').notNull(),  // 'macro-view', 'segmentation', etc.
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed'],
  }).notNull().default('pending'),
  result: jsonb('result'),           // 모듈별 Zod 스키마로 타입 보장
  usage: jsonb('usage').$type<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    provider: string;
    model: string;
  }>(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('analysis_results_job_module_idx').on(table.jobId, table.module),
]);

// D-07: 종합 분석 리포트
export const analysisReports = pgTable('analysis_reports', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id).notNull(),
  title: text('title').notNull(),
  markdownContent: text('markdown_content').notNull(),
  oneLiner: text('one_liner'),       // REPT-02: 한 줄 요약
  metadata: jsonb('metadata').$type<{
    keyword: string;
    dateRange: { start: string; end: string };
    modulesCompleted: string[];
    modulesFailed: string[];
    totalTokens: number;
    generatedAt: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Pattern 5: BullMQ Flow 확장 (D-09)
**What:** 기존 collect -> normalize -> persist 체인에 analyze -> report 추가
**When to use:** `flows.ts` 확장 시

```typescript
// flows.ts 확장 -- persist 완료 후 analyze -> report 체인 추가
// BullMQ Flow에서 persist가 최상위 부모이므로, analyze는 persist 완료 후 별도 Flow로 트리거
// 또는 persist 핸들러 내에서 새 Flow를 추가하는 패턴

// 방법 1: persist 핸들러에서 분석 Flow 트리거
// worker-process.ts의 persist 핸들러 끝에:
if (job.name === 'persist') {
  // ... 기존 persist 로직 ...

  // 분석 파이프라인 트리거
  await triggerAnalysis(dbJobId, keyword);
}

// 방법 2: 별도 triggerAnalysis 함수
async function triggerAnalysis(dbJobId: number, keyword: string) {
  const flow = await getFlowProducer().add({
    name: 'generate-report',
    queueName: 'analysis',
    data: { dbJobId, keyword, stage: 'report' },
    children: [
      {
        name: 'analyze-stage2',
        queueName: 'analysis',
        data: { dbJobId, keyword, stage: 2, modules: ['risk-map', 'opportunity', 'strategy'] },
        children: [
          {
            name: 'analyze-stage1',
            queueName: 'analysis',
            data: { dbJobId, keyword, stage: 1, modules: ['macro-view', 'segmentation', 'sentiment-framing', 'message-impact'] },
          },
        ],
      },
    ],
  });
  return flow;
}
```

### Anti-Patterns to Avoid
- **거대 단일 프롬프트:** 8개 분석을 하나의 프롬프트로 실행하면 토큰 낭비, 에러 디버깅 불가, 부분 재실행 불가
- **모듈 결과에 타입 없음:** JSONB에 저장하더라도 Zod 스키마로 런타임 검증 필수. `generateObject`가 이를 보장
- **동기 순차 실행:** 독립 모듈(1~4)을 순차로 실행하면 불필요한 지연. `Promise.allSettled`로 병렬화
- **AI 호출 실패 시 전체 중단:** 부분 실패 허용. 8개 중 일부 실패해도 나머지 결과로 리포트 생성 가능

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI 모델 호출 통합 | HTTP 클라이언트 직접 구현 | AI SDK `generateObject`/`generateText` | 프로바이더별 API 차이, 스트리밍, 에러 핸들링, 토큰 추적 내장 |
| 구조화된 AI 출력 | JSON 파싱 + 수동 검증 | AI SDK `generateObject` + Zod | 스키마 기반 자동 검증, 재시도, 타입 추론 |
| 작업 큐 병렬/순차 관리 | Promise 체인 수동 관리 | BullMQ FlowProducer | 재시도, 상태 추적, 부모-자식 의존성, 실패 격리 |
| 마크다운 -> PDF | HTML 수동 렌더링 | Playwright `page.pdf()` 또는 md-to-pdf | CSS 스타일링, 페이지 번호, 헤더/푸터 자동 처리 |
| 토큰 사용량 추적 | 수동 카운팅 | AI SDK `usage` 반환값 | `inputTokens`, `outputTokens`, `totalTokens` 자동 제공 |

**Key insight:** AI SDK의 `generateObject`가 Zod 스키마 -> AI 프롬프트 변환 -> JSON 파싱 -> 스키마 검증을 모두 자동화하므로, 분석 모듈 개발은 스키마와 프롬프트 설계에만 집중하면 된다.

## Common Pitfalls

### Pitfall 1: 토큰 한도 초과
**What goes wrong:** 수집 데이터(기사 100개 + 댓글 수천 개)를 그대로 프롬프트에 넣으면 컨텍스트 윈도우 초과
**Why it happens:** GPT-4o-mini는 128K, Claude Sonnet은 200K 토큰이지만 출력 토큰도 포함
**How to avoid:** 데이터 로더에서 내용을 요약/샘플링하여 프롬프트 크기 제한. 기사 본문은 처음 500자, 댓글은 상위 좋아요 순 500개로 제한. 총 프롬프트 크기를 모듈별로 모니터링.
**Warning signs:** AI 호출에서 `length` finishReason 반환, 결과 JSON이 잘림

### Pitfall 2: generateObject 스키마 복잡도
**What goes wrong:** Zod 스키마가 너무 복잡하면(deeply nested, optional 필드 과다) AI가 유효한 JSON 생성에 실패
**Why it happens:** AI 모델은 복잡한 스키마일수록 구조 일치율 하락
**How to avoid:** 각 모듈 스키마를 2~3단계 깊이로 제한. 복잡한 분석은 flat한 배열 구조 선호. `schemaName`과 `schemaDescription` 파라미터 활용하여 AI에 힌트 제공.
**Warning signs:** `NoObjectGeneratedError` 반복 발생

### Pitfall 3: BullMQ Flow 다단계 의존성 설계
**What goes wrong:** 기존 Flow가 `persist`를 최상위로 사용하므로, analyze를 단순히 children에 추가하면 의존성 방향이 역전
**Why it happens:** BullMQ Flow는 children이 먼저 실행되고 parent가 나중에 실행됨 (부모는 자식 완료 대기)
**How to avoid:** persist 완료 후 별도 Flow(`triggerAnalysis`)를 시작하는 패턴 사용. 또는 analysis 전용 큐를 분리하여 persist worker에서 분석 트리거.
**Warning signs:** analyze 작업이 collect보다 먼저 실행됨

### Pitfall 4: 부분 실패 시 리포트 생성
**What goes wrong:** 8개 모듈 중 1개라도 실패하면 전체 리포트 생성이 막힘
**Why it happens:** 에러 전파 전략이 없으면 하나의 실패가 전체를 중단
**How to avoid:** `Promise.allSettled` 사용. 실패한 모듈은 `analysis_results`에 status='failed' + errorMessage 저장. 리포트 생성 시 가용한 모듈 결과만으로 생성하되, 누락 섹션을 명시.
**Warning signs:** 특정 모듈 반복 실패로 리포트가 계속 생성 불가

### Pitfall 5: AI SDK 호출 비용 폭증
**What goes wrong:** 한 번의 분석에 8개 모듈 + 통합 리포트 = 최소 9회 AI 호출. 비용 관리 없으면 예상 밖 과금
**Why it happens:** 모듈별 입력 데이터가 중복되어 토큰 소비 증가
**How to avoid:** 모듈별 `usage` (inputTokens, outputTokens) 를 DB에 기록. 분석당 총 토큰 메타데이터로 저장. 대용량 수집 결과 시 데이터 샘플링 적용.
**Warning signs:** `usage.totalTokens`가 단일 분석에 100K 이상

## Code Examples

### AI Gateway 확장: 시스템 프롬프트 + usage 반환

```typescript
// packages/ai-gateway/src/gateway.ts 확장
// Source: AI SDK v6 공식 문서 (https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object)

export async function analyzeStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: AIGatewayOptions = {},
) {
  const provider = options.provider ?? 'anthropic';
  const result = await generateObject({
    model: getModel(provider, options.model),
    system: options.systemPrompt,   // 시스템 프롬프트 추가
    prompt,
    schema,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
  });

  return {
    object: result.object,           // 타입 안전한 결과
    usage: result.usage,             // { inputTokens, outputTokens, totalTokens }
    finishReason: result.finishReason,
  };
}

// AIGatewayOptions 확장
export interface AIGatewayOptions {
  provider?: AIProvider;
  model?: string;
  maxOutputTokens?: number;
  systemPrompt?: string;            // 신규
}
```

### 분석 결과 persist 함수

```typescript
// packages/core/src/analysis/persist-analysis.ts
import { db } from '../db';
import { analysisResults, analysisReports } from '../db/schema/analysis';
import { sql } from 'drizzle-orm';

export async function persistAnalysisResult(data: {
  jobId: number;
  module: string;
  status: 'completed' | 'failed';
  result?: unknown;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number; provider: string; model: string };
  errorMessage?: string;
}) {
  return db
    .insert(analysisResults)
    .values({
      jobId: data.jobId,
      module: data.module,
      status: data.status,
      result: data.result,
      usage: data.usage,
      errorMessage: data.errorMessage,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [analysisResults.jobId, analysisResults.module],
      set: {
        status: sql`excluded.status`,
        result: sql`excluded.result`,
        usage: sql`excluded.usage`,
        errorMessage: sql`excluded.error_message`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning();
}
```

### PDF 내보내기 (Playwright 활용)

```typescript
// packages/core/src/report/pdf-exporter.ts
// Playwright가 이미 의존성에 있으므로 추가 설치 불필요
import { chromium } from 'playwright';

export async function exportToPdf(markdownHtml: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 마크다운을 HTML로 변환 (marked 또는 직접 HTML 래핑)
  const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Noto Sans KR', sans-serif; padding: 40px; line-height: 1.6; }
        h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
        h2 { color: #2563eb; margin-top: 24px; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f3f4f6; }
      </style>
    </head>
    <body>${markdownHtml}</body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle' });
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true,
  });

  await browser.close();
  return pdf;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| generateObject 단독 사용 | generateText + Output.object() 통합 | AI SDK v6 (2025) | generateText에서도 구조화 출력 가능. 하지만 generateObject가 더 직관적이므로 모듈별 구조화 출력에는 generateObject 계속 사용 |
| usage: { promptTokens, completionTokens } | usage: { inputTokens, outputTokens, totalTokens } | AI SDK v6 | 필드명 변경됨. promptTokens -> inputTokens, completionTokens -> outputTokens |
| sdk.vercel.ai | ai-sdk.dev | 2025 | 공식 문서 URL 변경. 기존 URL은 301 리다이렉트 |

**Deprecated/outdated:**
- `generateObject`의 `mode` 파라미터: AI SDK v6에서는 프로바이더가 자동으로 최적 모드 선택
- `experimental_telemetry`: AI SDK v6에서 정식 telemetry로 전환

## Open Questions

1. **프롬프트 최적화 전략**
   - What we know: `docs/prompt.md`에 8개 분석 항목의 기대 출력이 정의됨
   - What's unclear: 프롬프트당 최적 토큰 예산, 입력 데이터 샘플링 비율
   - Recommendation: 첫 구현에서 보수적으로 시작 (기사 50개, 댓글 300개 제한), 결과 품질 보고 조정

2. **Stage 2 순차 실행의 세부 의존성**
   - What we know: D-10에 따라 모듈5~7은 Stage 1 결과 의존
   - What's unclear: 모듈5(리스크)가 모듈6(기회) 결과도 필요한지, 또는 모두 Stage 1만 참조하는지
   - Recommendation: 모듈5/6은 Stage 1만 참조, 모듈7(전략)은 모듈5+6 결과도 참조하는 점진적 의존 구조

3. **마크다운 -> HTML 변환 라이브러리**
   - What we know: PDF 내보내기 전 마크다운을 HTML로 변환 필요
   - What's unclear: marked vs markdown-it 선택
   - Recommendation: `marked` 사용 (더 가볍고 단순, 이 용도에 충분)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전체 | ✓ | v24.14.0 | -- |
| pnpm | 패키지 관리 | ✓ | (설치됨) | -- |
| PostgreSQL | DB 저장 | ✓ | 16.x (192.168.0.5:5433) | -- |
| Redis | BullMQ | ✓ | 7.x (192.168.0.5:6380/6381) | -- |
| Playwright | PDF 내보내기 | ✓ | 1.50.x (collectors 패키지에 설치됨) | md-to-pdf |
| OpenAI API Key | GPT-4o-mini 호출 | 확인 필요 | -- | .env 설정 필요 |
| Anthropic API Key | Claude Sonnet 호출 | 확인 필요 | -- | .env 설정 필요 |

**Missing dependencies with no fallback:**
- API 키(OpenAI, Anthropic)가 .env에 설정되어 있어야 함. Phase 1에서 AI Gateway 골격을 만들었으므로 이미 설정되었을 가능성 높음.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `packages/core/vitest.config.ts`, `packages/ai-gateway/vitest.config.ts` |
| Quick run command | `pnpm --filter @ai-signalcraft/core test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLZ-01 | 감성 분석 결과 Zod 스키마 검증 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "macro-view\|sentiment"` | Wave 0 |
| ANLZ-02 | 키워드 추출 결과 스키마 검증 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "sentiment-framing"` | Wave 0 |
| ANLZ-03 | 시계열 트렌드 스키마 검증 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "macro-view"` | Wave 0 |
| ANLZ-04 | 집단별 반응 결과 스키마 검증 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "segmentation"` | Wave 0 |
| DEEP-01~05 | 심층 분석 모듈 결과 스키마 검증 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "risk\|opportunity\|strategy"` | Wave 0 |
| REPT-01 | 통합 리포트 마크다운 생성 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "report"` | Wave 0 |
| REPT-02 | 한 줄 요약 포함 검증 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "final-summary"` | Wave 0 |
| REPT-03 | PDF 내보내기 함수 존재 | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "pdf"` | Wave 0 |
| D-06 | analysis_results 테이블 CRUD | unit | `pnpm --filter @ai-signalcraft/core test -- --grep "analysis.*persist"` | Wave 0 |
| D-09 | persist 후 분석 트리거 연결 | smoke | `pnpm --filter @ai-signalcraft/core test -- --grep "flow\|trigger"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @ai-signalcraft/core test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/core/tests/analysis-module.test.ts` -- 분석 모듈 인터페이스 + 스키마 검증
- [ ] `packages/core/tests/analysis-persist.test.ts` -- analysis_results/reports 테이블 CRUD
- [ ] `packages/core/tests/analysis-runner.test.ts` -- 3-stage 실행 로직 (AI 호출 mock)
- [ ] `packages/core/tests/report-generator.test.ts` -- 리포트 마크다운 생성 검증
- [ ] `packages/ai-gateway/tests/gateway.test.ts` -- AI Gateway 확장 (systemPrompt, usage) 검증

## Sources

### Primary (HIGH confidence)
- AI SDK v6 공식 문서 (https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object) - generateObject API, usage 반환, Output 타입
- AI SDK v6 공식 문서 (https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) - generateText API, usage 필드명
- BullMQ 공식 문서 (https://docs.bullmq.io/guide/flows) - FlowProducer, getChildrenValues, 부모-자식 패턴
- 기존 코드 분석 - gateway.ts, flows.ts, worker-process.ts, collections.ts, normalize.ts, persist.ts

### Secondary (MEDIUM confidence)
- AI SDK v6 프로바이더 문서 (https://ai-sdk.dev/docs/foundations/providers-and-models) - 모델명, 프로바이더 설정
- md-to-pdf npm 패키지 (https://www.npmjs.com/package/md-to-pdf) - PDF 내보내기 대안

### Tertiary (LOW confidence)
- docs/prompt.md (프롬프트 원본) - 프롬프트 엔지니어링 시 참고하되 Zod 스키마에 맞게 재설계 필요

## Project Constraints (from CLAUDE.md)

- **패키지 매니저:** pnpm 사용
- **Node.js:** v24.14.0
- **인프라:** 운영 서버(192.168.0.5) PostgreSQL, Redis 활용
- **API 비용 관리:** 분석 단위별 토큰 최적화 필요
- **보안:** API 키 하드코딩 금지, .env로 관리
- **GSD Workflow:** Edit/Write 전 GSD 명령으로 진입
- **커밋 메시지:** 한국어, 타입 prefix (feat/fix/docs 등)
- **Superpowers 호출:** brainstorming(Task 전), TDD(코드 Task 시작), code-review(완료 후) 필수

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Phase 1에서 이미 구축된 스택 확장, AI SDK/BullMQ 공식 문서 확인
- Architecture: HIGH - 기존 코드 패턴(Collector Adapter, normalize-persist) 동일 적용, D-01~D-10 결정 반영
- Pitfalls: HIGH - AI SDK 토큰 관리, BullMQ Flow 의존성 방향, 부분 실패 처리는 공식 문서 기반

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (AI SDK v6 안정기, 30일 유효)
