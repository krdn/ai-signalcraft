# Manipulation Detection Phase 2 — 실데이터 통합 Design Spec

**작성일**: 2026-04-28
**상태**: 승인 대기
**전제**: Phase 1 (결정론적 7개 신호 파이프라인 + 가중평균 + persist) 완료, main merge됨

---

## 1. 목적

Phase 1에서 mock loader로만 검증된 manipulation detection 파이프라인을 **실제 timescaledb `raw_items` 데이터로 end-to-end 동작**하게 만든다. `runAnalysisPipeline`의 새로운 Stage 5로 통합되어, 구독 경로 분석 잡이 완료될 때 manipulation 분석이 자동 실행된다.

LLM Narrative 호출은 Phase 3로 분리한다 — 결정론 파이프라인을 실데이터로 안정화하는 것이 우선.

---

## 2. 결정 사항 (확정, 추가 협의 없음)

| 결정             | 내용                                                                                        | 근거                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **실행 위치**    | `runAnalysisPipeline`의 새로운 Stage 5                                                      | 결정론·짧은 실행시간(수십 초). 사용자는 단일 분석 실행으로 결과까지 보길 기대. 진행 표시·실패 추적이 다른 stage와 통일 |
| **실행 조건**    | `collection_jobs.options.runManipulation === true` AND `options.subscriptionId IS NOT NULL` | 키워드 단발 잡은 raw_items에 없으므로 자연스러운 제약. default OFF로 비용 0                                            |
| **데이터 로딩**  | collector `items.query` 재사용 + baselines 전용 신규 endpoint 1개                           | RAG와 무관하게 raw fullset 사용. RTT 3회 (comments+embeddings, articles+embeddings, baselines)                         |
| **Phase 2 범위** | LLM Narrative 제외 — Phase 3에서 별도 처리                                                  | 결정론 파이프라인 실데이터 안정화 먼저                                                                                 |
| **권한 경로**    | manipulation은 **구독 경로 한정**                                                           | subscriptionId가 구독 경로에서만 채워짐. 키워드 단발은 데이터 자체가 없음                                              |
| **격리 정책**    | Stage 5 실패가 본 분석 파이프라인에 영향 주지 않음                                          | try/catch + appendJobEvent로 격리. markRunFailed로 manipulation_runs에 실패 기록                                       |

---

## 3. 아키텍처

### 3.1 통합 위치

```
runAnalysisPipeline(jobId)
├─ Stage 0~4 (기존)
├─ awaitStageGate('analysis-stage4')
├─ Stage 5: Manipulation Detection (신규) — 본 design의 대상
│   ├─ shouldRunManipulation(jobOptions, subscriptionId) → bool
│   ├─ 게이트 통과 시:
│   │   ├─ resolveManipulationConfig(domain) ← seed-manipulation-configs (Phase 1)
│   │   ├─ buildCollectorDataLoader(jobId, subscriptionId, dateRange, sources)
│   │   ├─ runManipulationDetection({ jobId, subscriptionId, config, dateRange, loader }) ← Phase 1
│   │   └─ persistManipulationRun(...) ← Phase 1
│   └─ 게이트 미통과 또는 실패 시: appendJobEvent로 기록 후 통과
├─ 리포트 생성 (기존)
├─ 온톨로지 추출 (기존)
├─ 시리즈 델타 분석 (기존)
└─ 알림 평가 (기존)
```

Stage 5는 **리포트 생성 직전**에 위치. 리포트 본문에 manipulation 결과를 포함하지 않더라도 (Phase 3 UI에서 별도 표시), 시점 순서상 분석 결과가 모두 모인 후 실행되는 것이 안전하다.

### 3.2 모듈 구조

```
packages/core/src/analysis/manipulation/
├── (Phase 1 기존 파일 — 수정 없음)
├── loaders/
│   ├── collector-loader.ts          (신규) — CollectorDataLoader 구현
│   └── __tests__/
│       └── collector-loader.test.ts (신규)
└── stage5.ts                         (신규) — Stage 5 entry function

packages/core/src/analysis/
└── pipeline-orchestrator.ts          (수정) — Stage 5 호출 추가

packages/core/src/db/schema/
└── collections.ts                    (수정) — options 타입에 runManipulation 추가

apps/collector/src/server/trpc/
└── items.ts                          (수정) — fetchManipulationBaselines 엔드포인트 추가
```

---

## 4. 신규 collector 엔드포인트

`apps/collector/src/server/trpc/items.ts`에 추가.

### 4.1 입력 스키마

```ts
export const fetchManipulationBaselinesInput = z.object({
  subscriptionId: z.number().int().positive(),
  referenceEnd: z.string().datetime(), // 분석 윈도우 종료 시점
  days: z.number().int().min(7).max(60).default(30),
});
```

### 4.2 SQL 로직

```sql
WITH bucket AS (
  SELECT
    EXTRACT(HOUR FROM time AT TIME ZONE 'Asia/Seoul')::int AS hour,
    DATE(time AT TIME ZONE 'Asia/Seoul') AS day,
    COUNT(*)::int AS cnt
  FROM raw_items
  WHERE subscription_id = $1
    AND item_type = 'comment'
    AND time >= $2 - ($3 || ' days')::interval
    AND time <  $2 - INTERVAL '1 day'  -- 분석 윈도우 제외 (보수적으로 1일)
  GROUP BY hour, day
)
SELECT hour, array_agg(cnt ORDER BY day) AS counts
FROM bucket
GROUP BY hour
ORDER BY hour;
```

### 4.3 반환 스키마

```ts
{
  byHour: Record<string, number[]>; // "0".."23" → 일별 카운트 배열
}
```

Phase 1 `loadTemporalBaselines: (ctx) => Promise<Record<string, number[]>>` 인터페이스에 직결.

### 4.4 보안

`protectedProcedure` 사용 — 기존 `items.query`와 동일한 API 키 인증.

---

## 5. CollectorDataLoader 구현

### 5.1 시그니처

```ts
// packages/core/src/analysis/manipulation/loaders/collector-loader.ts

export type CollectorLoaderArgs = {
  client: CollectorClient;
  subscriptionId: number;
  sources: string[]; // collection_jobs.options.sources
  dateRange: { start: Date; end: Date };
  baselineDays: number; // config.baselineDays
};

export function createCollectorManipulationLoader(
  args: CollectorLoaderArgs,
): ManipulationDataLoader;
```

### 5.2 캐싱 전략

embedding 포함 댓글/기사 호출은 응답이 크므로 **동일 호출이 두 번 일어나지 않도록 lazy memo**:

```ts
let _comments: CommentRow[] | null = null;
let _embComments: EmbeddedItem[] | null = null;
let _embArticles: ArticleEmbedded[] | null = null;
let _baselines: Record<string, number[]> | null = null;
```

`loadComments`와 `loadVotes`는 같은 raw 결과에서 파생 — 1회 호출로 둘 다 채움.
`loadTrendSeries`도 댓글에서 5분 bucketing으로 파생.

### 5.3 호출 매핑

| 메서드                  | collector 호출                                                                                      | 변환                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `loadComments`          | `items.query({itemTypes:['comment'], includeEmbeddings:true, limit:10000})`                         | `time` → Date, 메모이즈                                 |
| `loadVotes`             | (재사용)                                                                                            | `length=content.length`, `likes=metrics.likeCount ?? 0` |
| `loadEmbeddedComments`  | (재사용)                                                                                            | `embedding`이 NULL인 행 필터링                          |
| `loadEmbeddedArticles`  | `items.query({itemTypes:['article','video'], includeEmbeddings:true, limit:10000})`                 | embedding NULL 필터링                                   |
| `loadTrendSeries`       | (재사용)                                                                                            | `comments` → 5분 bucket → `TrendPoint[]`                |
| `loadTemporalBaselines` | `items.fetchManipulationBaselines({subscriptionId, referenceEnd:dateRange.end, days:baselineDays})` | `byHour` → `Record<hour, number[]>`                     |

### 5.4 RTT 계산

- 1회: comments + embeddings (포함)
- 2회: articles+videos + embeddings
- 3회: baselines

총 **3 RTT**. baselineDays가 30일이어도 baselines 응답은 작음 (24개 hour × 일별 배열 = 720개 정수).

### 5.5 에러 처리

- 각 호출 실패 시 throw → 상위 Stage 5 try/catch가 `markRunFailed` 처리
- `AbortController`로 30초 timeout (collector 클라이언트 전반에 적용)

---

## 6. Stage 5 entry 함수

### 6.1 시그니처

```ts
// packages/core/src/analysis/manipulation/stage5.ts

export async function runStage5Manipulation(args: {
  jobId: number;
  jobOptions: Record<string, unknown>;
  domain: string;
  dateRange: { start: Date; end: Date };
}): Promise<void>;
```

### 6.2 실행 흐름

```
1. const subscriptionId = jobOptions.subscriptionId
   const runManipulation = jobOptions.runManipulation === true
   if (!runManipulation || !subscriptionId) return  // 무음 SKIP

2. appendJobEvent(jobId, 'info', 'manipulation 분석 시작')

3. try:
   const config = await resolveDomainConfig(jobOptions.manipulationDomainOverride ?? domain)
   const sources = jobOptions.sources ?? []  // 폴백: 빈 배열 → collector가 모든 소스
   const loader = createCollectorManipulationLoader({
     client: getCollectorClient(),
     subscriptionId,
     sources,
     dateRange,
     baselineDays: config.baselineDays,
   })
   const result = await runManipulationDetection({
     jobId,
     subscriptionId,
     config,
     dateRange,
     loader,
   })
   await persistManipulationRun(result, {
     jobId,
     subscriptionId,
     weightsVersion: `v1-${config.domain}`,
   })
   appendJobEvent(jobId, 'info', `manipulation 완료: score=${result.aggregate.manipulationScore.toFixed(1)}`)

4. catch (err):
   - 가능하면 markRunFailed(runId, err)
   - appendJobEvent(jobId, 'warn', `manipulation 실패: ${msg}`)
   - throw 하지 않음 → 본 파이프라인은 계속 진행
```

### 6.3 pipeline-orchestrator 수정

기존 코드:

```ts
// BP 게이트: AI 분석 Stage 4 완료 후
if (!(await awaitStageGate(jobId, 'analysis-stage4'))) { ... }

// 리포트 생성
const report = await generateFinalReport(...)
```

수정 후:

```ts
// BP 게이트: AI 분석 Stage 4 완료 후
if (!(await awaitStageGate(jobId, 'analysis-stage4'))) { ... }

// Stage 5: Manipulation Detection (옵션, 비차단)
await runStage5Manipulation({
  jobId,
  jobOptions,
  domain: ctx.input.domain,
  dateRange: { start: ..., end: ... },  // ctx.input의 윈도우 또는 cjRow.startedAt 기반
}).catch(err => logError('manipulation-stage5', err))

// 리포트 생성
const report = await generateFinalReport(...)
```

`runStage5Manipulation` 내부에서 이미 try/catch 처리하므로 외부 catch는 안전망일 뿐.

---

## 7. DB 스키마 변경

### 7.1 collections.ts options 타입 확장

```ts
options: jsonb('options').$type<{
  // ... 기존 필드들 ...
  runManipulation?: boolean;             // default false; ON일 때만 Stage 5 실행
  manipulationDomainOverride?: string;   // 도메인 강제 (테스트/디버그)
}>(),
```

**마이그레이션 불필요** — jsonb 컬럼이라 타입만 갱신.

### 7.2 manipulation 테이블 (Phase 1, 변경 없음)

`manipulation_runs`, `manipulation_signals`, `manipulation_evidence`, `manipulation_domain_configs` 4개 테이블은 Phase 1에서 이미 생성됨.

---

## 8. 테스트 전략

| 레벨            | 테스트                                                                                                                      | 위치                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Unit**        | `CollectorDataLoader` 변환 로직 — mock CollectorClient → 6개 loader 메서드 결과 검증 (메모이즈 검증 포함: 1회만 호출되는지) | `manipulation/loaders/__tests__/collector-loader.test.ts`                           |
| **Unit**        | Stage 5 게이트 — `runManipulation: false`일 때 SKIP, `subscriptionId` 없을 때 SKIP, 실패 시 본 파이프라인 영향 없음         | `manipulation/__tests__/stage5.test.ts`                                             |
| **Unit**        | collector 신규 endpoint — SQL 결과 모킹 후 반환 형식 검증                                                                   | `apps/collector/src/server/trpc/__tests__/items.fetchManipulationBaselines.test.ts` |
| **Integration** | dryrun 스크립트 확장 — 실 collector 호출로 1개 구독 end-to-end                                                              | `packages/core/scripts/manipulation-dryrun.ts` (확장)                               |
| **회귀**        | 기존 444 tests + 신규 모두 PASS                                                                                             | `pnpm test` 전체                                                                    |

dryrun 스크립트는 다음 인자 지원:

```
pnpm tsx scripts/manipulation-dryrun.ts --jobId=N --subscriptionId=M
```

- 실제 collector를 호출하여 6개 loader 결과 크기 출력
- 7개 신호 score 출력
- DB persist까지 수행 (dryrun 옵션으로 SKIP 가능)

---

## 9. 롤아웃 계획

### PR1: collector 신규 엔드포인트

- `apps/collector/src/server/trpc/items.ts`에 `fetchManipulationBaselines` 추가
- Unit test 추가
- collector 단독 배포 가능 (core/web 변경 없음)

### PR2: CollectorDataLoader + Stage 5 통합

- `loaders/collector-loader.ts` + `stage5.ts` 생성
- `pipeline-orchestrator.ts`에 Stage 5 호출 추가
- `collections.ts` options 타입 확장
- default OFF이므로 기존 동작에 영향 없음

### PR3: dryrun 스크립트 확장 + 운영 검증

- 실 collector 호출 로직
- 1개 구독으로 수동 검증 → 안정화 후 사용자가 옵션 ON

### Phase 3 (별도 spec)

- UI 토글 (subscription form)
- tRPC 엔드포인트로 manipulation 결과 조회
- LLM Narrative 모듈
- 시각화 컴포넌트

---

## 10. 명시적 비범위 (Out of Scope)

- **LLM Narrative** (`narrativeMd` 채우기) → Phase 3
- **UI / 시각화 컴포넌트** → Phase 3
- **도메인별 가중치 분기** (현재 political 단일) → Phase 4
- **S2 작성자 ID 신호** → Phase 4
- **manipulation 결과의 알림 통합** → Phase 4

---

## 11. 위험 요소 & 대응

| 위험                                              | 대응                                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| collector 호출 응답이 매우 큼 (구독에 100k+ 댓글) | `items.query`의 `limit`을 10000으로 클램프 + 메모이즈로 중복 호출 방지. 만약 부족하면 분할 페이지네이션은 Phase 3                   |
| baselines SQL이 큰 구독에서 느림                  | `(subscription_id, time)` 인덱스 이미 존재 (`raw_items_subscription_time_idx`). 그래도 느리면 `EXPLAIN`으로 확인 후 Phase 3 최적화  |
| Stage 5 실패가 본 파이프라인 결과 누락            | 이중 try/catch (entry 내부 + orchestrator 외부 .catch) + appendJobEvent로 가시성 확보                                               |
| 옵션을 잘못 켜서 비용 폭증                        | default OFF + 구독 경로 한정 + manipulation은 LLM 호출 0회(Phase 2 한정)이므로 실제 비용은 collector RTT 3회 + DB INSERT 4회 — 미미 |
| dateRange 추출 실패                               | `cjRow.startedAt` ~ `completedAt` 폴백, 둘 다 없으면 SKIP                                                                           |

---

## 12. 검증 체크리스트 (PR 머지 전)

- [ ] CollectorDataLoader 단위 테스트 PASS (메모이즈, 6개 메서드, 에러)
- [ ] Stage 5 게이트 단위 테스트 PASS
- [ ] collector 신규 endpoint 단위 테스트 PASS
- [ ] 기존 444 tests + 신규 PASS
- [ ] dryrun으로 실 구독 1건 end-to-end 성공 (manipulation_runs row 생성 확인)
- [ ] `pnpm lint` clean
- [ ] PR에 dryrun 결과 첨부

---

## 13. Phase 1 referenced files

- `packages/core/src/analysis/manipulation/runner.ts` — `runManipulationDetection`
- `packages/core/src/analysis/manipulation/persist.ts` — `persistManipulationRun`, `markRunFailed`
- `packages/core/src/analysis/manipulation/types.ts` — `ManipulationDataLoader`, `DomainConfig`, `CommentRow`, `EmbeddedItem`, `ArticleEmbedded`, `TrendPoint`
- `packages/core/src/db/seed-manipulation-configs.ts` — political 도메인 설정
- `packages/core/src/db/schema/manipulation.ts` — 4개 테이블 + `SIGNAL_TYPES`
