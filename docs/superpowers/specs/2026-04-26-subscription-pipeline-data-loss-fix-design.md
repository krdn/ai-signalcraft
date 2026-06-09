# 구독 분석 파이프라인 데이터 손실 수정 — 설계서

| 항목      | 값                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 작성일    | 2026-04-26                                                                                                                           |
| 작성자    | gon (Claude 협업)                                                                                                                    |
| 대상 결함 | job 271(구독)이 `completed` 상태이지만 article_jobs/comment_jobs 0건, applied_preset NULL, 분석 모듈 부분 실패가 보고서에 노출 안 됨 |
| 비교 기준 | job 272(일반 신규 분석) — 동일 키워드·윈도우, 정상 동작                                                                              |
| 범위      | 단일 spec, 3 phase로 분리 (PR 6개)                                                                                                   |

## 1. 배경 — job 271 vs 272 정밀 비교

### 1.1 두 잡의 결과 비교 (DB 실측)

| 측정                                           | #271 (구독)                                       | #272 (일반)                                                                       |
| ---------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| 트리거 경로                                    | `triggerSubscriptionAnalysis` (subscriptionId=37) | `triggerCollection` (FlowProducer 5단계)                                          |
| `options.useCollectorLoader`                   | true                                              | (없음)                                                                            |
| `options.skipItemAnalysis`                     | true                                              | (없음, enableItemAnalysis=true)                                                   |
| `applied_preset`                               | **NULL**                                          | politics 프리셋 (5소스)                                                           |
| `limits`                                       | NULL                                              | `{naverArticles:100, youtubeVideos:100, communityPosts:100, commentsPerItem:100}` |
| `article_jobs` 카운트                          | **0**                                             | 1,110                                                                             |
| `comment_jobs` 카운트                          | **0**                                             | 22,031                                                                            |
| `progress.naver-news.articles`                 | **6**                                             | (`naver`: 687)                                                                    |
| `progress` 내 `clien` 키                       | **없음**                                          | posts=23, comments=363                                                            |
| `progress.token-optimization.phase`            | `collector-rag-postsample`                        | `preprocessing`                                                                   |
| 분석 모듈 12개 status                          | 모두 `completed`                                  | 모두 `completed`                                                                  |
| `progress._events` warn (rate-limit 청크 실패) | 4건                                               | 4건                                                                               |
| `analysis_reports.metadata.modulesFailed`      | `[]`                                              | `[]`                                                                              |
| 실행 시간                                      | ~4.5분                                            | ~41분                                                                             |
| 보고서 결론                                    | "과거 의혹 재점화" (추상적)                       | "당내 갈등·코스프레 역풍" (구체)                                                  |

### 1.2 코드 리서치로 확정된 결함 분류

| #   | 항목                                             | 분류                                                                                        | 근거                                                                |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | useCollectorLoader 분기 자체                     | 의도된 설계                                                                                 | `pipeline-orchestrator.ts:87-88`                                    |
| 2   | article_jobs/comment_jobs/video_jobs INSERT 누락 | **결함** — RAG 의미검색 폴백 유발                                                           | 구독 경로는 collect/normalize/persist 단계 자체가 생성 안 됨        |
| 3   | clien 누락                                       | **부분 결함** — collection_jobs.options.sources 미저장 (subscription DB에는 등록됨)         | `analysis.ts:359-365`에 sources 필드 부재                           |
| 4   | naver-news 6건만 진입                            | **결함** — collector RAG 호출이 source별 비율 보장 없음, 임베딩 거리 정렬에서 dcinside 독식 | raw_items에는 2,366건 누적, `items.ts:97-118`에서 keyword 필터 부재 |
| 5   | token-optimization phase 라벨                    | 의도된 라벨 분기                                                                            | `pipeline-orchestrator.ts:273-389`                                  |
| 6   | applied_preset/limits NULL                       | **결함** — 운영 가시성 손실                                                                 | `analysis.ts:302-374`에서 필드 미저장                               |
| 7   | Stage1 청크 부분 실패 노출 안 됨                 | **결함** — 부분 실패가 status='completed'로 가려짐                                          | `progress._events`의 warn이 metadata에 미반영                       |

### 1.3 timescaledb (5435 ais_collection) 진단 결과 — 2026-04-26 실측

| 측정                                        | 값                                                                                    | 의미                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `keyword_subscriptions.id=37` sources       | `{youtube,naver-news,dcinside,fmkorea,clien}`                                         | clien 등록되어 있음 → "subscription에 sources 누락" 가설 폐기 |
| 271 윈도우(7일) `raw_items` 누적            | naver-news 2,366 / dcinside 6,312 / clien 19+333 / fmkorea 246 / youtube videos 2,471 | 데이터는 실제로 존재                                          |
| 271 시점(04:43-04:48) `collection_runs`     | **0건**                                                                               | 271은 새 수집 안 함, 기존 raw_items 재사용                    |
| collector `items.query` 라우터 keyword 필터 | **존재하지 않음**                                                                     | mode='rag'에서 임베딩 거리만으로 정렬                         |

**확정된 가설**: 271의 naver-news 6건은 collector mode='rag' 결과의 source별 비율 왜곡(임베딩 거리 정렬에서 dcinside 우위)이다. collector adapter나 subscription 설정 문제가 아니다.

## 2. 범위와 비범위

### 2.1 범위 (3 phase)

- **Phase 1 (데이터 정합성)**: 결함 #2/#3/#6 — 구독 경로에서도 분석 DB에 articles/comments/videos upsert + linkage INSERT, applied_preset/limits/sources 저장.
- **Phase 2 (수집 커버리지)**: 결함 #4 — `loadAnalysisInputFromCollector`를 source별 분산 호출로 변경(B-1).
- **Phase 3 (운영 가시성)**: 결함 #7 — `analysis_reports.metadata`에 `modulesPartial[]`, `warnings[]`, `qualityFlags{}` 추가, markdown footer + UI 배너.

### 2.2 범위 밖 (명시)

- 자동 재실행: 부분 실패 모듈 재시도 자동화는 별도 spec.
- 청크 단위 실패 카운트(`chunksTotal/chunksFailed`)를 새로 기록: 본 spec은 progress.\_events의 warn에서 추출하며, 모듈 실행기에 카운트 추가는 별도 spec.
- 임베딩 모델의 source bias 자체 분석/교체: 별도 spec.
- collector raw_items의 source별 누적 균형(예: clien 19건만 누적): 운영 이슈로 분리.
- 271 잡의 데이터 사후 복구: 재실행으로 처리.
- 알림(이메일/슬랙): 본 spec 범위 밖.

## 3. Phase 1 — 데이터 정합성

### 3.1 목표

- `useCollectorLoader=true` 잡의 `article_jobs/comment_jobs/video_jobs`가 일반 경로와 같은 의미의 카운트(잡에 수집된 풀셋)로 채워진다.
- `collection_jobs.applied_preset`, `limits`, `options.sources`가 NULL이 아니라 실제 적용된 값으로 저장된다.
- RAG SQL이 article_jobs를 매칭해 의미검색이 동작한다.

### 3.2 코드 변경 지점

| 변경                                                                                                   | 파일                                                        | 성격           |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------- |
| (a) `triggerSubscription`이 `collection_jobs` INSERT 시 `appliedPreset/limits/options.sources` 채움    | `apps/web/src/server/trpc/routers/analysis.ts:302-374`      | 수정           |
| (b) collector API에 `fetchAnalysisPayload` procedure 추가 — RAG sample + fullset 동시 반환             | `apps/collector/src/server/trpc/items.ts`                   | 신규 procedure |
| (c) `loadAnalysisInputViaCollector()`가 fullset도 함께 반환                                            | `packages/core/src/analysis/data-loader.ts:154-188`         | 응답 타입 확장 |
| (d) `persistFromCollectorPayload(jobId, payload)` 신규 함수                                            | `packages/core/src/pipeline/persist.ts`                     | 신규 export    |
| (e) `pipeline-orchestrator.ts`가 `useCollectorLoader` 분기 직후 (d) 호출, `progress.persist` 단계 기록 | `packages/core/src/analysis/pipeline-orchestrator.ts:87-95` | 수정           |
| (f) collector API가 `sources` 파라미터를 받으면 그 값을 우선 사용                                      | (b)의 일부)                                                 | 수정           |

### 3.3 데이터 흐름 (구독 경로 신규)

```
triggerSubscription mutation
  ├─ collection_jobs INSERT
  │    appliedPreset = subscription.preset 또는 합성({slug:'__subscription__', ...})
  │    limits        = subscription.limits 또는 preset.limits
  │    options.sources = subscription.sources (스냅샷)
  │    options.useCollectorLoader = true
  │    options.skipItemAnalysis = true
  └─ analysis 큐에 run-analysis 잡 등록
       │
       ▼
pipeline-orchestrator.runAnalysis(jobId)
  ├─ loadAnalysisInputViaCollector(jobId)   ← (c)
  │    응답: { input, samplingStats, fullset, collectionMeta }
  ├─ persistFromCollectorPayload(jobId, response.fullset)   ← (d) 신규
  │    ├─ articles: fullset 메타로 upsert (본문 포함)
  │    ├─ comments: 동일
  │    ├─ videos: 동일
  │    ├─ article_jobs/comment_jobs/video_jobs: fullset ID 전체 INSERT (onConflictDoNothing)
  │    └─ progress.persist = { status:'completed', articles:N, comments:M, videos:K }
  ├─ token-optimization (기존 collector-rag-postsample 분기)
  └─ 분석 모듈 실행 (기존 그대로)
```

### 3.4 collector API 응답 타입

```typescript
type CollectorAnalysisPayload = {
  ragSample: {
    articles: ArticleWithBody[]; // ≤ ragOptions.topK (현재 ~130)
    comments: CommentWithBody[]; // ≤ 200
    videos: VideoWithBody[];
  };
  fullset: {
    articles: ArticleWithBody[]; // 본문 포함 (Phase 1 정책)
    comments: CommentWithBody[];
    videos: VideoWithBody[];
  };
  collectionMeta: {
    sources: string[];
    sourceCounts: Record<string, { articles: number; comments: number; videos: number }>;
    window: { start: string; end: string };
  };
};
```

**페이로드 크기 정책**: 271 사례 기준 1110 articles + 22031 comments. 추정 5–10MB. 임계 초과 시 fallback — articles만 본문 포함, comments는 별도 페이지네이션 endpoint로 분리 (현 시점 구현하지 않음, 임계 도달 시 활성).

### 3.5 핵심 설계 결정

**(1) "본문 없는 articles 행" 방지**: fullset에 본문을 포함시켜 분석 DB upsert 시 placeholder 행 없음. RAG SQL이 `articles JOIN article_jobs ON job_id = ?`로 풀셋 매칭 → 의미검색 동작.

**(2) `applied_preset` 출처 (구독 경로)**: 구독에 직접 프리셋이 연결돼 있으면 그것을 그대로 스냅샷. 아니면 `{slug:'__subscription__', title: subscription.keyword, sources, limits, optimization, customized:true}`로 합성.

**(3) persist 트랜잭션**: 일반 경로의 `persistArticles/persistVideos/persistComments` 함수를 재사용. 트랜잭션은 테이블별 분리(기존 패턴 유지). orchestrator가 세 함수를 순차 await.

**(4) progress 키 통일**: `persist`라는 키를 새로 사용. 일반 경로 `pipeline-worker`가 쓰는 키와 동일 → 모니터링 UI가 두 경로를 같은 키로 표시.

### 3.6 사후 동등성

- **카운트 의미**: 둘 다 `article_jobs.count = 잡에 수집된 전체 기사 수`.
- **RAG SQL 입력**: 둘 다 풀셋 매칭 → 의미 검색 동작.
- **재실행 가능성**: 구독 잡도 일반 경로의 재실행 흐름과 같은 데이터를 봄.

## 4. Phase 2 — 수집 커버리지 (B-1: source별 분산 RAG 호출)

### 4.1 목표

구독 분석에서 source별 비율 왜곡을 제거 — naver-news, clien 등이 임베딩 거리 정렬에서 dcinside에 밀려 누락되지 않도록.

### 4.2 변경 지점

`packages/core/src/analysis/data-loader.ts:248-292`의 단일 collector 호출을 source별 분산 호출로 변경.

```typescript
const sources = opts.sources ?? defaultSourcesForDomain(opts.domain);
const perSourceArticleTopK = Math.ceil(articleVideoTopK / sources.length);
const perSourceCommentTopK = Math.ceil(commentTopK / sources.length);

const articleVideoCalls = sources.map(s =>
  client.items.query.query({
    keyword, dateRange, sources: [s], itemTypes: ['article','video'],
    subscriptionId, mode: 'rag',
    ragOptions: { topK: perSourceArticleTopK, semanticQuery: keyword },
    maxContentLength, limit: perSourceArticleTopK,
  })
);
const commentCalls = sources.map(s => /* 동일 */);

const [articleVideoResps, commentResps] = await Promise.all([
  Promise.all(articleVideoCalls),
  Promise.all(commentCalls),
]);
articleVideoItems = dedupItems(articleVideoResps.flatMap(r => r.items));
commentItems = dedupItems(commentResps.flatMap(r => r.items));
```

### 4.3 호출 비용

- 현재 2회 → 5소스 × 2 itemType = 최대 10회.
- collector가 같은 호스트의 redis/pgvector 위에 있어 직렬 단계는 임베딩 1회 + 인덱스 검색 5회×2.
- 추정 추가 latency: +200~600ms (병렬).

### 4.4 하위 호환

- `sources`가 undefined면 기존 단일 호출 fallback (현 동작 유지).
- 응답 타입(fullset 추가)은 Phase 1에서 이미 변경. 이 단계는 호출 분기만 추가.

### 4.5 트랙 A — sources 동기화는 Phase 1에 흡수

섹션 3.2의 (a)/(f)에서 `collection_jobs.options.sources` 저장 + collector API가 sources 파라미터를 우선 사용하도록 처리 → Phase 2에서 별도 작업 불필요.

## 5. Phase 3 — 운영 가시성

### 5.1 목표

"completed인데 부분 실패"라는 상태를 더 이상 숨기지 않는다.

- 보고서를 본 사용자가 어떤 경고가 있었는지 즉시 안다.
- UI 모니터/리포트 페이지에서 같은 정보를 같은 출처로 본다.

### 5.2 metadata 확장 (`analysis_reports.metadata` jsonb — schema 변경 없음)

```typescript
type AnalysisReportMetadata = {
  // 기존 필드
  keyword: string;
  dateRange: { start: string; end: string };
  generatedAt: string;
  reportModel: { model: string; provider: string };
  totalTokens: number;
  modulesFailed: string[];
  modulesCompleted: string[];

  // === 신규 (Phase 3) ===
  modulesPartial: Array<{
    module: string;
    reason: 'rate-limit' | 'parse-error' | 'unknown';
    chunksTotal: number | null;
    chunksFailed: number | null;
  }>;
  warnings: Array<{
    ts: string;
    phase: string | null;
    module: string | null;
    level: 'warn';
    msg: string;
  }>;
  qualityFlags: {
    hasRateLimitFailures: boolean;
    hasPartialModules: boolean;
    samplingShallow: boolean; // totalSampled < 200 (articles 또는 comments)
  };
};
```

### 5.3 채우기 흐름

`packages/core/src/analysis/report-generator.ts` (또는 동등 위치)에서 보고서 markdown 생성 직전:

```
1. collection_jobs.progress._events 읽음
   - level === 'warn' 필터
   - msg 정규식 매칭: /^(\w+(-\w+)*) 청크 분석 실패.*Last error: (.+)\./
   - { module, reason: 'rate-limit' | 'parse-error' | 'unknown' } 추출

2. analysis_results 읽음
   - chunksTotal/chunksFailed는 progress._events에 "chunk N/M" 패턴 있을 때만 채움, 없으면 null

3. samplingShallow 계산
   - progress.sampling.articles.totalSampled < 200 또는
   - progress.sampling.comments.totalSampled < 200

4. qualityFlags 합산
```

### 5.4 보고서 markdown footer

`qualityFlags` 중 하나라도 true면 보고서 끝에 자동 첨부:

```markdown
---

## ⚠️ 분석 경고

이 보고서에는 다음 경고가 포함됩니다:

- **부분 실패 모듈**: segmentation, sentiment-framing, message-impact, macro-view (rate-limit으로 일부 청크 분석 누락)
- **얕은 표본**: 분석에 사용된 기사 130건, 댓글 200건 (RAG 샘플링 후)

자세한 경고 로그는 모니터 페이지 "분석 경고" 탭 또는 잡 상세 progress.\_events를 확인하세요.
```

footer는 `appendQualityFooterToMarkdown(markdown, metadata)` 헬퍼로 분리. metadata 보고 조건부 append.

### 5.5 UI 배너

`apps/web/src/components/quality-warning-banner.tsx` 신규 컴포넌트.

- `metadata.qualityFlags` 중 하나라도 true이면 페이지 상단에 노란색 배너.
- 메시지 예: "이 분석에는 일부 모듈이 부분 실패했습니다. 결과 해석 시 주의하세요. [상세 보기]"
- 상세 보기 → drawer에 `metadata.warnings`/`modulesPartial` 표 출력.
- 보고서 페이지(`apps/web/src/app/.../report/[id]/page.tsx`)와 모니터 페이지(잡 row의 ⚠️ 아이콘) 양쪽에서 재사용.

### 5.6 진행 중 잡 처리

보고서 생성 전에는 `progress._events`가 source. 같은 컴포넌트가 두 출처를 normalize:

```typescript
function deriveQualityFlags(job: CollectionJob, report: AnalysisReport | null) {
  if (report) return report.metadata.qualityFlags;
  const events = job.progress?._events ?? [];
  const warns = events.filter((e) => e.level === 'warn');
  return {
    hasRateLimitFailures: warns.some((w) => /Last error:.*capacity|exhausted/.test(w.msg)),
    hasPartialModules: warns.some((w) => /청크 분석 실패/.test(w.msg)),
    samplingShallow: false, // sampling 끝나기 전엔 판단 보류
  };
}
```

### 5.7 마이그레이션

- `analysis_reports.metadata`는 jsonb이므로 schema 변경 없음.
- 기존 235개 보고서에 신규 필드 추가하지 않음 (과거 progress.\_events 신뢰성 보장 안 됨).
- 신규 보고서부터 자동 적용.
- 보고서 페이지에 "구버전 보고서는 경고가 표시되지 않을 수 있습니다" 한 줄 안내 1주일 노출 — `metadata.qualityFlags` 키 자체가 없는 보고서를 식별해 표시.

## 6. 인터페이스·테스트·롤아웃

### 6.1 신규/수정 함수 시그니처

```typescript
// packages/core/src/analysis/data-loader.ts
export type CollectorAnalysisResult = {
  input: AnalysisInput;
  samplingStats: AppliedSamplingStats;
  fullset: {
    articles: ArticleWithBody[];
    comments: CommentWithBody[];
    videos: VideoWithBody[];
  };
  collectionMeta: {
    sources: string[];
    sourceCounts: Record<string, { articles: number; comments: number; videos: number }>;
    window: { start: string; end: string };
  };
};

export async function loadAnalysisInputViaCollector(
  jobId: number,
): Promise<CollectorAnalysisResult>;
export async function loadAnalysisInputFromCollector(
  opts: LoadFromCollectorOptions,
): Promise<CollectorAnalysisResult>;
```

```typescript
// packages/core/src/pipeline/persist.ts
export async function persistFromCollectorPayload(
  jobId: number,
  payload: CollectorAnalysisResult['fullset'],
): Promise<{ articles: number; comments: number; videos: number }>;
```

```typescript
// apps/collector/src/server/trpc/items.ts
export const fetchAnalysisPayload: PublicProcedure<...>;
// 입력: { keyword, dateRange, sources, subscriptionId, ragPreset, maxContentLength }
// 출력: CollectorAnalysisPayload
// 내부: 기존 items.query를 source별로 ragSample + fullset 두 라운드로 호출 (B-1 적용)
```

```typescript
// packages/core/src/analysis/report-generator.ts
function buildQualityMetadata(
  job: CollectionJob,
  results: AnalysisResult[],
): {
  modulesPartial: ModulePartial[];
  warnings: Warning[];
  qualityFlags: QualityFlags;
};

function appendQualityFooterToMarkdown(markdown: string, metadata: AnalysisReportMetadata): string;
```

```typescript
// apps/web/src/components/quality-warning-banner.tsx
export function QualityWarningBanner(props: {
  metadata: AnalysisReportMetadata | null;
  jobProgress: JobProgress | null;
}): JSX.Element | null;
```

### 6.2 테스트 전략

| 단계    | 테스트                                                  | 위치                                                            | 목적                                                                                                      |
| ------- | ------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Phase 1 | persistFromCollectorPayload upsert + linkage INSERT     | `packages/core/tests/persist-from-collector.test.ts`            | onConflictDoUpdate / onConflictDoNothing 검증                                                             |
| Phase 1 | triggerSubscription이 appliedPreset/limits/sources 채움 | `apps/web/.../analysis.test.ts`                                 | mutation 출력 검증                                                                                        |
| Phase 1 | loadAnalysisInputFromCollector 응답에 fullset 포함      | `packages/core/tests/p4-collector-rag.test.ts` 확장             | 응답 타입 + 카운트 검증                                                                                   |
| Phase 1 | **271 회귀 통합 테스트**                                | `packages/core/tests/integration/subscription-pipeline.test.ts` | 신규 구독 잡 → article_jobs ≥ 100, comment_jobs ≥ 1000, applied_preset ≠ NULL, progress.persist.completed |
| Phase 2 | source별 분산 호출 발생 확인                            | `packages/core/tests/data-loader-rag-fanout.test.ts`            | 5×2=10 RPC mock 호출, 응답 균등 비율(±20%)                                                                |
| Phase 3 | qualityFlags 빌드                                       | `packages/core/tests/quality-metadata.test.ts`                  | warn 4건 + sampling 130 → 모든 flag true                                                                  |
| Phase 3 | footer append                                           | (위와 동일)                                                     | flags 모두 false → footer 없음, 하나라도 true → footer 존재                                               |

### 6.3 회귀 방지

- 분기는 `useCollectorLoader=true` 안에서만 → 일반 경로 영향 없음.
- 일반 경로 기존 테스트 스위트 그대로 통과.
- `loadAnalysisInputFromCollector`의 fullset 추가는 비파괴적.

### 6.4 수동 검증 (배포 직후 1회)

1. 개발 환경(`localhost:3000`, BullMQ prefix `ais-dev`)에서 subscription 패턴 잡 1회 실행.
2. `collection_jobs` 최신 row의 `appliedPreset`, `limits`, `options.sources` 확인.
3. `article_jobs WHERE job_id = ?` 카운트 확인.
4. `analysis_reports.metadata` 의 `modulesPartial`, `warnings`, `qualityFlags` 키 존재 확인.
5. 보고서 페이지 배너 표시 확인 (rate-limit 발생 시).
6. 운영(`192.168.0.5:3300`)에서 동일 검증.

### 6.5 롤아웃 순서

| PR  | 내용                                                                                                                                                | 의존성           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| PR1 | `persistFromCollectorPayload` 신규 함수 + 단위 테스트 (호출 안 함)                                                                                  | 없음             |
| PR2 | collector API `fetchAnalysisPayload` procedure (기존 items.query 그대로)                                                                            | 없음 (병렬 가능) |
| PR3 | `loadAnalysisInputViaCollector` fullset 반환 + Phase 2 B-1 source별 분산 호출                                                                       | PR2              |
| PR4 | `triggerSubscription`이 appliedPreset/limits/sources 채움 + orchestrator가 persistFromCollectorPayload 호출 + **271 회귀 통합 테스트(머지 게이트)** | PR1, PR3         |
| PR5 | Phase 3 — buildQualityMetadata + 푸터 + UI 배너                                                                                                     | 없음 (병렬 가능) |
| PR6 | 추가 수동 검증 결과 반영 + 모니터링 지표 dashboard                                                                                                  | PR1–PR5          |

PR1–PR3은 호출 추가 없이 코드만 도입(머지해도 행동 불변). PR4에서 호출이 켜지며 행동 변경 — 이 단계에 271 회귀 테스트를 머지 게이트로 둔다.

### 6.6 롤백 계획

- PR4 의심 시: `pipeline-orchestrator.ts`의 `persistFromCollectorPayload` 호출 한 줄 주석 → 즉시 이전 동작.
- `triggerSubscription`의 추가 필드는 데이터 호환성 영향 없음 → 별도 롤백 불필요.
- PR5(Phase 3): 환경변수 `ENABLE_QUALITY_FOOTER=false`로 즉시 disable.

### 6.7 모니터링·검증 지표 (배포 후 1주)

- `useCollectorLoader=true` 잡 중 `article_jobs.count = 0`인 비율: **0%여야 함**.
- `analysis_reports` 신규 row 중 `metadata.qualityFlags.hasPartialModules=true` 비율: 추적용(이전엔 보이지 않던 신호).
- 분석 잡 평균 소요시간: 일반 경로(~41분) 변화 없음, 구독 경로(~4.5분)는 +30~90초 예상 — 임계 +5분 이내.

## 7. 다음 단계

이 spec이 승인되면 `superpowers:writing-plans` 스킬로 구현 계획서를 작성한다.
