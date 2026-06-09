# 여론 조작 탐지 (Manipulation Detection) — 설계 문서

- **작성일**: 2026-04-27
- **상태**: 설계 승인 대기
- **소속**: Stage 5 (신규) — pipeline-orchestrator
- **결정 옵션 요약**: 통합형(D) · 점수+근거+시각화(D) · 7개 신호 · 혼합 아키텍처(C)

---

## 1. 목적

수집된 raw_items(기사·댓글·영상)에서 **여론 조작 의심 신호**를 탐지하고, **분석가가 검증 가능한 근거 카드**와 함께 0~100 의심도 점수를 산출한다. 조작 여부를 단정하지 않고 **약한 신호 다수의 조합**으로 의심도를 제시하는 보수적 접근을 취한다.

### 비목표 (1차 범위 외)

- 자동 알림 시스템 (Stage 6 검토)
- 작성자 ID 클러스터링 (S2 — 데이터 품질·법적 리스크로 보류)
- 가중치 튜닝 UI (1차는 SQL 직접 수정)
- 실시간 스트리밍 탐지 (collection_jobs 완료 후 batch만)
- 도메인별 가중치 분기 (Phase 4로 이연)
- 외부 인플루언서·봇넷 데이터 연동

---

## 2. 아키텍처 개요

```
[Stage 1~4 분석 완료] → [Stage 5: Manipulation Detection]
                            │
        ┌───────────────────┼─────────────────────┐
        ↓                   ↓                     ↓
  Statistical Signals  Embedding Signals    Aggregator
  (S1, S4, S6, S8)    (S3, S5, S7)          (TS, 결정적)
        │                   │                     │
        └────────┬──────────┘                     │
                 ↓                                ↓
         manipulation_signals             manipulation_runs
         manipulation_evidence            (점수·서사 저장)
                                                  │
                                                  ↓
                                    LLM Narrative (1회 호출)
                                    manipulation-summary 모듈
```

**의존성 방향**: 기존과 동일 — `web → core → collectors/ai-gateway`. Stage 5는 `packages/core/src/analysis/manipulation/`에 신규 생성.

**혼합 처리(C 결정)**:

- 통계 신호: SQL/TS로 결정론적 계산
- 임베딩 신호: pgvector HNSW + n-gram 교차 검증 (LLM 없음)
- 종합 해석만 LLM (1회 호출, 단정 표현 금지 prompt)

---

## 3. 7개 탐지 신호

모든 신호의 공통 출력:

```typescript
type SignalResult = {
  signal: SignalType;
  score: number; // 0~100
  confidence: number; // 0~1, 데이터 충분성
  evidence: EvidenceCard[];
  metrics: Record<string, number>;
};
```

### S1 — Burst Detection (시간 분포)

- **입력**: `raw_items` where `item_type='comment'`, `parent_source_id`별 그룹화
- **계산**: 부모 게시물별 댓글 timestamp를 5분 bucket으로 양자화 → 평소 분포(중앙값·MAD) 대비 z-score
- **점수**: max z-score를 sigmoid로 0~100 매핑
- **임계**: z ≥ 4 → score ≥ 70
- **시각화**: 타임라인 히트맵 (`BurstHeatmap`)

### S3 — Text Similarity (Copy-Paste / Talking Points)

- **입력**: 분석 기간 댓글·기사 임베딩 (기존 384차원)
- **계산**: HNSW 인덱스로 코사인 ≥ 0.92 클러스터 추출 → 5-gram Jaccard ≥ 0.6로 재확인 (임베딩 거짓 매치 제거)
- **점수**: 클러스터 크기·작성자 다양성·시간 범위로 가중
- **부가 출력**: 클러스터별 source 분포 (S7 입력)
- **시각화**: 클러스터 카드 (`SimilarityCluster`)

### S4 — Vote Anomaly (추천수 이상)

- **입력**: 커뮤니티 댓글의 `likeCount`, `dislikeCount`, `time`
- **계산**: 게시물별 좋아요 분포 IQR 이상치 + 댓글 길이로 회귀한 잔차 + 작성 후 N분 내 추천 급등
- **점수**: 이상치 비율·잔차 합산
- **데이터 갭**: 네이버는 추천 미수집 → 적용 source만 점수, confidence 비율 반영
- **시각화**: 산점도 (Recharts ScatterChart)

### S5 — Media Sync (매체 동조화)

- **입력**: `item_type='article'` 기사 제목·요약 임베딩
- **계산**: 30분 슬라이딩 윈도우 내 다른 publisher 간 코사인 ≥ 0.88 페어 → 동일 클러스터 매체 수 N
- **점수**: N·시간 압축도 가중
- **임계**: N ≥ 3매체 동시 → score ≥ 65
- **시각화**: 매체 타임라인 (`MediaSyncTimeline`)

### S6 — Trend Shape (인공 트렌드)

- **입력**: 시간별 mention count (기존 `dailyMentionTrend` 쿼리 재활용)
- **계산**: 1차 차분 변동계수 + 변화점 탐지(PELT 또는 ratio rule)
- **점수**: jump ratio (peak / pre-peak baseline) × 평탄도
- **시각화**: 시계열 라인 + 변화점 마커 (Recharts LineChart 확장)

### S7 — Cross-Platform (S3 후처리)

- **입력**: S3가 만든 유사도 클러스터
- **계산**: 클러스터별 `source` 다양성(2개 이상) + 시간 순서 cascade
- **점수**: 플랫폼 수 × 캐스케이드 짧을수록 가점
- **비용**: ~0 (S3 결과 reduce)
- **시각화**: Sankey/Flow 다이어그램 (`CrossPlatformFlow`)

### S8 — Temporal Anomaly (시간대 분포)

- **입력**: 댓글 timestamp 시간대(0~23시) 히스토그램
- **계산**: 분석 기간 분포 vs 해당 source baseline(과거 30일) KL divergence
- **점수**: KL ≥ 1.0 → score ≥ 70
- **시각화**: 24시간 막대 + baseline 오버레이 (Recharts BarChart)

### 보류 — S2 작성자 ID 클러스터링

1차 제외. author 필드 익명/null 비율 높음(메모리 기록), 법적 리스크 큼. Phase 4 검토.

---

## 4. 종합 점수 (Aggregator)

```typescript
manipulationScore = clamp(
  weightedAvg([
    s1.score * 0.18, // burst
    s3.score * 0.22, // similarity
    s4.score * 0.14, // vote
    s5.score * 0.16, // media-sync
    s6.score * 0.1, // trend
    s7.score * 0.12, // cross-platform
    s8.score * 0.08, // temporal
  ]) * confidenceFactor,
  0,
  100,
);
```

- 가중치는 **DB 시드 테이블**(`manipulation_domain_configs`)로 관리, 코드 상수 아님
- `confidenceFactor` = 모든 신호 confidence 평균 (데이터 부족 시 자동 하향)
- 1차 출시: political 가중치를 모든 도메인에 동일 적용

**해석 밴드:**

- 0~30: 정상
- 31~55: 약한 의심 (관찰 권장)
- 56~75: 다수 신호 동조 (검토 필요)
- 76~100: 강한 조작 패턴 (저널리즘·조사 가치)

---

## 5. 증거 카드 + 시각화

### EvidenceCard 형태

```typescript
type EvidenceCard = {
  id: string;
  signal: SignalType;
  severity: 'low' | 'medium' | 'high';
  title: string; // "5분간 동일 문구 27회 반복"
  summary: string;
  visualization: VisualizationSpec;
  rawRefs: { itemId: string; source: string; time: string; excerpt: string }[];
};
```

### 시각화 매핑

| 신호 | 컴포넌트                   | 종류              |
| ---- | -------------------------- | ----------------- |
| S1   | `BurstHeatmap` (신규)      | 타임라인 히트맵   |
| S3   | `SimilarityCluster` (신규) | 클러스터 카드     |
| S4   | Recharts `ScatterChart`    | 산점도            |
| S5   | `MediaSyncTimeline` (신규) | 매체 타임라인     |
| S6   | Recharts `LineChart` 확장  | 시계열 + 변화점   |
| S7   | `CrossPlatformFlow` (신규) | Sankey 다이어그램 |
| S8   | Recharts `BarChart`        | 24시간 막대       |

신규 컴포넌트 4종(S1, S3, S5, S7), Recharts 활용 3종(S4, S6, S8).

### 추적성 (legal-safe)

- 모든 카드는 `rawRefs[]`로 `raw_items.id` 직접 참조 — 클릭 시 원문 modal
- 카드 텍스트는 **관찰된 패턴**만 기술 ("X회 출현"), 단정 표현 금지
- LLM 서사 prompt에 "조작이다·확실하다" 등 단정 표현 금지 명시

### 리포트 페이지 — `/subscriptions/[id]/runs/[runId]/manipulation`

- 상단: 의심도 게이지 + 신호 기여도 가로 막대
- 중단: LLM 서사 (3-5문단)
- 하단: 증거 카드 그리드 (severity 내림차순) + 신호별 상세 탭

---

## 6. DB 스키마

### `manipulation_runs`

```typescript
{
  id: uuid (pk),
  jobId: integer (fk collection_jobs),
  subscriptionId: integer,
  startedAt, completedAt: timestamp,
  status: 'running' | 'completed' | 'failed',
  manipulationScore: real,
  confidenceFactor: real,
  weightsVersion: text,
  signalScores: jsonb,
  narrativeMd: text,
  errorDetails: jsonb,
}
```

인덱스: `(subscriptionId, startedAt DESC)`, `(jobId)`

### `manipulation_signals` (run당 7행)

```typescript
{
  id: uuid (pk),
  runId: uuid (fk ON DELETE CASCADE),
  signal: text enum,
  score: real,
  confidence: real,
  metrics: jsonb,
  computeMs: integer,
}
```

인덱스: `(runId, signal)` UNIQUE

### `manipulation_evidence` (run당 수십~수백 행)

```typescript
{
  id: uuid (pk),
  runId: uuid (fk ON DELETE CASCADE),
  signal: text,
  severity: text enum,
  title: text,
  summary: text,
  visualization: jsonb,
  rawRefs: jsonb,
  rank: integer,
}
```

인덱스: `(runId, severity, rank)`, GIN on `rawRefs`

### `manipulation_domain_configs` (시드)

```typescript
{
  domain: text (pk),
  weights: jsonb,         // { burst: 0.18, similarity: 0.22, ... }
  thresholds: jsonb,      // { burst: { medium: 50, high: 70 }, ... }
  baselineDays: integer,
  narrativeContext: text,
}
```

### 마이그레이션

- `pnpm db:push`로 4개 테이블 신규 생성
- `seed-presets.ts` 패턴으로 `manipulation_domain_configs` 시드 추가 — 1차에는 political 가중치 row 1개만 (다른 도메인은 fallback으로 political 사용)
- 기존 `raw_items`·`analysis_results` 변경 없음
- TimescaleDB UNIQUE 이슈 무관 (일반 pgTable)

---

## 7. 데이터 흐름

```
1. collection_jobs 완료 (Stage 1~4 결과 저장)
2. pipeline-orchestrator: Stage 5 트리거
   - skipModule['manipulation'] 또는 options.enableManipulationDetection=false 시 스킵
3. ManipulationRunner:
   a. INSERT manipulation_runs (status=running)
   b. 7개 신호 병렬 계산 (Promise.all + concurrency 4)
   c. 각 신호 결과 → batch INSERT manipulation_signals + manipulation_evidence
   d. Aggregator: 가중 평균으로 manipulationScore 계산
   e. LLM Narrative: 점수+top 10 evidence summary → manipulation-summary 모듈 → narrativeMd
   f. UPDATE manipulation_runs (score, narrative, status=completed)
4. 웹: tRPC `manipulation.getByRun(runId)` → run+signals+evidence 조회
```

### 비용·성능 가드

- 임베딩 신호(S3, S5)는 raw_items 표본 한도: 1만 items 초과 시 시간 stratified sampling
- LLM 호출은 **1회만** (top 10 evidence 요약, 토큰 ~2k)
- `collection_jobs.costLimitUsd` 게이트가 Stage 5 진입 차단
- ManipulationRunner는 collection_jobs.options.skippedModules에 'manipulation' 포함 시 스킵

---

## 8. 도메인 결합

**원칙**: 신호 계산은 공통, 가중치·해석은 도메인별 (Phase 4에서 분기)

| 도메인    | 강조 신호   | 약화 신호            |
| --------- | ----------- | -------------------- |
| political | S5, S7      | -                    |
| fandom    | S1, S4      | S6 (자연 burst 흔함) |
| corporate | S5, S3      | -                    |
| finance   | S3, S6      | S7                   |
| 그 외     | 기본 가중치 | -                    |

1차 출시: political 가중치를 모든 도메인에 단일 적용. 운영 데이터 누적 후 Phase 4에서 도메인별 분기.

---

## 9. 구독 통합

1. **구독 폼**: `subscription-form`에 "조작 탐지 분석 포함" 토글 추가, 기본 OFF (opt-in)
2. **자동 실행**: `subscription.options.enableManipulationDetection=true`이면 collection_jobs.options에 전파 → Stage 5 트리거
3. **수동 실행**: `/subscriptions/[id]/runs/new`에서 체크박스로 단발 실행
4. **결과 노출**:
   - 구독 상세 페이지에 "조작 의심도 추이" 카드 (`subscription-trend-chart` 옆)
   - 알림 시스템은 2차 (Phase 5+)

### 권한·표시 가드

- 점수 옆 "(분석가용 신호 — 단정 결론 아님)" 면책 라벨 상시
- 76점 이상 카드는 공유·내보내기 시 워터마크 자동 추가
- 가중치 튜닝은 admin role + SQL 직접 (1차 UI 없음)

---

## 10. 테스트 게이트

### Tier 1 — 신호 계산 단위 테스트 (필수)

- 위치: `packages/core/src/analysis/manipulation/__tests__/`
- 7개 신호 각각 fixture → score·confidence·evidence count 매치
- Burst: 정상/약/강 burst 3종 fixture
- Similarity: copy-paste 쌍 fixture (cosine 0.95+) → 클러스터 크기 ≥ N
- Vote: IQR 이상치 합성 데이터 → 식별 정확도
- Aggregator: 7개 점수 → 가중평균 ±1 오차

### Tier 2 — 통합 회귀 테스트 (필수)

- 실 운영 raw_items 스냅샷 1개 → manipulation_runs 골든 비교
- 비교 대상: signalScores, manipulationScore, evidence 카드 수 (텍스트 제외)
- 골든 파일: `__tests__/fixtures/run-<jobid>.golden.json`
- 271 회귀 게이트 패턴 따름

### Tier 3 — DB 스키마 게이트

- `pnpm db:push --dry-run` 후 4개 테이블·인덱스 존재 확인
- ON DELETE CASCADE 동작 검증

### Tier 4 — UI 스모크 (선택)

- `/subscriptions/[id]/runs/[runId]/manipulation` 200 + 게이지 렌더링
- 증거 카드 "원문 보기" → raw_items modal

---

## 11. 롤아웃 단계

### Phase 1 — Foundation (1주차)

- DB 스키마 4개 테이블
- ManipulationRunner 골격 + 7개 신호 계산
- Aggregator
- Tier 1 단위 테스트
- 외부 노출 없음, 내부 dryRun CLI

### Phase 2 — Pipeline 통합 (2주차)

- pipeline-orchestrator Stage 5 연결
- LLM Narrative (manipulation-summary 모듈, 단정 표현 금지 prompt)
- collection_jobs.options 토글 추가, default OFF
- Tier 2 회귀 게이트 활성화
- Tier 3 스키마 게이트

### Phase 3 — UI · 시각화 (3주차)

- `/subscriptions/[id]/runs/[runId]/manipulation` 페이지
- 시각화 컴포넌트 7종 (Recharts 3 + 신규 4)
- 구독 폼 토글 노출
- 면책 라벨·워터마크
- Tier 4 스모크

### Phase 4 — 튜닝 · 도메인 분기 (출시 후 2~4주)

- 운영 데이터 누적 → 가중치 도메인별 분기
- False Positive 사례 수집 → 임계치 조정
- S2 작성자 ID 신호 추가 검토

---

## 12. 위험 요소 + 완화

| 위험                             | 완화                                                   |
| -------------------------------- | ------------------------------------------------------ |
| 자연 burst 오탐 (팬덤·뉴스 속보) | confidence factor + 도메인 가중치(Phase 4) + 면책 라벨 |
| 임베딩이 보도자료 베끼기를 잡음  | n-gram Jaccard 교차 검증 + S5는 다른 publisher 한정    |
| LLM 서사 단정 표현               | system prompt 명시 + 출력 후 키워드 필터               |
| 비용 폭증                        | sampling 한도 + costLimitUsd 게이트 + LLM 1회          |
| 법적 리스크 (특정 ID 지목)       | S2 보류 + rawRefs 내부만 + 워터마크                    |
| 가중치 변경 후 비교 불가         | manipulation_runs.weightsVersion 기록                  |

---

## 13. 파일 구조 (신규)

```
packages/core/src/analysis/manipulation/
├── runner.ts                     # ManipulationRunner (오케스트레이션)
├── aggregator.ts                 # 가중 평균 계산
├── types.ts                      # SignalResult, EvidenceCard, VisualizationSpec
├── signals/
│   ├── burst.ts                  # S1
│   ├── similarity.ts             # S3 (S7 부가 출력 포함)
│   ├── vote.ts                   # S4
│   ├── media-sync.ts             # S5
│   ├── trend-shape.ts            # S6
│   └── temporal.ts               # S8
├── modules/
│   └── manipulation-summary.ts   # LLM Narrative 모듈
├── schemas/
│   └── manipulation-summary.schema.ts
└── __tests__/
    ├── burst.test.ts
    ├── similarity.test.ts
    ├── vote.test.ts
    ├── media-sync.test.ts
    ├── trend-shape.test.ts
    ├── temporal.test.ts
    ├── aggregator.test.ts
    └── fixtures/
        └── run-<jobid>.golden.json

packages/core/src/db/schema/
└── manipulation.ts               # 4개 테이블

apps/web/src/app/subscriptions/[id]/runs/[runId]/manipulation/
└── page.tsx                      # 리포트 페이지

apps/web/src/components/manipulation/
├── manipulation-gauge.tsx        # 의심도 게이지
├── signal-contribution-bars.tsx  # 신호 기여도 막대
├── evidence-card-grid.tsx        # 증거 카드 그리드
├── burst-heatmap.tsx             # 신규
├── similarity-cluster.tsx        # 신규
├── media-sync-timeline.tsx       # 신규
├── cross-platform-flow.tsx       # 신규
└── disclaimer-badge.tsx          # 면책 라벨

apps/web/src/server/routers/
└── manipulation.ts               # tRPC 라우터
```

---

## 14. 결정 요약

| 결정 사항         | 선택                                |
| ----------------- | ----------------------------------- |
| 탐지 범위         | D — 통합형 (단계별)                 |
| 출력 형태         | D — 점수+근거+시각화 (알림 추후)    |
| 신호 선택         | 1, 3, 4, 5, 6, 7-축소, 8 (S2 보류)  |
| 처리 아키텍처     | C — 혼합 (통계+임베딩+LLM 1회)      |
| 정규화 vs jsonb   | 정규화 (3개 신규 테이블 + 1개 시드) |
| 1차 도메인 가중치 | political 단일 적용 (Phase 4 분기)  |
| 구독 통합         | opt-in 토글 (default OFF)           |
| 알림              | 2차 (D 결정)                        |

---

## 15. 다음 단계

이 spec이 승인되면 **writing-plans** 스킬로 Phase 1~3의 구체적 구현 계획을 작성한다.
