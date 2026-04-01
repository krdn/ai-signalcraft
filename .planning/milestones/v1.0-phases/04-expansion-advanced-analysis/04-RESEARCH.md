# Phase 4: Expansion + Advanced Analysis - Research

**Researched:** 2026-03-24
**Domain:** 커뮤니티 웹 스크래핑 + AI 고급 분석 모듈
**Confidence:** MEDIUM-HIGH

## Summary

Phase 4는 두 축으로 구성된다. (1) DC갤러리/에펨코리아/클리앙 커뮤니티 수집기 3종 추가와 (2) AI 지지율 추정/프레임 전쟁/위기 시나리오/승리 시뮬레이션 4개 고급 분석 모듈 구현. X(트위터) 수집기(COLL-05)는 CONTEXT.md 결정에 따라 v2로 이월.

기존 코드베이스에 `Collector` 인터페이스, `AdapterRegistry`, 3단계 분석 파이프라인(`runner.ts`)이 이미 확립되어 있어 확장 패턴이 명확하다. 커뮤니티 수집기는 `NaverNewsCollector`와 동일한 Playwright + Cheerio 패턴을 따르며, 고급 분석 모듈은 `riskMapModule` 등 Stage 2 모듈 패턴을 그대로 확장한다. 대시보드는 5번째 탭("고급 분석")을 추가하고 4개 시각화 섹션을 배치한다.

**Primary recommendation:** 기존 CollectorAdapter/AnalysisModule 패턴을 100% 재사용하고, 커뮤니티 수집기는 사이트별 셀렉터/딜레이만 차별화. 고급 분석은 Stage 3(또는 Stage 4)으로 기존 파이프라인에 추가.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 4에서 X 수집기 제외. COLL-05(X 트윗/반응 수집기)는 v2 Requirements로 이월. 비용($200/월) 및 15,000건 제한으로 현 단계에서는 ROI 부족.
- **D-02:** 키워드 검색 + 인기 갤러리 자동 탐색. 트리거 시 키워드로 각 사이트 검색 후, 해당 키워드가 자주 등장하는 갤러리/게시판을 자동 추가 탐색.
- **D-03:** 기존 CollectorAdapter 패턴 재사용. DC갤러리/에펨코리아/클리앙 각각 독립 어댑터로 구현. 부분 실패 허용(Phase 1 D-04 계승).
- **D-04:** Claude 재량. 사이트별 특성(robots.txt, 요청 제한, 차단 패턴)에 맞게 딜레이/세션 관리 최적화.
- **D-05:** AI 지지율 추정의 면책 처리는 Claude 재량. 적절한 면책 문구와 신뢰도 표현 수준을 구현 시 결정.
- **D-06:** 위기 대응 시나리오는 3개 고정: 확산(worst), 통제(moderate), 역전(best). 각 시나리오에 발생 조건 + 대응 전략 포함.
- **D-07:** 4개 고급 분석 모듈 구조 (Phase 2 패턴 계승): ADVN-01~04.
- **D-08:** 기존 4탭 + "고급 분석" 전용 탭 추가 = 5탭 구성.
- **D-09:** 결과 대시보드의 플랫폼 비교 차트에 커뮤니티 소스(DC/에펨/클리앙) 자동 반영.
- **D-10:** AI 리포트에 고급 분석 섹션 자연 추가. 리포트 생성기가 ADVN 모듈 결과를 통합.

### Claude's Discretion

- 각 커뮤니티 사이트별 스크래핑 세부 구현 (셀렉터, 페이지네이션, 인코딩 등)
- 반봇 대응 딜레이/세션 전략 사이트별 최적화
- 고급 분석 모듈의 프롬프트 설계 및 Zod 스키마 구조
- AI 지지율 면책 문구 및 신뢰도 표현 수준
- 고급 분석 탭 내 시각화 컴포넌트 레이아웃 및 차트 유형 선택

### Deferred Ideas (OUT OF SCOPE)

- **X(트위터) 수집기** -- COLL-05. $200/월 비용 결정 보류. v2에서 Go/No-Go 재검토.
- **히스토리 비교 기능** -- Phase 3에서 이월. 과거 분석 결과 간 변화 비교 대시보드.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                              | Research Support                                                               |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| COLL-05 | X(트위터) 트윗 및 반응 수집기            | **DEFERRED to v2** per D-01. 플랜에 이월 사실만 명시                           |
| COLL-06 | DC갤러리 게시글/댓글 수집기 (스크래핑)   | Playwright+Cheerio 패턴, DC앱API 또는 웹 스크래핑, 갤러리 검색 URL 구조 확인됨 |
| COLL-07 | 에펨코리아 게시글/댓글 수집기 (스크래핑) | XE/Rhymix 기반 CMS, mid/act URL 패턴, 검색 파라미터 확인됨                     |
| COLL-08 | 클리앙 게시글/댓글 수집기 (스크래핑)     | /service/board/{board_id} 구조, 검색 URL 패턴, 403 보호 확인                   |
| ADVN-01 | AI 지지율 추정 모델                      | AnalysisModule 인터페이스 확장, Zod 스키마+프롬프트 패턴, 면책 처리 필요       |
| ADVN-02 | 프레임 전쟁 분석                         | sentiment-framing 모듈 확장, 지배적/위협/반전 가능 프레임 구조화               |
| ADVN-03 | 위기 대응 시나리오 생성                  | risk-map 결과 의존, 확산/통제/역전 3개 시나리오 고정 (D-06)                    |
| ADVN-04 | 승리 확률 및 전략 시뮬레이션             | 모든 선행 결과(Stage 1~3 + ADVN-01~03) 참조, 최종 단계 모듈                    |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **패키지 매니저**: pnpm 사용
- **보안**: API 키 하드코딩 금지, .env 파일 커밋 금지
- **커밋**: 한국어 커밋 메시지, feat/fix/docs 등 타입 영어 유지
- **FSD 아키텍처**: 해당 프로젝트에는 자체 monorepo 구조 사용 (FSD 미적용)
- **GSD Workflow**: Edit/Write 전 GSD 명령으로 작업 시작
- **Superpowers 호출 규칙**: brainstorming, TDD, debugging, code-review, verification 등 의무 호출

## Standard Stack

### Core (이미 설치됨 -- 추가 설치 불필요)

| Library    | Version | Purpose                | Why Standard                                                      |
| ---------- | ------- | ---------------------- | ----------------------------------------------------------------- |
| Playwright | 1.58.2  | 브라우저 기반 스크래핑 | 이미 네이버 수집기에서 사용 중. JS 렌더링, auto-wait, 한국 로케일 |
| Cheerio    | 1.2.0   | HTML 파싱              | 이미 사용 중. DOM 탐색/데이터 추출                                |
| Zod        | 3.x     | 스키마 검증            | 분석 모듈 Zod 스키마 패턴 확립됨                                  |
| AI SDK     | v4/v6   | AI 모델 호출           | analyzeStructured() 패턴 확립됨                                   |
| Vitest     | 3.2.4   | 테스트                 | 기존 테스트 인프라                                                |

### Supporting (추가 불필요)

기존 스택으로 모든 요구사항 충족 가능. 새 라이브러리 추가 없음.

### Alternatives Considered

| Instead of            | Could Use                    | Tradeoff                                                             |
| --------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Playwright (브라우저) | Axios+Cheerio (HTTP only)    | 커뮤니티 사이트들이 JS 렌더링/CloudFlare 보호 사용, Playwright 필수  |
| DC 웹 스크래핑        | DC 앱 API (app.dcinside.com) | 앱 API가 더 안정적이나 app_id 인증 필요, 비공식이라 변경 리스크 동일 |

## Architecture Patterns

### 수집기 확장 구조 (Canonical Pattern)

```
packages/collectors/src/
├── adapters/
│   ├── base.ts              # Collector 인터페이스 (기존)
│   ├── registry.ts           # AdapterRegistry (기존)
│   ├── naver-news.ts         # 참고 구현 (기존)
│   ├── dcinside.ts           # NEW: DC갤러리 수집기
│   ├── fmkorea.ts            # NEW: 에펨코리아 수집기
│   └── clien.ts              # NEW: 클리앙 수집기
├── utils/
│   ├── naver-parser.ts       # 기존
│   └── community-parser.ts   # NEW: 커뮤니티 공통 유틸 (날짜 파싱, 인코딩 등)
└── index.ts                  # 새 어댑터 export 추가
```

### 고급 분석 모듈 확장 구조

```
packages/core/src/analysis/
├── modules/
│   ├── [기존 8개 모듈]
│   ├── approval-rating.ts    # NEW: ADVN-01 AI 지지율 추정
│   ├── frame-war.ts          # NEW: ADVN-02 프레임 전쟁
│   ├── crisis-scenario.ts    # NEW: ADVN-03 위기 시나리오
│   └── win-simulation.ts     # NEW: ADVN-04 승리 시뮬레이션
├── schemas/
│   ├── [기존 8개 스키마]
│   ├── approval-rating.schema.ts
│   ├── frame-war.schema.ts
│   ├── crisis-scenario.schema.ts
│   └── win-simulation.schema.ts
├── runner.ts                 # Stage 4 추가 (ADVN 모듈)
└── types.ts                  # MODULE_MODEL_MAP에 ADVN 모듈 추가
```

### 대시보드 확장 구조

```
apps/web/src/
├── app/page.tsx              # 5번째 탭 패널 추가
├── components/
│   ├── layout/top-nav.tsx    # TAB_LABELS에 '고급 분석' 추가
│   ├── analysis/trigger-form.tsx  # sources 타입에 커뮤니티 3종 추가
│   └── advanced/             # NEW: 고급 분석 탭 컴포넌트
│       ├── advanced-view.tsx
│       ├── approval-rating-card.tsx
│       ├── frame-war-chart.tsx
│       ├── crisis-scenarios.tsx
│       └── win-simulation-card.tsx
├── server/trpc/routers/
│   └── analysis.ts           # sources enum 확장
```

### Pattern 1: 커뮤니티 수집기 패턴 (NaverNewsCollector 계승)

**What:** 각 사이트별 독립 Collector 클래스. Playwright로 페이지 로드, Cheerio로 파싱, AsyncGenerator로 청크 단위 yield.
**When to use:** 모든 커뮤니티 수집기에 동일 적용.

```typescript
// DC갤러리 수집기 골격 (naver-news.ts 패턴 계승)
export class DCInsideCollector implements Collector<DCPost> {
  readonly source = 'dcinside';

  async *collect(options: CollectionOptions): AsyncGenerator<DCPost[], void, unknown> {
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        userAgent: '...',
      });
      const page = await context.newPage();

      // 1. 키워드 검색 (search.dcinside.com 또는 갤러리 내 검색)
      // 2. 페이지네이션 루프
      // 3. Cheerio로 게시글 목록 파싱
      // 4. 각 게시글 상세 페이지에서 본문+댓글 수집
      // 5. yield chunk
      // 6. 랜덤 딜레이 (반봇 대응)
    } finally {
      if (browser) await browser.close();
    }
  }
}
```

### Pattern 2: 고급 분석 모듈 패턴 (risk-map 모듈 계승)

**What:** AnalysisModule 인터페이스 구현. Zod 스키마 + system/user 프롬프트 + buildPromptWithContext로 선행 결과 참조.
**When to use:** ADVN-01~04 모든 모듈에 적용.

```typescript
// ADVN-01 AI 지지율 추정 모듈 골격
export const approvalRatingModule: AnalysisModule<ApprovalRatingResult> = {
  name: 'approval-rating',
  displayName: 'AI 지지율 추정',
  provider: config.provider,
  model: config.model,
  schema: ApprovalRatingSchema,

  buildSystemPrompt(): string {
    /* ... */
  },
  buildPrompt(data: AnalysisInput): string {
    /* ... */
  },
  buildPromptWithContext(data: AnalysisInput, priorResults: Record<string, unknown>): string {
    // Stage 1~3 결과 + 감정 비율 + 플랫폼 편향 데이터 참조
  },
};
```

### Pattern 3: 분석 파이프라인 Stage 확장

**What:** runner.ts의 기존 3단계(Stage 1 병렬 -> Stage 2 순차 -> Stage 3 최종요약) 뒤에 Stage 4(고급 분석)를 추가.
**When to use:** ADVN 모듈은 기존 8개 모듈 결과를 모두 참조하므로 후순위 Stage에서 실행.

```typescript
// runner.ts 확장 구조
// Stage 1: 병렬 (macro-view, segmentation, sentiment-framing, message-impact)
// Stage 2: 순차 (risk-map, opportunity, strategy) -- Stage 1 의존
// Stage 3: 최종 요약 (final-summary) -- 모든 선행 의존
// Stage 4: 고급 분석 (approval-rating, frame-war, crisis-scenario, win-simulation) -- 모든 선행 의존
//   - ADVN-01~02: 병렬 가능 (독립)
//   - ADVN-03: ADVN-01 + risk-map 의존
//   - ADVN-04: ADVN-01~03 의존

// 리포트 재생성: Stage 4 완료 후 통합 리포트에 고급 분석 섹션 추가
```

### Anti-Patterns to Avoid

- **단일 거대 수집기**: 3개 사이트를 하나의 클래스로 통합하지 말 것. 사이트별 독립 어댑터로 부분 실패 격리.
- **하드코딩된 갤러리/게시판 ID**: 키워드 검색 기반으로 동적 탐색. 특정 갤러리에 종속하지 않음.
- **동기식 전체 로드**: AsyncGenerator yield 패턴 유지. 메모리 효율 + 진행률 추적.
- **분석 모듈 간 직접 호출**: 모듈 간 의존은 priorResults를 통해서만 전달 (runner가 오케스트레이션).

## Don't Hand-Roll

| Problem        | Don't Build          | Use Instead                    | Why                                    |
| -------------- | -------------------- | ------------------------------ | -------------------------------------- |
| HTML 파싱      | 정규식 기반 파서     | Cheerio ($)                    | HTML 구조 변경에 취약, DOM 탐색이 안전 |
| 날짜 파싱      | 커뮤니티별 개별 파서 | 공통 parseDateText() 유틸 확장 | "N시간 전", "YYYY.MM.DD" 등 패턴 공유  |
| AI 구조화 응답 | JSON 수동 파싱       | analyzeStructured() + Zod      | 타입 안전성, 재시도, 에러 핸들링 내장  |
| 차트 컴포넌트  | 커스텀 SVG           | shadcn/ui Chart (Recharts)     | 테마 자동 적용, 반응형, 접근성         |

## Common Pitfalls

### Pitfall 1: 커뮤니티 사이트 차단 (Anti-Bot)

**What goes wrong:** 짧은 간격으로 다수 요청 시 IP 차단 또는 CAPTCHA 노출.
**Why it happens:** DC갤러리/에펨코리아/클리앙 모두 CloudFlare 또는 자체 봇 방지 사용.
**How to avoid:**

- 페이지 간 2~4초 랜덤 딜레이 (NaverNews의 1.5~2초보다 길게)
- 게시글 상세 페이지 간 1~2초 딜레이
- User-Agent 로테이션 (일반 브라우저 UA)
- 세션당 최대 요청 수 제한 (예: 100페이지/세션)
- 실패 시 지수 백오프 재시도
  **Warning signs:** 403 응답, CAPTCHA 페이지, 빈 HTML 반환

### Pitfall 2: DOM 셀렉터 깨짐

**What goes wrong:** 사이트 UI 업데이트 시 CSS 셀렉터가 변경되어 파싱 실패.
**Why it happens:** 커뮤니티 사이트는 주기적으로 프론트엔드 리뉴얼.
**How to avoid:**

- 여러 후보 셀렉터를 배열로 관리 (NaverNews의 contentSelectors 패턴)
- 파싱 결과가 0건이면 즉시 경고 로그 (빈 배열 반환이 아닌 감지)
- 각 수집기에 셀렉터 상수를 모듈 상단에 집중 배치 (유지보수 용이)
  **Warning signs:** 정상 페이지인데 items.length === 0

### Pitfall 3: collectionJobs progress 타입 불일치

**What goes wrong:** 커뮤니티 소스 추가 시 기존 `progress` JSONB 타입이 naver/youtube만 지원.
**Why it happens:** `collectionJobs.progress`가 `{ naver: ..., youtube: ... }` 고정 타입.
**How to avoid:**

- progress 타입을 `Record<string, { status: string; posts: number; comments: number }>` 으로 일반화
- 또는 기존 타입에 dcinside/fmkorea/clien 필드 추가
- 마이그레이션으로 기존 데이터와 호환 유지
  **Warning signs:** TypeScript 타입 에러, 기존 모니터링 UI 깨짐

### Pitfall 4: AI 지지율 추정의 과신 표현

**What goes wrong:** 추정치를 확정적 수치로 표현하여 법적/윤리적 문제.
**Why it happens:** AI가 정밀한 숫자를 생성하면 사용자가 실제 여론조사로 오인.
**How to avoid:**

- 결과에 반드시 면책 문구 포함: "AI 기반 참고치이며 과학적 여론조사를 대체하지 않습니다"
- 추정치를 범위(range)로 표현 (예: "긍정 여론 45~55%")
- 신뢰도 등급 표시 (HIGH/MEDIUM/LOW)
- 플랫폼 편향 보정 계수를 투명하게 공개
  **Warning signs:** 단일 숫자 퍼센트, 면책 문구 누락

### Pitfall 5: 분석 파이프라인 Stage 4 실패가 리포트에 미치는 영향

**What goes wrong:** ADVN 모듈 실패 시 기존 리포트가 깨지거나 빈 섹션.
**Why it happens:** 리포트 생성기가 ADVN 결과를 참조하도록 수정하면 ADVN 없는 기존 작업 호환성 깨짐.
**How to avoid:**

- ADVN 결과는 선택적(optional) 섹션으로 리포트에 포함
- ADVN 모듈 전체 실패 시에도 기존 8개 모듈 기반 리포트는 정상 생성
- "고급 분석" 섹션은 결과가 있을 때만 렌더링
  **Warning signs:** 기존 분석 결과 조회 시 에러, ADVN 없는 작업에서 리포트 깨짐

### Pitfall 6: 커뮤니티 게시글에 articles 테이블 재사용 시 혼란

**What goes wrong:** 커뮤니티 "게시글"과 뉴스 "기사"가 같은 테이블에 혼재하여 publisher 등 필드 의미 불일치.
**Why it happens:** articles 테이블이 원래 뉴스 기사용으로 설계됨.
**How to avoid:**

- articles 테이블을 그대로 재사용하되, `source` 컬럼으로 구분 ('dcinside', 'fmkorea', 'clien')
- `publisher` 필드에 갤러리/게시판 이름 저장 (의미 확장)
- 커뮤니티 게시글도 title/content/publishedAt/url 핵심 필드는 동일하므로 호환 가능
- AnalysisInput의 articles 배열에 자연스럽게 합류
  **Warning signs:** publisher가 null이거나 의미 없는 값

## Code Examples

### 커뮤니티 수집 데이터 정규화 (normalize.ts 확장)

```typescript
// packages/core/src/pipeline/normalize.ts에 추가할 함수
// DC갤러리/에펨코리아/클리앙 게시글 -> articles 테이블 형식
export function normalizeCommunityPost(
  post: CommunityPost,
  jobId: number,
  source: 'dcinside' | 'fmkorea' | 'clien',
): typeof articles.$inferInsert {
  return {
    jobId,
    source,
    sourceId: post.sourceId,
    url: post.url,
    title: post.title,
    content: post.content,
    author: post.author,
    publisher: post.boardName, // 갤러리/게시판 이름
    publishedAt: post.publishedAt,
    rawData: post.rawData,
  };
}

// 커뮤니티 댓글 -> comments 테이블 형식
export function normalizeCommunityComment(
  comment: CommunityComment,
  jobId: number,
  source: 'dcinside' | 'fmkorea' | 'clien',
  articleDbId?: number,
): typeof comments.$inferInsert {
  return {
    jobId,
    source,
    sourceId: comment.sourceId,
    parentId: comment.parentId,
    articleId: articleDbId ?? null,
    videoId: null,
    content: comment.content,
    author: comment.author,
    likeCount: comment.likeCount,
    dislikeCount: comment.dislikeCount ?? 0,
    publishedAt: comment.publishedAt,
    rawData: comment.rawData,
  };
}
```

### 고급 분석 Zod 스키마 예시 (ADVN-01)

```typescript
// packages/core/src/analysis/schemas/approval-rating.schema.ts
import { z } from 'zod';

export const ApprovalRatingSchema = z.object({
  estimatedRange: z
    .object({
      min: z.number().min(0).max(100),
      max: z.number().min(0).max(100),
    })
    .describe('AI 추정 지지율 범위 (%)'),
  confidence: z.enum(['high', 'medium', 'low']),
  methodology: z.object({
    sentimentRatio: z.object({
      positive: z.number(),
      neutral: z.number(),
      negative: z.number(),
    }),
    platformBiasCorrection: z.array(
      z.object({
        platform: z.string(),
        biasDirection: z.enum(['left', 'right', 'neutral']),
        correctionFactor: z.number(),
      }),
    ),
    spreadFactor: z.number().describe('확산력 가중치'),
  }),
  disclaimer: z.string().describe('면책 문구'),
  reasoning: z.string(),
});

export type ApprovalRatingResult = z.infer<typeof ApprovalRatingSchema>;
```

### 트리거 폼 소스 확장

```typescript
// trigger-form.tsx 수정 포인트
// 기존: sources: z.array(z.enum(['naver', 'youtube']))
// 변경: sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien']))

// 기존 체크박스 UI에 커뮤니티 섹션 추가
const SOURCE_OPTIONS = [
  {
    group: '뉴스/영상',
    items: [
      { id: 'naver', label: '네이버 뉴스' },
      { id: 'youtube', label: '유튜브' },
    ],
  },
  {
    group: '커뮤니티',
    items: [
      { id: 'dcinside', label: 'DC갤러리' },
      { id: 'fmkorea', label: '에펨코리아' },
      { id: 'clien', label: '클리앙' },
    ],
  },
];
```

## 사이트별 스크래핑 정보

### DC갤러리 (dcinside.com)

**Confidence:** MEDIUM

| 항목         | 값                                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 검색 URL     | `https://search.dcinside.com/post/p/1/sort/accuracy/q/{keyword}` 또는 갤러리 내 `gall.dcinside.com/board/lists/?id={gallery_id}&s_type=search_all&s_keyword={keyword}` |
| 앱 API       | `http://app.dcinside.com/api/gall_list_new.php?id={gallery}&page={page}&app_id={base64_id}`                                                                            |
| 게시글 URL   | `https://gall.dcinside.com/board/view/?id={gallery_id}&no={post_no}`                                                                                                   |
| 페이지네이션 | page 파라미터 (1부터)                                                                                                                                                  |
| 주요 셀렉터  | 게시글 목록: `.ub-content .gall_tit a`, 본문: `.write_div`, 댓글: `.reply_content .usertxt`                                                                            |
| 특이사항     | 마이너 갤러리는 `/mgallery/` 경로. 비로그인 접근 가능. CloudFlare 간헐적 차단                                                                                          |
| 권장 딜레이  | 페이지 간 2~3초, 게시글 간 1~2초                                                                                                                                       |

### 에펨코리아 (fmkorea.com)

**Confidence:** MEDIUM

| 항목            | 값                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------- |
| CMS             | XpressEngine (XE/Rhymix)                                                                      |
| 검색 URL        | `https://www.fmkorea.com/?mid={board}&act=IS&is_keyword={keyword}&where=document&page={page}` |
| 게시글 URL      | `https://www.fmkorea.com/{document_srl}`                                                      |
| 페이지네이션    | page 파라미터, XE 표준 방식                                                                   |
| 주요 게시판 mid | `politics` (정치), `best` (포텐), `humor` (유머)                                              |
| 특이사항        | XE 기반이라 `index.php` 라우팅. 검색 결과에 게시판 카테고리 포함                              |
| 권장 딜레이     | 페이지 간 2~4초, 게시글 간 1~2초                                                              |

### 클리앙 (clien.net)

**Confidence:** MEDIUM

| 항목        | 값                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| 게시판 URL  | `https://www.clien.net/service/board/{board_id}?&od=T31&po={page}`                                       |
| 검색 URL    | `https://www.clien.net/service/search?q={keyword}&sort=recency&p={page}&boardCd=&is498=false`            |
| 게시글 URL  | `https://www.clien.net/service/board/{board_id}/{document_id}`                                           |
| 주요 게시판 | `park` (모두의공원), `news` (뉴스), `cm_politics` (정치사회)                                             |
| 특이사항    | 403 보호 강함, 반드시 Playwright 필요 (Axios 직접 접근 차단). `list-title` CSS 클래스로 게시글 제목 접근 |
| 권장 딜레이 | 페이지 간 3~5초, 게시글 간 1.5~2.5초 (가장 엄격)                                                         |

## State of the Art

| Old Approach            | Current Approach          | When Changed | Impact                                       |
| ----------------------- | ------------------------- | ------------ | -------------------------------------------- |
| 2개 소스(네이버+유튜브) | 5개 소스(+DC/에펨/클리앙) | Phase 4      | 커뮤니티 여론 포함으로 분석 다양성 대폭 향상 |
| 8개 분석 모듈 (3 Stage) | 12개 분석 모듈 (4+ Stage) | Phase 4      | 고급 분석으로 전략적 인사이트 확장           |
| 4탭 대시보드            | 5탭 (고급 분석 추가)      | Phase 4      | 지지율/프레임/시나리오/시뮬레이션 시각화     |

## Open Questions

1. **DC갤러리 앱 API vs 웹 스크래핑 선택**
   - What we know: 앱 API(`app.dcinside.com`)가 존재하지만 비공식이며 app_id 생성 로직이 필요. 웹 스크래핑은 Playwright로 안정적이지만 느림.
   - What's unclear: 앱 API의 현재(2026-03) 가용성 및 인증 변경 여부.
   - Recommendation: 웹 스크래핑으로 시작 (안정성 우선). 앱 API는 성능 최적화 시 향후 도입 고려.

2. **collectionJobs progress 타입 확장 방식**
   - What we know: 현재 `{ naver: ..., youtube: ... }` 고정 타입. 3개 소스 추가 필요.
   - What's unclear: 기존 데이터 마이그레이션 필요 여부 (JSONB이므로 nullable 추가는 가능).
   - Recommendation: JSONB 타입을 `Record<string, SourceProgress>` 로 일반화하는 것이 가장 깔끔. 기존 데이터는 그대로 호환됨 (superset).

3. **고급 분석 Stage 배치**
   - What we know: ADVN 모듈은 기존 8개 모듈 결과를 참조해야 함. final-summary 이후 실행 필요.
   - What's unclear: ADVN-01~02를 병렬로 실행한 뒤 ADVN-03~04를 순차 실행할지, 아니면 4개 모두 순차 실행할지.
   - Recommendation: ADVN-01, ADVN-02 병렬 -> ADVN-03 (ADVN-01 + risk-map 의존) -> ADVN-04 (전체 의존) 순서가 최적.

## Validation Architecture

### Test Framework

| Property           | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| Framework          | Vitest 3.2.4                                                             |
| Config file        | `packages/collectors/vitest.config.ts`, `packages/core/vitest.config.ts` |
| Quick run command  | `pnpm --filter @ai-signalcraft/collectors test`                          |
| Full suite command | `pnpm -r test`                                                           |

### Phase Requirements -> Test Map

| Req ID  | Behavior                    | Test Type | Automated Command                                                               | File Exists? |
| ------- | --------------------------- | --------- | ------------------------------------------------------------------------------- | ------------ |
| COLL-06 | DC갤러리 게시글/댓글 파싱   | unit      | `pnpm --filter @ai-signalcraft/collectors vitest run tests/dcinside.test.ts -x` | Wave 0       |
| COLL-07 | 에펨코리아 게시글/댓글 파싱 | unit      | `pnpm --filter @ai-signalcraft/collectors vitest run tests/fmkorea.test.ts -x`  | Wave 0       |
| COLL-08 | 클리앙 게시글/댓글 파싱     | unit      | `pnpm --filter @ai-signalcraft/collectors vitest run tests/clien.test.ts -x`    | Wave 0       |
| ADVN-01 | 지지율 추정 스키마 검증     | unit      | `pnpm --filter @ai-signalcraft/core vitest run tests/advn-schema.test.ts -x`    | Wave 0       |
| ADVN-02 | 프레임 전쟁 스키마 검증     | unit      | `pnpm --filter @ai-signalcraft/core vitest run tests/advn-schema.test.ts -x`    | Wave 0       |
| ADVN-03 | 위기 시나리오 스키마 검증   | unit      | `pnpm --filter @ai-signalcraft/core vitest run tests/advn-schema.test.ts -x`    | Wave 0       |
| ADVN-04 | 승리 시뮬레이션 스키마 검증 | unit      | `pnpm --filter @ai-signalcraft/core vitest run tests/advn-schema.test.ts -x`    | Wave 0       |

### Sampling Rate

- **Per task commit:** 해당 패키지 테스트만 실행
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/collectors/tests/dcinside.test.ts` -- COLL-06 HTML 파싱 단위 테스트
- [ ] `packages/collectors/tests/fmkorea.test.ts` -- COLL-07 HTML 파싱 단위 테스트
- [ ] `packages/collectors/tests/clien.test.ts` -- COLL-08 HTML 파싱 단위 테스트
- [ ] `packages/core/tests/advn-schema.test.ts` -- ADVN-01~04 Zod 스키마 검증 테스트
- [ ] `packages/core/tests/analysis-runner-stage4.test.ts` -- Stage 4 파이프라인 테스트

## Sources

### Primary (HIGH confidence)

- 기존 코드베이스 직접 분석: `packages/collectors/src/adapters/naver-news.ts`, `packages/core/src/analysis/runner.ts`, `packages/core/src/analysis/types.ts`, DB 스키마
- Playwright 1.58.2 (pnpm list 확인), Cheerio 1.2.0, Vitest 3.2.4

### Secondary (MEDIUM confidence)

- [DC Inside 앱 API 분석](https://github.com/organization/OpenDC/blob/master/%EB%B6%84%EC%84%9D.md) - 앱 API 엔드포인트/파라미터 구조
- [DC Inside GitHub Topics](https://github.com/topics/dcinside) - 커뮤니티 크롤러 프로젝트 참고
- [에펨코리아 XE 기반 구조](https://www.fmkorea.com/) - WebFetch로 URL 구조 확인
- [클리앙 게시판 구조](https://www.clien.net/service/board/park) - CSS 셀렉터 패턴 참고

### Tertiary (LOW confidence)

- 사이트별 CSS 셀렉터: 실시간으로 변경될 수 있음, 구현 시 실제 페이지에서 재검증 필요
- 클리앙 403 보호 수준: WebFetch에서 403 반환 확인, Playwright 우회 가능 여부는 실측 필요

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - 기존 코드베이스에서 모든 라이브러리 확인, 버전 실측
- Architecture: HIGH - 기존 패턴(Collector, AnalysisModule, Runner) 100% 재사용
- Pitfalls: MEDIUM - 스크래핑 대상 사이트의 현재 차단 수준은 실측 필요
- 사이트별 셀렉터: LOW-MEDIUM - 구현 시 실제 HTML에서 재확인 필수

**Research date:** 2026-03-24
**Valid until:** 2026-04-07 (사이트 셀렉터는 언제든 변경 가능)
