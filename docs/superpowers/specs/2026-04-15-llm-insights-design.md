# LLM 인사이트 페이지 설계 스펙

> **작성일**: 2026-04-15  
> **목적**: 선택된 분석 작업 기반 LLM 모델 현황·문제점·추천·비용을 대시보드에서 바로 확인

---

## 1. 개요

사이드바에 **"LLM 인사이트"** 독립 메뉴를 추가한다.  
선택된 분석 작업(jobId) 기준으로 사용된 AI 모델 정보, 문제점, 업그레이드 추천, 토큰 비용을 탭 형태로 표시한다.  
향후 분석 모델 설정 결정에 참고하는 것이 목적이다.

---

## 2. 위치 및 접근

### 사이드바 메뉴

- **위치**: 기존 고급 분석(index 5), 탐색(index 6) 옆에 **index 7** 로 추가
- **아이콘**: `BrainCircuit` (lucide-react)
- **레이블**: "LLM 인사이트"
- **활성화 조건**: 현재 결과 탭(`RESULT_TAB_INDICES`)과 동일하게 `activeJobId`가 있을 때만 활성화
  - `ADVANCED_ITEMS` 배열에 추가
- **비활성 상태**: jobId 없으면 흐리게(muted) 표시, 클릭 불가

### 탭 패널

`dashboard/page.tsx`의 `panels` 배열에 `<LlmInsightsTab>` 추가 (index 7)

---

## 3. 페이지 구조

```
LlmInsightsView
├── 헤더: "LLM 인사이트" + Job 제목/ID
└── 탭 4개 (shadcn Tabs)
    ├── 모델 현황    — 이 Job에서 사용된 모듈별 모델
    ├── 문제점 진단  — 사용된 모델의 약점 경고
    ├── 업그레이드 추천 — 모듈별 최고/보통/최소 대안
    └── 토큰 비용   — 모듈별 실제 토큰 사용량 + USD
```

---

## 4. 데이터 소스

### 4-1. 모델 현황 / 문제점 진단 / 업그레이드 추천

`analysisResults` 테이블의 `usage` 컬럼에서 `provider`, `model` 추출.  
모듈명은 `moduleName` 컬럼 사용.

```ts
// tRPC 엔드포인트 신규 추가
llmInsights.getModuleModels(jobId) →
  Array<{ moduleName, provider, model, stage }>
```

**문제점 진단 로직** (프론트엔드 정적 계산):

- `docs/llm-model-recommendations.md` 데이터를 코드 상수로 반영
- 현재 모델 vs 그룹 추천 모델 비교 → 경고 배지 자동 생성
  - 한국어 성능: `중` 또는 `하` 이면 `⚠️ 한국어 뉘앙스 제한`
  - 다운그레이드: 추천 최소 티어보다 낮으면 `⚠️ 추천 미달`

**업그레이드 추천 데이터**: `llm-model-recommendations.md` Part 2의 모듈 추천 매트릭스를 상수 파일로 정리

### 4-2. 토큰 비용

`analysisResults` 테이블의 `usage` 컬럼에서 `inputTokens`, `outputTokens` 추출.  
`cost-calculator.ts`의 `calculateCost()` 함수로 USD 계산.

```ts
// tRPC 엔드포인트 신규 추가
llmInsights.getTokenCosts(jobId) →
  Array<{ moduleName, provider, model, inputTokens, outputTokens, costUsd }>
  + total: { inputTokens, outputTokens, costUsd }
```

---

## 5. 탭별 UI 상세

### 탭 1: 모델 현황

- Stage별 섹션으로 그룹핑 (Stage 1 / Stage 2 / Stage 4)
- 모듈 카드 그리드 (2열)
- 각 카드: 모듈명 + 프로바이더 배지(색상) + 모델명 배지

**프로바이더 배지 색상**:
| 프로바이더 | 색상 |
|-----------|------|
| anthropic | 황색 (`fef3c7 / 92400e`) |
| gemini | 청색 (`dbeafe / 1d4ed8`) |
| openai | 녹색 (`dcfce7 /166534`) |
| deepseek | 보라 (`ede9fe / 6b21a8`) |

### 탭 2: 문제점 진단

- 문제 없는 모듈: 녹색 체크 `✅ 정상`
- 문제 있는 모듈: 경고 카드로 강조
  - 경고 유형별 배지: `한국어 뉘앙스 제한`, `추천 미달`, `컨텍스트 한계`
- 상단 요약: "N개 모듈에서 주의 필요"

### 탭 3: 업그레이드 추천

- 모듈별 현재 모델 → 추천 모델 (최고/보통/최소 3열)
- 교체 이유 텍스트 표시
- 현재 모델과 추천이 동일한 경우 `✅ 최적` 표시

### 탭 4: 토큰 비용

- 테이블: 모듈명 / 모델 / 입력 토큰 / 출력 토큰 / 비용(USD)
- 하단 합계 행
- 상단 KPI 3개: 총 입력 토큰 / 총 출력 토큰 / 총 비용 USD

---

## 6. 빈 상태 처리

`activeJobId === null` 이면:

- 탭 컨텐츠 대신 "분석을 먼저 선택하세요" 안내
- 사이드바 메뉴 항목 비활성(muted, 클릭 불가) — 기존 결과 탭과 동일 방식

---

## 7. 신규 파일 목록

| 파일                                                               | 설명               |
| ------------------------------------------------------------------ | ------------------ |
| `apps/web/src/components/llm-insights/llm-insights-view.tsx`       | 메인 뷰 컴포넌트   |
| `apps/web/src/components/llm-insights/model-overview-tab.tsx`      | 모델 현황 탭       |
| `apps/web/src/components/llm-insights/problem-diagnosis-tab.tsx`   | 문제점 진단 탭     |
| `apps/web/src/components/llm-insights/upgrade-suggestions-tab.tsx` | 업그레이드 추천 탭 |
| `apps/web/src/components/llm-insights/token-cost-tab.tsx`          | 토큰 비용 탭       |
| `apps/web/src/components/llm-insights/llm-recommendation-data.ts`  | 추천 데이터 상수   |

---

## 8. 수정 파일 목록

| 파일                                             | 변경 내용                                                |
| ------------------------------------------------ | -------------------------------------------------------- |
| `apps/web/src/app/dashboard/page.tsx`            | panels 배열에 index 7 추가, LlmInsightsTab 컴포넌트 추가 |
| `apps/web/src/components/layout/app-sidebar.tsx` | ADVANCED_ITEMS에 LLM 인사이트(index 7) 추가              |
| `apps/web/src/server/routers/llm-insights.ts`    | tRPC 라우터 신규 (getModuleModels, getTokenCosts)        |
| `apps/web/src/server/routers/index.ts`           | llmInsights 라우터 등록                                  |

---

## 9. 구현 제약

- `llm-recommendation-data.ts` 에 추천 데이터를 **정적 상수**로 관리 (DB 불필요)
- `cost-calculator.ts`의 `calculateCost()` 재사용 (중복 구현 금지)
- `MODULE_META` (module-meta.ts) 재사용으로 모듈 표시명 통일
- 프로바이더 배지 색상은 기존 `PROVIDER_REGISTRY` 활용
