# Token Optimization Presets — Design Spec

## Overview

수집된 기사가 많을 때 LLM 분석 비용(토큰)이 급증하는 문제를 해결하기 위해, 분석 실행 전에 전처리 단계를 추가한다. 사용자는 4단계 프리셋(없음/경량/표준/강력) 중 하나를 선택하여 비용-품질 트레이드오프를 제어한다.

## Problem

- Stage 1 모듈 4개가 동일한 전체 데이터를 중복 수신 (4x 중복)
- 5개 소스에서 동일 이슈를 중복 보도하는 기사들이 모두 분석 대상
- 댓글 최대 500건이 그대로 프롬프트에 포함
- 최악 시나리오: 기사 100건 + 댓글 500건 → ~118K 입력 토큰 (Stage 1만)

## Solution

수집 완료 후, Stage 1 실행 전에 **전처리 파이프라인**을 삽입한다.

```
수집 → [전처리: 중복 제거 + 클러스터링 + 댓글 압축] → Stage 1 → Stage 2 → ...
```

### Preset Definitions

| 파라미터         | 없음 (none)     | 경량 (light)  | 표준 (standard) | 강력 (aggressive)     |
| ---------------- | --------------- | ------------- | --------------- | --------------------- |
| 중복 제거        | OFF             | 유사도 > 0.95 | 유사도 > 0.90   | 유사도 > 0.85         |
| 클러스터링       | OFF             | OFF           | OFF             | ON (대표 기사만 분석) |
| 분석용 댓글 상한 | 전체 (최대 500) | 200건         | 100건           | 50건                  |
| 예상 절감률      | 0%              | ~30%          | ~60%            | ~80%                  |

### Deduplication

임베딩 기반 의미적 중복 제거. `@xenova/transformers`(이미 설치됨)로 로컬 임베딩 생성 후 코사인 유사도 비교. 임계값 이상이면 중복으로 판정하고 대표 기사만 유지.

- 임베딩 모델: `Xenova/multilingual-e5-small` (한국어 지원, 로컬 실행, 비용 0원)
- 대표 기사 선정: 클러스터 내 가장 긴 본문을 가진 기사
- 중복 기사의 메타데이터(출처 수, 시간 분포)는 대표 기사에 어노테이션으로 보존

### Clustering (강력 모드만)

그리디 클러스터링(임베딩 유사도 기반 단일 링크)으로 유사 기사를 그룹화. 외부 라이브러리 없이 중복 제거에서 이미 계산한 유사도 행렬을 재활용한다. 클러스터당 대표 1건만 전체 분석, 나머지는 "이 이슈는 N개 매체에서 보도" 메타데이터로 축약.

### Comment Compression

좋아요순 정렬 후 프리셋별 상한까지만 분석에 포함. 기존 `data-loader.ts`의 MAX_COMMENTS(500)를 프리셋 값으로 오버라이드.

## UI Design

### Trigger Form (trigger-form.tsx)

기존 "수집 한도 설정" Collapsible을 **"수집 한도 & 토큰 최적화"**로 확장.

**Collapsible 헤더:**

- 라벨: "수집 한도 & 토큰 최적화"
- 최적화 프리셋이 "없음"이 아니면 뱃지 표시: `표준 ~60%↓`
- 기본값: 닫힘 상태

**Collapsible 내부:**

1. 수집 한도 (기존 4개 입력 그리드 — 변경 없음)
2. 구분선
3. "토큰 최적화" 라벨
4. 4단계 프리셋 버튼 그리드 (없음/경량/표준/강력)
   - 각 버튼에 이름 + 예상 절감률
   - 선택된 버튼은 프리셋 색상 테두리 + 배경
5. 선택된 프리셋 설명 박스 (border-left 강조)

**프리셋 기본값:** "없음" (기존 동작과 동일)

**프리셋별 색상:**

- 없음: muted (회색)
- 경량: green (#4ade80)
- 표준: yellow (#eab308)
- 강력: orange (#f97316)

### Pipeline Monitor

수집 완료 → **토큰 최적화** → Stage 1 순서로 표시.

전처리 완료 시 통계: `87건 → 54건 (38%↓) · 댓글 412 → 100건`

전처리가 "없음"이면 이 단계는 표시하지 않음 (스킵).

## Data Flow

### 1. UI → tRPC → DB

```typescript
// trigger-form.tsx 상태
const [optimizationPreset, setOptimizationPreset] =
  useState<'none' | 'light' | 'standard' | 'aggressive'>('none');

// mutationFn input
options: {
  enableItemAnalysis?: boolean;
  tokenOptimization?: 'none' | 'light' | 'standard' | 'aggressive';
}
```

### 2. tRPC Input Schema

```typescript
// analysis.ts trigger input
options: z.object({
  enableItemAnalysis: z.boolean().optional(),
  tokenOptimization: z.enum(['none', 'light', 'standard', 'aggressive']).optional(),
}).optional(),
```

### 3. DB Schema

```typescript
// collections.ts — collectionJobs.options
options: jsonb('options').$type<{
  enableItemAnalysis?: boolean;
  tokenOptimization?: 'none' | 'light' | 'standard' | 'aggressive';
}>(),
```

스키마 변경은 jsonb 내부이므로 마이그레이션 불필요 (`pnpm db:push`만 실행).

### 4. Pipeline Orchestrator

```typescript
// pipeline-orchestrator.ts — Stage 1 실행 전
// preprocessAnalysisInput은 AnalysisInput을 받아 AnalysisInput을 반환 (동일 타입)
// 기사/댓글 배열이 줄어든 AnalysisInput — 다운스트림 모듈 변경 불필요
if (tokenOptimization && tokenOptimization !== 'none') {
  const optimizedInput: AnalysisInput = await preprocessAnalysisInput(
    input,
    tokenOptimization,
    jobId,
  );
  // optimizedInput으로 Stage 1 실행
}
```

### 5. Preprocessing Module (신규)

```
packages/core/src/analysis/preprocessing/
├── index.ts              — public API
├── presets.ts            — 프리셋 상수 정의
├── deduplicator.ts       — 임베딩 기반 중복 제거
├── clusterer.ts          — 클러스터링 (강력 모드)
├── comment-compressor.ts — 댓글 압축
└── embeddings.ts         — @xenova/transformers 임베딩 래퍼
```

### 6. Progress Tracking

전처리 통계를 `collectionJobs.progress` jsonb에 기록:

```typescript
await updateJobProgress(jobId, {
  'token-optimization': {
    status: 'completed',
    phase: 'preprocessing',
    originalArticles: 87,
    optimizedArticles: 54,
    originalComments: 412,
    optimizedComments: 100,
    reductionPercent: 38,
    preset: 'standard',
  },
});
```

## Architecture Boundaries

- `packages/core/src/analysis/preprocessing/` — 전처리 로직 전체
- `packages/core/src/analysis/pipeline-orchestrator.ts` — 전처리 호출 삽입 (Stage 1 전)
- `packages/core/src/analysis/data-loader.ts` — 변경 없음 (전처리가 loadAnalysisInput 이후에 동작)
- `packages/ai-gateway/` — 변경 없음 (임베딩은 로컬 모델 사용)
- `apps/web/src/components/analysis/trigger-form.tsx` — UI 추가
- `apps/web/src/server/trpc/routers/analysis.ts` — input schema 확장
- `packages/core/src/db/schema/collections.ts` — options 타입 확장

## Error Handling

- 전처리 실패 시: 원본 데이터로 폴백하여 Stage 1 계속 진행 (전처리는 best-effort)
- 임베딩 모델 로드 실패: 중복 제거/클러스터링 스킵, 댓글 압축만 적용
- progress에 실패 상태 기록, 콘솔 경고 출력

## Testing

- presets.ts: 프리셋 상수 단위 테스트
- deduplicator.ts: 알려진 중복 기사 세트로 중복 제거 검증
- comment-compressor.ts: 상한 적용 검증
- pipeline-orchestrator.ts 통합: 프리셋별 전처리 → Stage 1 연결 검증
- trigger-form.tsx: 프리셋 선택 UI 상호작용 테스트

## Out of Scope

- 세부 파라미터 UI 조절 (향후 설정 페이지에서 추가 가능)
- 프롬프트 캐싱 (별도 작업으로 ai-gateway에서 처리)
- 배치 API (별도 작업)
- RAG/pgvector (장기 과제)
- 결과 페이지에서 전처리 통계 표시 (모니터 실시간 표시로 충분)
