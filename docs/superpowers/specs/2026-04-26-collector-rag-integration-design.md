# 구독 분석에서 collector RAG 통합 (P2+P4)

작성일: 2026-04-26
이전 세션: P3(시계열 통계 progress 기록), P1(RAG 폴백 시계열 균등) 완료
이 spec의 범위: 구독 단축 경로에서 의미 검색 부활 + 데이터 손실 축소

## 배경 (운영 측정 사실)

job 266 (오세훈, 7일, rag-standard) 측정:

```
collector raw_items (4/16~4/23, subscription 440)
  기사 2,291  /  댓글 21,461  /  영상 582     ← 24,334개 수집
       ↓ collector items.query (mode='all', limit=2000+5000)
입력 단계
  기사   351  /  댓글  1,750  /  영상  71    ← 8.9% 통과
       ↓ 분석 측 RAG (article_jobs INNER JOIN → 0건 매치)
       ↓ 폴백 (P1으로 시계열 균등 적용 완료, but 의미 검색은 여전히 무효)
모듈 입력
  기사   130  /  댓글   200  /  영상  71    ← 1.6% 도달
```

**핵심 문제**: 분석 측 RAG가 articles 테이블을 검색하지만 구독 경로는 articles에 INSERT 안 함 → RAG가 통째로 폴백으로 떨어짐. P1으로 폴백 출력은 개선됐지만 의미 검색 자체는 여전히 무효.

## 결정적 발견 (이 세션 측정)

1. **collector raw_items에 이미 RAG 모드 구현됨** — `apps/collector/src/server/trpc/items.ts:150-163` `mode: 'rag'` + `embedQuery` + ivfflat 인덱스
2. **collector raw_items 임베딩 NULL률**: 기사·영상 0%, 댓글 2.13% (subscription 440 기준) — 분석 DB 댓글 NULL률 29%와 대조
3. **IVFFlat 인덱스 성능**: lists=100, 384차원, 51만 행. 7일 600건 추출 137ms (운영 실측). 문제없음
4. **분석 측 RAG는 사실상 죽은 코드**: 구독 경로에서 articles_jobs/comment_jobs INSERT 0건 (운영 잡 4건 측정 확인)

따라서 P2(데이터 손실)와 P4(RAG 살리기)는 **하나의 변경**으로 동시 해결됨: 분석 측 RAG를 **collector mode='rag' 호출로 대체**.

## 설계 결정 (이미 확정)

### Q1. 시간 분포 vs 의미 관련성 → **둘 다**

- collector RAG topK = RAG 한도 × 3 (예: rag-standard 한도 130/200 → collector 호출 400/600)
- 의미 관련 풀에서 분석 측 stratifiedSample로 시계열 균등 후샘플 → 130/200 최종 입력
- 의미 우선 + 시간 균등 결합

### Q2. preset 라벨 → **코드값에 맞춰 정정**

- `presets.ts:80` "기사 30+10/댓글 30" 라벨이 잘못됨. 코드값(130/200) 유지하고 라벨만 수정
- "DB 임베딩으로 의미 관련 기사 130, 댓글 200건 선별" 로 변경

### 폴백 정책

- collector RAG가 비어 반환할 경우(이론상 거의 없음) → 기존 mode='all' fall-through로 데이터 손실 방지
- topK 미달 시(예: 7일 동안 의미 관련 항목이 100개뿐) → 그 100개 + mode='all' 시간 균등 보충

## 구현 변경 계획

### 변경 파일 (예상)

1. **`packages/core/src/analysis/data-loader.ts`**
   - `loadAnalysisInputFromCollector` 내 `client.items.query.query` 호출을 RAG 모드로
   - `mode: 'rag'`, `ragOptions: { topK: target * 3, semanticQuery: keyword }`
   - 댓글은 별도 호출 (현 구조 유지) → topK는 댓글 한도 × 3
   - 영상은 ragOptions 적용 — collector가 itemType 무관하게 cosine 정렬
   - **RAG 부족 시 보충 호출** (현 limit 결과의 80% 미만이면 mode='all'로 추가 fetch + 중복 제거)

2. **`packages/core/src/analysis/preprocessing/rag-retriever.ts`**
   - 구독 단축 경로(`useCollectorLoader: true`)에서 `ragRetrieve` 우회
   - 또는 `ragRetrieve` 자체에 "이미 collector RAG 거쳤으면 시계열 균등 후샘플만" 분기 추가
   - 권장: `pipeline-orchestrator.ts`의 `preprocessAnalysisInput` 호출 부분에서 분기. RAG 우회 시 stratifiedSample만 호출해 한도 내로 컷

3. **`packages/core/src/analysis/preprocessing/presets.ts:80`**
   - description 라벨 정정 (코드값과 일치)

4. **`apps/collector/src/server/trpc/items.ts`**
   - 변경 없음 (mode='rag'가 이미 동작)

### 시그니처 / 데이터 흐름

```typescript
// data-loader.ts (변경 후 의사코드)
async function loadAnalysisInputFromCollector(opts) {
  const articleVideoTopK = (presetArticleLimit + presetClusterReps) * 3;
  const commentTopK = presetCommentLimit * 3;

  // 1. 의미 관련 풀 (collector RAG)
  const [avRagResp, commentRagResp] = await Promise.all([
    client.items.query.query({
      ...,
      itemTypes: ['article', 'video'],
      mode: 'rag',
      ragOptions: { topK: articleVideoTopK, semanticQuery: opts.keyword },
      limit: articleVideoTopK,
    }),
    client.items.query.query({
      ...,
      itemTypes: ['comment'],
      mode: 'rag',
      ragOptions: { topK: commentTopK, semanticQuery: opts.keyword },
      limit: commentTopK,
    }),
  ]);

  // 2. RAG가 부족하면 mode='all'로 보충 (시간 분포 보존용)
  // 부족 = RAG가 반환한 items.length < 요청한 ragOptions.topK * 0.8
  if (avRagResp.items.length < articleVideoTopK * 0.8) {
    const fillResp = await client.items.query.query({ mode: 'all', limit: 2000, ... });
    // 중복 제거 키: source + sourceId + itemType (raw_items_dedup_uniq와 동일)
  }

  // 3. 시계열 budget 계산 + applyTimeSeriesSampling으로 한도 내로
  // 기존 코드 그대로 (P3·P1 결과 활용)
}
```

```typescript
// pipeline-orchestrator.ts (변경 후 의사코드)
const usingCollectorRag = options?.useCollectorLoader || jobOptions.useCollectorLoader;

if (tokenOptimization !== 'none' && !usingCollectorRag) {
  // 분석 측 RAG는 N:M 경로(legacy)에서만
  await preprocessAnalysisInput(input, tokenOptimization, jobId, ...);
}
// 구독 경로는 이미 collector RAG로 의미 정렬됐으므로 분석 측 RAG 스킵
```

### 테스트 계획

1. **단위**:
   - `data-loader.ts` mock collector로 RAG 응답 → AnalysisInput 변환 검증
   - RAG 부족 시 mode='all' 보충 + 중복 제거 동작 검증
   - `presets.ts` 라벨 변경은 lint·snapshot만

2. **통합**:
   - 새 단위 테스트 `tests/p4-collector-rag.test.ts`: mock collector가 의미 정렬된 결과 반환 → final input의 항목들이 모두 RAG 응답에서 옴
   - 기존 P1 스모크(`p1-fallback-smoke.test.ts`)는 그대로 — 비구독(legacy N:M) 경로의 RAG 폴백 검증 의미 유지. 구독 경로는 collector RAG로 교체되어 분석 측 폴백을 거의 안 거침

3. **운영 검증** (적용 후):

   ```sql
   -- 새 구독 분석 1건 실행 후
   SELECT progress->'sampling' FROM collection_jobs WHERE id = ?;
   SELECT jsonb_array_length(result->'dailyMentionTrend')
     FROM analysis_results WHERE job_id = ? AND module = 'macro-view';
   -- 기대: dailyMentionTrend 일자 수 = 분석 기간 일수 (또는 그에 근접)
   --       progress.sampling.articles.binsUsed = 분석 기간 일수
   ```

4. **A/B 비교**:
   - 같은 키워드를 P3·P1만 적용된 잡 / P2·P4까지 적용된 잡 두 번 분석
   - macro-view·sentiment-framing 결과의 키워드 다양성, 변곡점 식별 정확도 비교
   - 토큰 사용량 비교 (`analysis_results.usage`)

## 리스크와 완화

| 리스크                                           | 완화                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| RAG topK\*3 호출이 collector 부하                | 측정 137ms — 충분. 단 동시 분석 N건 시 monitoring 필요                              |
| 임베딩 결과가 시간 편향(폭증일 의미 항목이 많음) | topK\*3 받아 시계열 후샘플로 균등화                                                 |
| 분석 측 rag-retriever가 다른 경로에서도 호출     | grep 확인: `pipeline-orchestrator.ts:223` 한 곳만. 다른 호출자 없음                 |
| 캐시 키 변경 없으면 기존 결과 재사용             | 새 키워드 실행으로 검증, 또는 `AIS_MODULE_CACHE=off`. 본질적 해결은 H4(다른 spec)   |
| collector mode='rag' 응답 형식 호환성            | items.ts:158-163 응답이 mode='all'과 동일 schema. 추가 필드 `_distance` 무시하면 됨 |

## 미진행 — 별도 spec

- H4: 캐시 키에 모델/프리셋 반영
- H1: 본문 500자 cut을 프리셋 controllable로 (P2+P4와 결합 시 효과 측정 후 결정)
- H3: dailyMentionTrend sentimentRatio가 collector sentiment 컬럼을 활용하도록

## 진행 권장 순서 (다음 세션)

1. 변경 파일 목록 재확인 (이 spec 기준)
2. `data-loader.ts` mode='rag' + topK\*3 + 보충 호출 구현
3. `pipeline-orchestrator.ts` 분석 측 RAG 우회 분기
4. `presets.ts` 라벨 정정
5. 단위 테스트 추가
6. core 타입체크 / vitest / lint 통과
7. 운영 1건 실행 + 검증 쿼리 실행
8. A/B 비교 결과 보고서

예상 변경 라인 수: ~80~120줄 (테스트 포함 ~200줄)
