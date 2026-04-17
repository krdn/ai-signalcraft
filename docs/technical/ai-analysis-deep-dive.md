---
title: 'AI 분석 파이프라인 기술 상세'
description: '기사·댓글이 AI에 의해 분석되는 전체 기술 과정 — 프롬프트 설계, 스키마, Map-Reduce, 도메인 커스터마이제이션'
order: 3
---

> **소스**: `/home/gon/projects/ai/ai-signalcraft`
> **작성일**: 2026-04-17

# AI 분석 파이프라인 기술 상세

이 문서는 AI SignalCraft가 수집된 기사·영상·댓글 데이터를 **어떤 기술적 방식으로** AI 분석하는지를 상세히 설명합니다. 워크플로우 전체 흐름은 [analysis-workflow.md](./analysis-workflow.md)를 참조하세요.

## 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [데이터 입력: 수집에서 분석까지](#2-데이터-입력-수집에서-분석까지)
3. [Stage 0: 개별 감정 분석 (경량 BERT)](#3-stage-0-개별-감정-분석)
4. [Stage 1~3: LLM 기반 여론 분석](#4-stage-13-llm-기반-여론-분석)
5. [프롬프트 설계 전략](#5-프롬프트-설계-전략)
6. [Zod 스키마: AI 응답 구조화](#6-zod-스키마-ai-응답-구조화)
7. [Map-Reduce: 대량 데이터 분할 분석](#7-map-reduce-대량-데이터-분할-분석)
8. [Context Distillation: Stage 간 데이터 전달](#8-context-distillation-stage-간-데이터-전달)
9. [도메인 커스터마이제이션](#9-도메인-커스터마이제이션)
10. [AI 모델 선정 및 프로바이더 통합](#10-ai-모델-선정-및-프로바이더-통합)
11. [비용 최적화 및 성능](#11-비용-최적화-및-성능)
12. [오류 처리 및 신뢰성](#12-오류-처리-및-신뢰성)

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                        데이터 수집 단계                               │
│  네이버뉴스 ─┐                                                      │
│  YouTube    ─┤  AsyncGenerator  →  정규화  →  DB 저장  →  임베딩 생성  │
│  DC인사이드  ─┤   (청크 yield)      (댓글 수집)  (articles,   (ONNX)   │
│  FM코리아   ─┤                                 videos,              │
│  클리앙     ─┘                                 comments)            │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ persist 완료 → 분석 자동 트리거
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AI 분석 단계                                  │
│                                                                     │
│  Stage 0: 개별 감정분석 (경량 BERT, LLM 미사용)                       │
│     └─ 기사/댓글 각각에 positive/negative/neutral 태깅               │
│                                                                     │
│  Stage 1: 기초 분석 (4개 모듈 병렬)     ← Gemini Flash              │
│     ├─ macro-view      (여론 구조)                                  │
│     ├─ segmentation    (집단 분류)                                  │
│     ├─ sentiment-framing (감정/프레임)                              │
│     └─ message-impact  (메시지 영향도)                              │
│                                                                     │
│  Stage 2: 심화 분석 (Stage 1 결과 참조)  ← Claude Sonnet             │
│     ├─ risk-map + opportunity  (병렬)                               │
│     └─ strategy                (순차, risk+opportunity 후)          │
│                                                                     │
│  Stage 3: 종합 요약                      ← Claude Sonnet             │
│     └─ final-summary (전체 결과 통합)                                │
│                                                                     │
│  Stage 4: 도메인 심화 (선택)             ← Claude Sonnet             │
│     └─ 도메인별 전문 모듈 (정치, 팬덤, PR 등 12개 도메인)             │
│                                                                     │
│  → 리포트 생성 (Markdown)                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 핵심 설계 원칙

| 원칙               | 설명                                              |
| ------------------ | ------------------------------------------------- |
| **모듈 독립성**    | 각 분석 모듈은 독립된 프롬프트·스키마·모델을 가짐 |
| **단방향 의존성**  | Stage 1 → 2 → 3 → 4 순서, 역방향 참조 불가        |
| **부분 실패 허용** | 개별 모듈 실패해도 나머지 계속 진행               |
| **구조화된 출력**  | 모든 AI 응답은 Zod 스키마로 검증·파싱             |
| **비용 제어**      | Map-Reduce 청킹 + 프로바이더별 모델 선택          |

---

## 2. 데이터 입력: 수집에서 분석까지

### 2.1 AI에 전달되는 데이터 형태

수집된 원본 데이터는 DB에 저장된 후, 분석 시작 시 `loadAnalysisInput()` 함수가 **토큰 최적화된 형태**로 로드합니다.

**파일**: `packages/core/src/analysis/data-loader.ts`

```typescript
interface AnalysisInput {
  jobId: number;
  keyword: string; // 분석 키워드 (예: "윤석열")

  articles: Array<{
    title: string; // 기사 제목
    content: string | null; // 본문 (500자 제한!)
    publisher: string | null; // 언론사
    publishedAt: Date | null; // 발행일
    source: string; // 소스 (naver-news, rss 등)
  }>;

  videos: Array<{
    title: string; // 영상 제목
    description: string | null; // 설명
    channelTitle: string | null; // 채널명
    viewCount: number | null; // 조회수
    likeCount: number | null; // 좋아요 수
    publishedAt: Date | null; // 게시일
  }>;

  comments: Array<{
    content: string; // 댓글 내용
    source: string; // 소스 (naver-news, youtube 등)
    author: string | null; // 작성자
    likeCount: number | null; // 좋아요 수
    dislikeCount: number | null; // 싫어요 수
    publishedAt: Date | null; // 작성일
  }>;

  dateRange: { start: Date; end: Date }; // 분석 기간
  domain?: AnalysisDomain; // 분석 도메인 (political, fandom 등)
}
```

### 2.2 토큰 최적화 전략

AI API 비용과 Context Rot(긴 입력에서 후반부 무시 현상)을 방지하기 위해 데이터를 제한합니다:

| 데이터        | 제한                | 이유                                  |
| ------------- | ------------------- | ------------------------------------- |
| **기사 본문** | 500자까지만         | 제목 + 앞부분이 핵심 정보 포함        |
| **댓글**      | 좋아요순 상위 500개 | 많이 공감받은 댓글이 여론 대표성 높음 |
| **영상**      | 전체 포함 (메타만)  | 메타데이터만이라 토큰 소비 적음       |

```typescript
// 기사 본문 자르기
content: a.content ? a.content.slice(0, 500) : null,

// 댓글 좋아요순 정렬 + 500개 제한
.orderBy(desc(comments.likeCount))
.limit(500)
```

### 2.3 데이터 로드 경로

DB의 N:M 조인 테이블을 통해 특정 작업(job)에 연결된 데이터만 로드합니다:

```
collection_jobs (작업)
  ├── article_jobs (N:M) ── articles (기사)
  ├── video_jobs   (N:M) ── videos   (영상)
  └── comment_jobs (N:M) ── comments (댓글)
```

---

## 3. Stage 0: 개별 감정 분석

**파일**: `packages/core/src/analysis/item-analyzer.ts`

Stage 0은 LLM을 사용하지 않고 **경량 BERT 모델**(@xenova/transformers)로 기사·댓글 각각의 감정을 분류합니다.

### 3.1 처리 방식

```
기사 제목 + 본문 앞 150자 → BERT → positive/negative/neutral + 신뢰도 점수
댓글 본문               → BERT → positive/negative/neutral + 신뢰도 점수
```

### 3.2 왜 LLM이 아닌 BERT를 사용하는가?

| 비교 항목  | 경량 BERT              | LLM (Claude/Gemini) |
| ---------- | ---------------------- | ------------------- |
| **비용**   | 무료 (로컬 실행)       | 토큰당 과금         |
| **속도**   | 수백 개를 수초 내 처리 | 수백 개면 수십 분   |
| **정확도** | 단순 감정 분류에 충분  | 과잉 사양           |
| **용도**   | 개별 아이템 태깅       | 종합 분석·추론      |

### 3.3 결과 활용

- 각 기사/댓글의 `sentiment` 컬럼에 직접 UPDATE
- Stage 1의 `sentiment-framing` 모듈이 이 결과를 사전 통계로 활용
- 대시보드 UI에서 감정별 필터링에 사용

---

## 4. Stage 1~3: LLM 기반 여론 분석

### 4.1 Stage 구조와 실행 순서

```
Stage 1 (병렬, 독립)
  ┌─ macro-view ─────── 여론 구조 (타임라인, 변곡점)
  ├─ segmentation ───── 집단 분류 (Core/Opposition/Swing)
  ├─ sentiment-framing ─ 감정 비율 + 프레임 분석
  └─ message-impact ─── 메시지 성패 (확산/실패 패턴)
       │
       │ ← Stage 1 전체 완료 대기 (Gate)
       ▼
Stage 2 (부분 순차)
  ┌─ risk-map ────── 리스크 분석   ─┐ (병렬)
  ├─ opportunity ─── 기회 분석     ─┘
  │      │
  │      │ ← risk-map + opportunity 완료 대기
  │      ▼
  └─ strategy ────── 종합 전략 도출 (순차)
       │
       │ ← Stage 2 전체 완료 대기 (Gate)
       ▼
Stage 3 (순차)
  └─ final-summary ── 전체 결과 통합 요약
```

### 4.2 각 모듈의 역할

#### macro-view (전체 여론 구조 분석)

| 항목     | 값                                                                |
| -------- | ----------------------------------------------------------------- |
| **목적** | 시간축 기반 여론 흐름 파악, 변곡점 포착                           |
| **입력** | 기사 제목+본문, 영상 메타, 댓글 (+ 날짜별 언급량 사전 집계)       |
| **출력** | 전체 방향(positive/negative/mixed), 타임라인, 변곡점, 일별 트렌드 |
| **모델** | Gemini 2.5 Flash (속도·비용 우선)                                 |

#### segmentation (집단 분류)

| 항목     | 값                                                    |
| -------- | ----------------------------------------------------- |
| **목적** | 여론 참여자를 집단으로 분류                           |
| **입력** | 댓글 내용 + 플랫폼 정보                               |
| **출력** | 집단별 특성 (Core/Opposition/Swing), 영향력 높은 집단 |
| **모델** | Gemini 2.5 Flash                                      |

#### sentiment-framing (감정·프레임 분석)

| 항목     | 값                                                    |
| -------- | ----------------------------------------------------- |
| **목적** | 감정 비율 산출 + 여론을 지배하는 프레임(해석 틀) 도출 |
| **입력** | 기사 제목, 댓글 내용                                  |
| **출력** | 감정 비율, 긍정/부정 프레임 목록, 프레임 충돌 강도    |
| **모델** | Gemini 2.5 Flash                                      |

#### message-impact (메시지 영향도 분석)

| 항목     | 값                                               |
| -------- | ------------------------------------------------ |
| **목적** | 어떤 메시지가 확산됐고 어떤 것이 실패했는지 분석 |
| **입력** | 기사 + 댓글 (좋아요·공유 지표 포함)              |
| **출력** | 성공/실패 메시지 목록, 확산력 높은 콘텐츠 유형   |
| **모델** | Gemini 2.5 Flash                                 |

#### risk-map (리스크 맵)

| 항목     | 값                                                               |
| -------- | ---------------------------------------------------------------- |
| **목적** | 잠재 리스크와 폭발 가능성 도출                                   |
| **입력** | 원본 데이터 + **Stage 1 부정 신호** (Context Distillation)       |
| **출력** | Top 3~5 리스크 (영향도, 확산확률, 트리거 조건), 전체 리스크 수준 |
| **모델** | Claude Sonnet 4.6 (복합 추론 필요)                               |

#### opportunity (기회 분석)

| 항목     | 값                                                         |
| -------- | ---------------------------------------------------------- |
| **목적** | 여론에서 활용 가능한 기회 포착                             |
| **입력** | 원본 데이터 + **Stage 1 긍정 신호** (Context Distillation) |
| **출력** | 긍정 자산 목록, 우선순위 기회, 활용 방법                   |
| **모델** | Claude Sonnet 4.6                                          |

#### strategy (종합 전략)

| 항목     | 값                                                                    |
| -------- | --------------------------------------------------------------------- |
| **목적** | 실행 가능한 구체적 전략 수립                                          |
| **입력** | **Stage 1 전체 + risk-map + opportunity** 결과 (Context Distillation) |
| **출력** | 타겟 전략, 메시지 전략, 콘텐츠 전략, 리스크 대응(24h/1주/비상)        |
| **모델** | Claude Sonnet 4.6                                                     |

#### final-summary (최종 요약)

| 항목     | 값                                                 |
| -------- | -------------------------------------------------- |
| **목적** | 모든 분석 결과를 경영진/의사결정자용으로 통합 요약 |
| **입력** | Stage 1~2 전체 결과                                |
| **출력** | 핵심 요약, 주요 발견, 권장 행동                    |
| **모델** | Claude Sonnet 4.6                                  |

---

## 5. 프롬프트 설계 전략

### 5.1 프롬프트 4계층 구조

모든 분석 모듈의 프롬프트는 4개 계층으로 구성됩니다:

```
┌────────────────────────────────────────────┐
│ 계층 1: 도메인 플랫폼 지식                    │
│  "네이버 = 40~60대 보수, DC = 밈화/풍자"       │
├────────────────────────────────────────────┤
│ 계층 2: 모듈별 역할 (System Prompt)           │
│  "당신은 15년 경력의 정치 여론 분석가입니다"      │
├────────────────────────────────────────────┤
│ 계층 3: 도메인별 오버라이드                    │
│  정치 도메인 ≠ 스포츠 도메인 ≠ PR 도메인        │
├────────────────────────────────────────────┤
│ 계층 4: 공통 분석 제약 (ANALYSIS_CONSTRAINTS)  │
│  중간값 편향 금지, 패딩 금지, 균형 편향 금지       │
└────────────────────────────────────────────┘
```

### 5.2 System Prompt 구성

각 모듈의 `buildSystemPrompt(domain?)` 함수가 위 4계층을 조합합니다:

```typescript
buildSystemPrompt(domain?: AnalysisDomain): string {
  // 1. 도메인별 오버라이드 확인
  const override = buildModuleSystemPrompt('macro-view', domain);
  if (override) {
    return `${override}\n${getPlatformKnowledge(domain)}\n${ANALYSIS_CONSTRAINTS}`;
  }

  // 2. 기본 시스템 프롬프트 (역할 + 전문역량 + 플랫폼 지식 + 제약)
  return `당신은 15년 경력의 정치 여론 동향 분석가입니다.
한국 온라인 여론 데이터를 종합하여 시간축 기반 여론 구조를 파악합니다.

## 전문 역량
- 일별/주별 여론 흐름의 변곡점 정확 포착
- 이벤트-반응 간 인과관계 추론
- 플랫폼별 데이터 편향 보정
- 구조적 흐름을 서사로 구성

${getPlatformKnowledge(domain)}
${ANALYSIS_CONSTRAINTS}`;
}
```

### 5.3 플랫폼 지식 (platformKnowledge)

AI가 한국 온라인 여론의 플랫폼별 특성을 이해하도록 주입합니다:

| 플랫폼          | 주 사용층      | 정치 편향   | 분석 시 유의점                             |
| --------------- | -------------- | ----------- | ------------------------------------------ |
| **네이버 뉴스** | 40~60대        | 보수 우세   | 댓글 좋아요 수가 여론 대표성의 핵심 지표   |
| **유튜브**      | 전 연령        | 채널별 극심 | 조회수보다 댓글 내용이 더 정확한 감정 지표 |
| **DC인사이드**  | 20~30대 남성   | 이슈별 상이 | 풍자·비꼼이 많아 표면 감정 ≠ 실제 의도     |
| **클리앙**      | 30~40대 IT직종 | 진보 우세   | IT·경제 이슈에 전문성 높음                 |
| **FM코리아**    | 20~30대 남성   | 다양        | 유머 → 정치 전환 속도 매우 빠름            |

이 정보는 **모든 모듈의 System Prompt에 공통 삽입**되어, AI가 DC인사이드의 풍자적 댓글을 글자 그대로 해석하는 오류를 방지합니다.

### 5.4 분석 제약 (ANALYSIS_CONSTRAINTS)

AI의 흔한 편향을 명시적으로 금지합니다:

```
## 분석 제약 (반드시 준수)

1. **중간값 편향 금지**: 데이터가 극단적이면 극단적 점수 부여.
   모든 점수를 5~6에 몰지 마세요.

2. **균형 편향 금지**: 인위적으로 긍정/부정을 반반 나누지 마세요.
   데이터가 90% 부정이면 부정 90%로 보고하세요.

3. **패딩 금지**: 의미 있는 차이가 있는 항목만 나열.
   채우기용 항목을 추가하지 마세요.

4. **근거 없는 추측 금지**: 데이터에 없는 내용을 추론하지 마세요.

5. **선행 결과 재기술 금지**: Stage 1 결과를 그대로 반복하지 말고,
   새로운 관점에서 재해석하세요.
```

### 5.5 User Prompt (데이터 + 분석 지시)

각 모듈의 `buildPrompt(data)` 함수가 데이터를 포맷팅하고 단계별 분석 절차를 지시합니다:

```typescript
// macro-view 모듈의 User Prompt 구조

## 분석 대상: "윤석열"
## 분석 기간: 2026-04-01 ~ 2026-04-15

### 뉴스 기사 (120건 중 상위 20건)
1. [2026-04-01][조선일보] 제목... 본문(500자)...
2. [2026-04-02][한겨레] 제목... 본문(500자)...
...

### 영상 (15건)
1. [2026-04-01][채널A] 제목 (조회수: 150000, 좋아요: 5000)
...

### 댓글 (500건 중 상위 30건)
1. [2026-04-01][naver-news] 댓글내용... (좋아요: 1200)
...

## 날짜별 언급량 (사전 집계 — AI가 직접 세지 않음!)
[
  {"date": "2026-04-01", "count": 23},
  {"date": "2026-04-02", "count": 45},
  ...
]

## 분석 절차 (반드시 이 순서로)

### Step 1: 이벤트-반응 매핑
- 언급량이 급증(전일 대비 2배+)한 날짜의 원인 기사·발언 식별
- "이벤트 → 플랫폼별 반응 → 후속 영향"의 인과 체인 구성

### Step 2: 변곡점 식별
- 여론이 긍정→부정, 또는 부정→긍정으로 전환된 지점
- 전환 계기가 된 구체적 사건/메시지 명시

### Step 3: 결과 출력
- timeline: 주요 이벤트 시간순 정렬
- inflectionPoints: 변곡점 배열
- dailyMentionTrend: 사전집계 count 활용하여 sentimentRatio 보충
```

### 5.6 사전 계산 전략

AI에게 "댓글 500개를 세어라"라고 하지 않고, **미리 계산된 통계를 제공**합니다:

| 사전 계산 항목 | 이유                                            |
| -------------- | ----------------------------------------------- |
| 날짜별 언급량  | AI가 500개 댓글을 세는 것은 비효율적이고 부정확 |
| 데이터 건수    | "120건 중 상위 20건"으로 샘플 크기 명시         |
| 좋아요 순위    | 이미 정렬된 데이터 제공                         |

---

## 6. Zod 스키마: AI 응답 구조화

### 6.1 구조화된 출력이란?

AI에게 자유 형식 텍스트 대신 **정해진 JSON 구조**로 응답하도록 합니다. Vercel AI SDK의 `generateObject()` 또는 프로바이더의 Structured Output API를 사용합니다.

```
[기존 방식]
AI → "여론은 대체로 부정적이며..." (자유 텍스트) → 파싱 어려움

[구조화 방식]
AI → { overallDirection: "negative", summary: "...", ... } (JSON) → 즉시 활용 가능
```

### 6.2 Zod 스키마의 역할

```
1. AI에게 응답 형식 알려줌 → Prompt에 스키마 구조 자동 삽입
2. AI 응답을 런타임 검증   → 필드 누락/타입 오류 감지
3. TypeScript 타입 생성    → 컴파일 타임 안전성
4. 파싱 실패 시 기본값     → .catch()로 분석 중단 방지
```

### 6.3 대표 스키마: MacroView

**파일**: `packages/core/src/analysis/schemas/macro-view.schema.ts`

```typescript
export const MacroViewSchema = z.object({
  // 전체 여론 방향
  overallDirection: z.enum(['positive', 'negative', 'mixed']).describe('전체 여론 방향성'),

  // 핵심 요약
  summary: z.string().min(1).describe('핵심 흐름 요약 3~5줄'),

  // 주요 이벤트 타임라인
  timeline: z
    .array(
      z.object({
        date: z.string().catch(''),
        event: z.string().catch(''),
        impact: z.enum(['positive', 'negative', 'neutral', 'mixed']).catch('neutral'),
        description: z.string().catch(''),
      }),
    )
    .default([]),

  // 여론 변곡점
  inflectionPoints: z
    .array(
      z.object({
        date: z.string().catch(''),
        description: z.string().catch(''),
        beforeSentiment: z.enum(['positive', 'negative', 'neutral']).catch('neutral'),
        afterSentiment: z.enum(['positive', 'negative', 'neutral']).catch('neutral'),
      }),
    )
    .default([]),

  // 일별 언급량 + 감성 추이
  dailyMentionTrend: z
    .array(
      z.object({
        date: z.string().catch(''),
        count: z.number().catch(0),
        sentimentRatio: z
          .object({
            positive: z.number().catch(0),
            negative: z.number().catch(0),
            neutral: z.number().catch(0),
          })
          .catch({ positive: 0, negative: 0, neutral: 0 }),
      }),
    )
    .default([]),
});

// TypeScript 타입 자동 추론
export type MacroViewResult = z.infer<typeof MacroViewSchema>;
```

### 6.4 대표 스키마: RiskMap

```typescript
export const RiskMapSchema = z.object({
  topRisks: z
    .array(
      z.object({
        rank: z.number().catch(0),
        title: z.string().catch(''),
        description: z.string().catch(''),
        impactLevel: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
        spreadProbability: z.number().catch(0), // 0~1
        currentStatus: z.string().catch(''),
        triggerConditions: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  overallRiskLevel: z.enum(['critical', 'high', 'medium', 'low']),

  riskTrend: z.enum(['increasing', 'stable', 'decreasing']),
});
```

### 6.5 대표 스키마: Strategy

```typescript
export const StrategySchema = z.object({
  targetStrategy: z.object({
    primaryTarget: z.string().catch(''), // 주요 타겟 집단
    secondaryTargets: z.array(z.string()).default([]),
    approach: z.string().catch(''), // 접근 방법
  }),

  messageStrategy: z.object({
    coreMessage: z.string().catch(''), // 핵심 메시지 (15자 이내)
    supportingMessages: z.array(z.string()).default([]),
    toneAndManner: z.string().catch(''), // 톤앤매너
  }),

  contentStrategy: z.object({
    recommendedFormats: z.array(z.string()).default([]), // 권장 콘텐츠 형식
    keyTopics: z.array(z.string()).default([]), // 핵심 주제
    distributionChannels: z.array(z.string()).default([]), // 유통 채널
  }),

  riskResponse: z.object({
    immediateActions: z.array(z.string()).default([]), // 24시간 내
    preventiveActions: z.array(z.string()).default([]), // 1주 내
    contingencyPlan: z.string().catch(''), // 비상계획
  }),
});
```

### 6.6 안전성 기법: .catch()와 .default()

AI가 특정 필드를 생성하지 못해도 **분석 전체가 중단되지 않도록** 합니다:

```typescript
// .catch('') — 파싱 실패 시 빈 문자열 반환
title: z.string().catch('')

// .default([]) — 필드 누락 시 빈 배열 반환
timeline: z.array(...).default([])

// .catch({...}) — 중첩 객체 파싱 실패 시 기본 객체 반환
sentimentRatio: z.object({
  positive: z.number().catch(0),
  negative: z.number().catch(0),
  neutral: z.number().catch(0),
}).catch({ positive: 0, negative: 0, neutral: 0 })
```

---

## 7. Map-Reduce: 대량 데이터 분할 분석

### 7.1 왜 Map-Reduce가 필요한가?

| 문제            | 원인                               | 해결                             |
| --------------- | ---------------------------------- | -------------------------------- |
| **Context Rot** | AI가 긴 입력의 후반부를 무시       | 데이터를 작은 청크로 분할        |
| **Rate Limit**  | 대량 토큰 한 번에 전송 시 429 에러 | 청크별 독립 요청 + 재시도        |
| **비용 폭증**   | 59K+ 토큰 입력 시 비용 급등        | 청크당 15K자 제한                |
| **정확도 저하** | 너무 많은 데이터에서 핵심 놓침     | 분할 분석 → 종합으로 정확도 향상 |

### 7.2 청킹 전략

**파일**: `packages/core/src/analysis/map-reduce.ts`

```
총 데이터 크기 계산 (estimateChars)
  │
  ├─ 20,000자 미만 → 단일 패스 (청크 1개, Map-Reduce 생략)
  │
  └─ 20,000자 이상 → 청크 분할
       │
       ├─ 청크 수 = max(2, ceil(총문자수 / 15,000))
       │
       └─ 라운드로빈 분배
           기사:  [A1,A4,A7...] [A2,A5,A8...] [A3,A6,A9...]
           댓글:  [C1,C4,C7...] [C2,C5,C8...] [C3,C6,C9...]
           영상:  [V1,V4...]    [V2,V5...]    [V3,V6...]
```

### 7.3 실행 흐름

```
               ┌─────────┐
               │ 원본 데이터│
               └────┬────┘
                    │ chunkAnalysisInput()
         ┌─────────┼─────────┐
         ▼         ▼         ▼
    ┌────────┐┌────────┐┌────────┐
    │ 청크 1  ││ 청크 2  ││ 청크 3  │
    └───┬────┘└───┬────┘└───┬────┘
        │         │         │
        ▼         ▼         ▼        ← MAP 단계
    ┌────────┐┌────────┐┌────────┐     (프로바이더별 동시성 제한)
    │ AI 분석 ││ AI 분석 ││ AI 분석 │     (callWithRetry: Rate Limit 재시도)
    └───┬────┘└───┬────┘└───┬────┘
        │         │         │
        ▼         ▼         ▼
    ┌────────┐┌────────┐┌────────┐
    │ 결과 1  ││ 결과 2  ││ 결과 3  │
    └───┬────┘└───┬────┘└───┬────┘
        │         │         │
        └─────────┼─────────┘
                  │ buildReducePrompt()
                  ▼                  ← REDUCE 단계
            ┌──────────┐              (종합 분석)
            │ AI 종합   │
            └────┬─────┘
                 ▼
            ┌──────────┐
            │ 최종 결과  │
            └──────────┘
```

### 7.4 Reduce 프롬프트

Map 단계의 결과들을 종합할 때 AI에게 구체적인 절차를 지시합니다:

```
당신은 여론 분석 결과를 종합하는 전문가입니다.
"윤석열"에 대한 "전체 여론 구조 분석"이 3개 청크로 수행되었습니다.

## 종합 절차 (반드시 이 순서로)

### Step 1: 배열 항목 병합
- 동일한 의미 항목 중복 제거
- 서로 다른 관점 항목은 모두 유지

### Step 2: 수치 통합
- 감정 비율 → 청크별 데이터 건수 가중 평균
- 점수 → 동일 항목 평균
- 빈도 → 합산

### Step 3: 서사 재구성
- 단순 연결이 아닌 인과적 서사 재작성
- 방향성은 통합 수치 기반으로 재판단

### Step 4: 품질 검증
- 빈 배열/누락 필드 확인
- 모든 청크의 인사이트가 반영되었는지 확인

## 청크별 결과
### 청크 1/3
{ ... JSON ... }

### 청크 2/3
{ ... JSON ... }

### 청크 3/3
{ ... JSON ... }
```

### 7.5 취소 처리

Map-Reduce 실행 중에도 사용자가 분석을 취소할 수 있습니다:

```
Map 배치 시작 전 → isPipelineCancelled() 확인
각 배치 완료 후  → 취소 확인
Reduce 시작 전   → 취소 확인
API 호출 중      → AbortSignal로 즉시 중단
```

---

## 8. Context Distillation: Stage 간 데이터 전달

### 8.1 문제: Stage 2는 Stage 1 결과가 필요하다

Stage 2의 risk-map은 "어떤 부정 프레임이 있는지" 알아야 리스크를 판단할 수 있습니다. 하지만 Stage 1의 전체 결과를 그대로 넣으면:

- 토큰 낭비 (불필요한 필드까지 포함)
- Context Rot (핵심 정보가 묻힘)
- 비용 증가

### 8.2 해결: 선별 추출 (Distillation)

**파일**: `packages/core/src/analysis/modules/context-distillation.ts`

각 Stage 2~3 모듈에 **필요한 필드만** 추출하여 프롬프트에 주입합니다:

```
Stage 1 전체 결과 (수십 KB)
      │
      ├─ distillForRiskMap()      → 부정 신호만 추출 (수 KB)
      │   ├─ macro-view: overallDirection, summary, inflectionPoints
      │   ├─ segmentation: audienceGroups, highInfluenceGroup
      │   ├─ sentiment-framing: sentimentRatio, negativeFrames, frameConflict
      │   └─ message-impact: failureMessages, highSpreadContentTypes
      │
      ├─ distillForOpportunity()  → 긍정 신호만 추출 (수 KB)
      │   ├─ macro-view: overallDirection, summary
      │   ├─ segmentation: audienceGroups, highInfluenceGroup
      │   ├─ sentiment-framing: sentimentRatio, positiveFrames
      │   └─ message-impact: successMessages, highSpreadContentTypes
      │
      └─ distillForStrategy()     → 전체 핵심 추출 (수 KB)
          ├─ Stage 1: macro-view + segmentation + sentiment + impact
          ├─ Stage 2a: risk-map 결과
          └─ Stage 2a: opportunity 결과
```

### 8.3 프롬프트 주입 방식

Stage 2 모듈의 `buildPromptWithContext()` 함수가 distilled 컨텍스트를 프롬프트 상단에 삽입합니다:

```
## Stage 1 종합 분석 결과 요약          ← distilled 컨텍스트

### 여론 흐름 요약 (macro-view)
{ overallDirection: "negative", summary: "...", inflectionPoints: [...] }

### 부정 감정·프레임 (sentiment-framing)
{ sentimentRatio: {positive: 0.2, negative: 0.7, ...}, negativeFrames: [...] }

### 실패 메시지·확산 유형 (message-impact)
{ failureMessages: [...], highSpreadContentTypes: [...] }

---

## 본 단계 분석 입력                    ← 원본 데이터

키워드: "윤석열"
...기사, 댓글 데이터...
```

### 8.4 각 모듈이 추출하는 필드

| 모듈            | macro-view에서                       | segmentation에서      | sentiment-framing에서     | message-impact에서               |
| --------------- | ------------------------------------ | --------------------- | ------------------------- | -------------------------------- |
| **risk-map**    | direction, summary, inflectionPoints | groups, highInfluence | ratio, **negativeFrames** | **failureMessages**, spreadTypes |
| **opportunity** | direction, summary                   | groups, highInfluence | ratio, **positiveFrames** | **successMessages**, spreadTypes |
| **strategy**    | 전체                                 | 전체                  | 전체                      | 전체 + risk-map + opportunity    |

---

## 9. 도메인 커스터마이제이션

### 9.1 12개 지원 도메인

| 도메인          | 설명               | Stage 4 모듈 예시                                                     |
| --------------- | ------------------ | --------------------------------------------------------------------- |
| `political`     | 정치/여론 (기본)   | approval-rating, frame-war, crisis-scenario, win-simulation           |
| `fandom`        | 팬덤 (연예인/작품) | fan-loyalty-index, fandom-narrative-war, release-reception-prediction |
| `pr`            | PR/위기관리        | crisis-type-classifier, reputation-index, stakeholder-map             |
| `corporate`     | 기업 평판          | esg-sentiment, brand-trust-index                                      |
| `finance`       | 금융/투자          | market-sentiment-index, information-asymmetry, catalyst-scenario      |
| `sports`        | 스포츠             | performance-narrative, season-outlook-prediction                      |
| `healthcare`    | 의료/건강          | health-risk-assessment, treatment-sentiment                           |
| `education`     | 교육               | education-policy-impact, school-reputation                            |
| `policy`        | 정책/공공          | policy-acceptance, stakeholder-resistance                             |
| `public-sector` | 공공기관           | public-trust-index, service-satisfaction                              |
| `legal`         | 법률               | legal-risk-assessment, precedent-impact                               |
| `retail`        | 소매/유통          | consumer-sentiment, brand-competition                                 |

### 9.2 도메인별 커스터마이제이션 항목

**파일**: `packages/core/src/analysis/domain/`

각 도메인은 `DomainConfig` 인터페이스를 구현합니다:

```typescript
interface DomainConfig {
  id: AnalysisDomain;
  displayName: string;

  // 1. 플랫폼 지식 (모든 모듈 System Prompt에 공통 삽입)
  platformKnowledge: string;

  // 2. 점수 기준 앵커 (도메인마다 1~10 기준이 다름)
  impactScoreAnchor: string; // 예: 정치 10점 = "대통령급 스캔들"
  frameStrengthAnchor: string; // 프레임 강도 0~100 기준
  probabilityAnchor: string; // 확률 판단 기준

  // 3. 집단 분류 라벨
  segmentationLabels: {
    types: string[]; // 예: ['core', 'opposition', 'swing']
    criteria: Record<string, string>;
  };

  // 4. 모듈별 System Prompt 오버라이드
  modulePrompts: Record<string, { systemPrompt?: string }>;

  // 5. Stage 4 모듈 구성
  stage4: {
    parallel: string[]; // 병렬 실행 모듈
    sequential: string[]; // 순차 실행 모듈
  };
}
```

### 9.3 도메인이 달라지면 무엇이 바뀌는가?

예: "윤석열" → `political` vs "BTS" → `fandom`

| 항목               | political                  | fandom                                  |
| ------------------ | -------------------------- | --------------------------------------- |
| **집단 분류**      | Core/Opposition/Swing      | 코어팬/라이트팬/안티/일반대중           |
| **impactScore 10** | 대통령급 스캔들            | 그룹 해체/멤버 탈퇴                     |
| **Stage 4 모듈**   | approval-rating, frame-war | fan-loyalty-index, fandom-narrative-war |
| **System Prompt**  | "정치 여론 분석가"         | "팬덤 문화 전문가"                      |
| **플랫폼 해석**    | DC=정치풍자                | DC=팬덤 밈                              |

---

## 10. AI 모델 선정 및 프로바이더 통합

### 10.1 기본 모델 매핑

**파일**: `packages/core/src/analysis/runner.ts` → `MODULE_MODEL_MAP`

| Stage | 모듈              | 프로바이더 | 모델              | 선택 이유                      |
| ----- | ----------------- | ---------- | ----------------- | ------------------------------ |
| 1     | macro-view        | Gemini     | gemini-2.5-flash  | 속도·비용 우선, 단순 구조 분석 |
| 1     | segmentation      | Gemini     | gemini-2.5-flash  | 분류 작업에 충분               |
| 1     | sentiment-framing | Gemini     | gemini-2.5-flash  | 감정 분석은 Flash로 충분       |
| 1     | message-impact    | Gemini     | gemini-2.5-flash  | 패턴 매칭 중심                 |
| 2     | risk-map          | Anthropic  | claude-sonnet-4-6 | 복합 추론 필요                 |
| 2     | opportunity       | Anthropic  | claude-sonnet-4-6 | 복합 추론 필요                 |
| 2     | strategy          | Anthropic  | claude-sonnet-4-6 | 전략 수립 = 고급 추론          |
| 3     | final-summary     | Anthropic  | claude-sonnet-4-6 | 통합 요약 = 고급 추론          |

### 10.2 시나리오 프리셋

비용·품질 트레이드오프에 따라 7가지 프리셋을 제공합니다:

| 시나리오                     | Stage 1 모델      | Stage 2+ 모델   | 1회 비용 | 특징             |
| ---------------------------- | ----------------- | --------------- | -------- | ---------------- |
| **A: 최고 품질**             | Gemini 2.5 Pro    | Claude Opus 4.6 | ~$0.80   | 최고 정확도      |
| **B: 가성비 최적**           | Gemini Flash      | Haiku + Sonnet  | ~$0.20   | 기본 설정        |
| **C: Claude 전용**           | Haiku 4.5         | Sonnet 4.6      | ~$0.35   | Anthropic만 사용 |
| **D: Gemini CLI 하이브리드** | Gemini CLI (무료) | Sonnet 4.6      | ~$0.12   | Stage 1 무료     |
| **E: 완전 무료**             | Gemini CLI        | Gemini CLI      | $0.00    | 일일 쿼터 제한   |
| **F: OpenRouter**            | DeepSeek V3       | Sonnet 4.6      | ~$0.15   | 대안 프로바이더  |
| **G: 초절약**                | DeepSeek V4       | DeepSeek V4     | ~$0.05   | 최저 비용        |

### 10.3 프로바이더 통합 계층

```
분석 모듈
  ↓ runModule(module, input, priorResults, configAdapter)

ModelConfigAdapter (프리셋 인식)
  ↓ resolve(moduleName) → { provider, model, baseUrl, apiKey }

설정 우선순위:
  ① presetModelSettings (프리셋별 오버라이드)
  ② modelSettings (관리자 커스텀)
  ③ MODULE_MODEL_MAP (기본값)

ProviderKey 관리
  ↓ getProviderKeyInfo(providerType, targetModel?)

AI Gateway (packages/ai-gateway)
  ↓ analyzeStructured(prompt, schema, options)

Vercel AI SDK v6
  ↓ generateObject()

Claude API / Gemini API / OpenAI API / OpenRouter API
```

### 10.4 AI Gateway 호출

**파일**: `packages/ai-gateway/src/`

```typescript
async function analyzeStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: {
    provider: AIProvider; // 'anthropic' | 'gemini' | 'openai' | 'openrouter'
    model: string; // 'claude-sonnet-4-6'
    systemPrompt?: string; // System Prompt
    baseUrl?: string; // 프록시/LM Studio용
    apiKey?: string; // API 키
    maxOutputTokens?: number; // 최대 출력 토큰 (기본 8192)
    timeoutMs?: number; // 타임아웃
    abortSignal?: AbortSignal; // 취소 신호
  },
): Promise<{ object: T; usage: TokenUsage }>;
```

내부적으로 Vercel AI SDK의 `generateObject()`를 호출하며, 프로바이더별 SDK를 자동 선택합니다:

- Anthropic → `@ai-sdk/anthropic`
- Google → `@ai-sdk/google`
- OpenAI → `@ai-sdk/openai`
- OpenRouter → `@ai-sdk/openai` (baseUrl 변경)

---

## 11. 비용 최적화 및 성능

### 11.1 1회 분석 비용 추정 (시나리오 B 기준)

| Stage    | 모듈              | 입력 토큰 | 출력 토큰 | 모델          | 비용       |
| -------- | ----------------- | --------- | --------- | ------------- | ---------- |
| 1        | macro-view        | ~12K      | ~2K       | Gemini Flash  | ~$0.012    |
| 1        | segmentation      | ~12K      | ~1.5K     | Gemini Flash  | ~$0.009    |
| 1        | sentiment-framing | ~12K      | ~1.5K     | Gemini Flash  | ~$0.009    |
| 1        | message-impact    | ~12K      | ~1.5K     | Gemini Flash  | ~$0.009    |
| 2        | risk-map          | ~15K      | ~2K       | Claude Sonnet | ~$0.039    |
| 2        | opportunity       | ~15K      | ~1.5K     | Claude Sonnet | ~$0.036    |
| 2        | strategy          | ~15K      | ~2K       | Claude Sonnet | ~$0.039    |
| 3        | final-summary     | ~8K       | ~1K       | Claude Sonnet | ~$0.020    |
| **합계** |                   |           |           |               | **~$0.17** |

※ Stage 4 모듈 추가 시 ~$0.05~0.15 추가

### 11.2 소요 시간 추정

| 단계     | 작업                                    | 예상 시간  |
| -------- | --------------------------------------- | ---------- |
| 수집     | 네이버+YouTube+커뮤니티                 | 1~3분      |
| 정규화   | 댓글 병렬 수집                          | 2~5분      |
| 저장     | DB + 임베딩                             | 30~60초    |
| Stage 0  | 개별 감정분석 (BERT)                    | 10~20초    |
| Stage 1  | 4개 모듈 병렬                           | 30~45초    |
| Stage 2  | risk+opportunity(병렬) + strategy(순차) | 45~60초    |
| Stage 3  | final-summary                           | 20~30초    |
| Stage 4  | 도메인별 (예: 4개 모듈)                 | 45~60초    |
| 리포트   | 통합 리포트 작성                        | 15~20초    |
| **전체** |                                         | **6~15분** |

### 11.3 비용 절감 기법 요약

| 기법                           | 절감 효과                      | 적용 위치               |
| ------------------------------ | ------------------------------ | ----------------------- |
| **기사 본문 500자 제한**       | 토큰 60~70% 절감               | data-loader.ts          |
| **댓글 500개 제한 (좋아요순)** | 토큰 50~80% 절감               | data-loader.ts          |
| **날짜별 언급량 사전 집계**    | AI 계산 오류 방지 + 토큰 절약  | buildPrompt()           |
| **Map-Reduce 청킹**            | Context Rot 방지 + 정확도 향상 | map-reduce.ts           |
| **Context Distillation**       | Stage 간 전달 토큰 70% 절감    | context-distillation.ts |
| **Stage별 모델 분리**          | Stage 1은 저가 모델 사용       | MODULE_MODEL_MAP        |
| **시나리오 프리셋**            | 용도에 맞는 비용 선택          | model-config.ts         |

---

## 12. 오류 처리 및 신뢰성

### 12.1 Rate Limit 재시도

```typescript
callWithRetry(fn, label, jobId):

  Rate Limit (429) →
    최대 3회 재시도
    대기 시간: max(retryAfter, 시도횟수 × 3초)
    토큰 비용 미발생

  서버 과부하 (503) →
    최대 1회 재시도
    대기 시간: 15초

  타임아웃 →
    최대 1회 재시도
    대기 시간: 10초

  기타 에러 → 즉시 전파
```

### 12.2 부분 실패 처리

- 개별 모듈 실패 → `status: 'failed'`로 DB 기록, 나머지 계속 진행
- Map-Reduce 청크 일부 실패 → 성공한 청크만으로 Reduce 진행
- 전체 청크 실패 → 해당 모듈만 실패 처리
- 작업 최종 상태: 하나라도 실패 시 `partial_failure`

### 12.3 체크포인트 복원 (Resume)

실패한 분석을 처음부터 다시 하지 않고, **완료된 모듈은 건너뛰고** 실패한 모듈만 재실행할 수 있습니다:

```typescript
// 특정 모듈만 재실행
await runAnalysisPipeline(jobId, {
  retryModules: ['risk-map', 'strategy'],
});

// DB 결과만 가지고 리포트 재생성
await runAnalysisPipeline(jobId, {
  reportOnly: true,
});
```

### 12.4 취소 게이트 (Gate Checkpoint)

사용자가 분석 중 취소할 수 있는 체크포인트가 7곳에 있습니다:

```
① token-optimization 완료 후
② item-analysis 완료 후
③ analysis-stage1 완료 후
④ analysis-stage2 (병렬 모듈 후)
⑤ analysis-stage2 (strategy 후)
⑥ analysis-stage4 (Stage 4 완료 후)
⑦ Map-Reduce 배치 간 (Map 배치 시작 전마다)
```

### 12.5 Lock 갱신 (장시간 작업 보호)

BullMQ 워커는 기본 10분 lock timeout을 가집니다. 분석이 10분을 넘길 수 있으므로, 2분마다 lock을 10분 연장합니다:

```typescript
const lockExtender = setInterval(async () => {
  await job.extendLock(job.token!, 600_000); // 10분 연장
}, 120_000); // 2분마다
```

Lock 갱신 실패 시(네트워크 순단 등), 다른 워커가 동일 작업을 중복 처리하는 것을 감지하고 결과를 무시합니다.

---

## 부록: 주요 파일 경로

| 파일                                                         | 역할                                    |
| ------------------------------------------------------------ | --------------------------------------- |
| `packages/core/src/analysis/pipeline-orchestrator.ts`        | Stage 0~4 관리, 게이트 체크             |
| `packages/core/src/analysis/runner.ts`                       | 모듈 실행 엔진, 모델 매핑               |
| `packages/core/src/analysis/map-reduce.ts`                   | 데이터 청킹, Map/Reduce 파이프라인      |
| `packages/core/src/analysis/data-loader.ts`                  | DB에서 분석 입력 데이터 로드            |
| `packages/core/src/analysis/modules/context-distillation.ts` | Stage 간 컨텍스트 선별 추출             |
| `packages/core/src/analysis/modules/*.ts`                    | 각 분석 모듈 (프롬프트 + 설정)          |
| `packages/core/src/analysis/schemas/*.schema.ts`             | Zod 스키마 (응답 타입 정의)             |
| `packages/core/src/analysis/domain/`                         | 12개 도메인 설정                        |
| `packages/core/src/analysis/item-analyzer.ts`                | 개별 감정 분석 (경량 BERT)              |
| `packages/ai-gateway/src/`                                   | AI 프로바이더 통합, analyzeStructured() |
| `packages/core/src/queue/analysis-worker.ts`                 | BullMQ 분석 워커                        |
| `packages/core/src/queue/flows.ts`                           | 수집/분석 Flow 트리거                   |
