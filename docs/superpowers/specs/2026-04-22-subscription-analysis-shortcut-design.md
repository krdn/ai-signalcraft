# 구독 기반 분석 단축 경로 + 전용 페이지 설계

## Context

구독 모드로 분석 실행 시, collector 서비스가 이미 수집+정규화+감정분석을 완료한 데이터를 두고도 `collect → normalize → persist → classify → analysis` 전체 파이프라인을 재실행하는 비효율이 있음. `subscriptionId`는 `collection_jobs.options`에 저장만 되고 파이프라인에서 사용되지 않음. 또한 구독 분석 UX가 대시보드 탭 내에 있어 전용 워크플로우 제공이 불가능함.

**목표:** 구독 모드에서 수집+정규화+감정분석을 건너뛰고 AI 분석만 실행하며, 전용 페이지에서 마법사 UI로 제공.

---

## 1. 백엔드 — 구독 분석 단축 경로

### 1.1 tRPC — `analysis.triggerSubscription` 신규 mutation

**파일:** `apps/web/src/server/trpc/routers/analysis.ts`

```
입력: { subscriptionId, startDate, endDate, domain?, optimizationPreset?, enabledModules? }
처리:
  1. 구독 검증 (활성 + 소유자) — 기존 로직 재사용
  2. collection_jobs INSERT — options에 { subscriptionId, skipItemAnalysis: true } 저장
  3. triggerSubscriptionAnalysis(jobId, keyword) 호출
  4. jobId 반환
```

기존 `analysis.trigger`에서 `subscriptionId` 분기 제거. 일반/구독 경로 완전 분리.

### 1.2 BullMQ — `triggerSubscriptionAnalysis()` 신규 함수

**파일:** `packages/core/src/queue/flows.ts`

- `collection_jobs` INSERT 후 `analysis` 큐에 `run-analysis` 잡 직접 등록
- FlowProducer 없이 단일 잡만 생성 (collect/normalize/persist/classify 잡 생성 안 함)
- 잡 데이터에 `{ dbJobId, keyword, useCollectorLoader: true }` 전달

### 1.3 Data Loader — subscriptionId 전달 복원

**파일:** `packages/core/src/analysis/data-loader.ts`

`loadAnalysisInputViaCollector()` 수정:
- `collection_jobs.options`에서 `subscriptionId` 읽기
- `loadAnalysisInputFromCollector()`에 `subscriptionId` 전달
- collector API가 해당 구독 데이터만 필터링해서 반환

### 1.4 Pipeline Orchestrator — Stage 0 스킵

**파일:** `packages/core/src/analysis/pipeline-orchestrator.ts`

- 잡 데이터에 `useCollectorLoader: true`이면 항상 collector loader 사용
- `collection_jobs.options.skipItemAnalysis === true`이면 Stage 0(analyzeItems) 스킵
- 도메인 정규화 → 토큰 최적화 → Stage 1~4 → 리포트 생성만 실행

---

## 2. 프론트엔드 — 전용 페이지

### 2.1 라우트

**경로:** `/subscriptions/analyze` (`apps/web/src/app/subscriptions/analyze/page.tsx`)

### 2.2 마법사 구조 (4단계)

```
Step 1: 구독 선택
  - 활성 구독 카드 그리드 (keyword, sources, domain 표시)
  - 선택 시 하이라이트 + "다음" 버튼 활성화

Step 2: 분석 설정
  - 분석 기간 (date range picker)
  - 도메인 (자동 감지 + 수동 변경)
  - 토큰 최적화 프리셋 (rag-standard 기본)
  - 분석 모듈 선택 (Stage 4 고급 모듈 on/off)
  - "분석 실행" 버튼

Step 3: 실행 중
  - 기존 PipelineMonitor 컴포넌트 재사용
  - SSE 실시간 진행 상태
  - 단계: 데이터 로드 → 토큰 최적화 → AI 분석 → 리포트

Step 4: 결과
  - 기존 ReportView 컴포넌트 재사용
  - 리포트 + 차트 + PDF 내보내기
  - "새 분석" 버튼으로 Step 1 복귀
```

### 2.3 컴포넌트 구성

```
apps/web/src/app/subscriptions/analyze/
  page.tsx                       — 마법사 상태 관리 (step, subscriptionId, jobId)

apps/web/src/components/subscriptions/analyze/
  analyze-wizard.tsx             — 4단계 스텝퍼 + 레이아웃
  subscription-select-step.tsx   — Step 1: 구독 카드 그리드
  analysis-config-step.tsx       — Step 2: 분석 설정 폼
  analysis-running-step.tsx      — Step 3: PipelineMonitor 래핑
  analysis-result-step.tsx       — Step 4: ReportView 래핑
```

### 2.4 핵심 원칙

- 기존 컴포넌트 최대 재사용 (`PipelineMonitor`, `ReportView`, `usePipelineStatus`)
- 구독 선택 후 키워드/소스는 읽기 전용 (잠금)
- TriggerForm 로직을 새 설정 폼으로 단순화 (구독 전용 불필요 옵션 제거)
- subscriptions/layout.tsx 내비게이션에 "분석 실행" 링크 추가

---

## 3. 변경 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `apps/web/src/server/trpc/routers/analysis.ts` | `triggerSubscription` mutation 추가, 기존 trigger에서 subscriptionId 분기 제거 |
| `packages/core/src/queue/flows.ts` | `triggerSubscriptionAnalysis()` 신규 함수 |
| `packages/core/src/analysis/data-loader.ts` | `loadAnalysisInputViaCollector()`에 subscriptionId 전달 |
| `packages/core/src/analysis/pipeline-orchestrator.ts` | collector loader 조건부 사용, Stage 0 스킵 로직 |
| `packages/core/src/queue/analysis-worker.ts` | 잡 데이터에서 useCollectorLoader 읽기 |
| `apps/web/src/app/subscriptions/analyze/page.tsx` | 신규: 마법사 페이지 |
| `apps/web/src/components/subscriptions/analyze/*` | 신규: 5개 마법사 컴포넌트 |
| `apps/web/src/app/subscriptions/layout.tsx` | 내비게이션에 "분석 실행" 링크 추가 |

---

## 4. 검증 방법

1. `/subscriptions/analyze` 페이지 접속 → 활성 구독 카드 표시 확인
2. 구독 선택 → 분석 설정 → 실행 → BullMQ에 `run-analysis` 잡만 생성되는지 확인 (collect/normalize/persist/classify 잡 없음)
3. collector API에서 해당 subscriptionId의 데이터가 로드되는지 확인
4. Stage 0(analyzeItems)이 스킵되고 Stage 1부터 시작하는지 확인
5. SSE 진행 상태가 정상 표시되는지 확인
6. 리포트 생성 완료 후 결과 탭에서 정상 표시 확인
7. 기존 일반 분석(`analysis.trigger`)이 영향 없이 정상 작동 확인
