---
phase: 02-ai-analysis-engine-report
plan: 01
subsystem: database, ai, api
tags: [drizzle, postgresql, jsonb, ai-sdk, zod, analysis-pipeline]

# Dependency graph
requires:
  - phase: 01-foundation-core-data-collection
    provides: "collectionJobs, articles, videos, comments DB 스키마 + persist 패턴"
provides:
  - "analysisResults + analysisReports Drizzle DB 스키마"
  - "AnalysisModule 인터페이스 + AnalysisInput/AnalysisModuleResult 타입"
  - "MODULE_MODEL_MAP: 9개 모듈별 AI 프로바이더/모델 매핑"
  - "loadAnalysisInput: DB에서 수집 데이터 -> 분석 입력 변환"
  - "persistAnalysisResult/persistAnalysisReport: 분석 결과 upsert"
  - "AI Gateway systemPrompt + usage 반환 지원"
affects: [02-02, 02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnalysisModule 인터페이스 계약: name, displayName, provider, model, schema, buildPrompt, buildSystemPrompt"
    - "MODULE_MODEL_MAP: 모듈별 AI 모델 매핑 (openai=경량분석, anthropic=고급분석)"
    - "토큰 절약 패턴: 기사 본문 500자 제한, 댓글 좋아요순 상위 500개"
    - "AI Gateway 반환값 구조화: {text/object, usage, finishReason}"

key-files:
  created:
    - packages/core/src/db/schema/analysis.ts
    - packages/core/src/analysis/types.ts
    - packages/core/src/analysis/data-loader.ts
    - packages/core/src/analysis/persist-analysis.ts
    - packages/core/src/analysis/index.ts
    - packages/core/tests/analysis-schema.test.ts
  modified:
    - packages/core/src/db/schema/index.ts
    - packages/core/src/index.ts
    - packages/ai-gateway/src/gateway.ts

key-decisions:
  - "AIProvider 타입을 core 패키지에 로컬 정의 (ai-gateway 의존성 순환 방지)"
  - "analyzeText/analyzeStructured 반환값을 명시적 구조체로 변경 (기존 raw 반환 대신)"

patterns-established:
  - "AnalysisModule 인터페이스: 모든 분석 모듈이 따르는 공통 계약"
  - "MODULE_MODEL_MAP: 모듈별 AI 모델 중앙 관리"
  - "분석 결과 upsert: jobId+module unique constraint"

requirements-completed: [ANLZ-01, ANLZ-04, REPT-01]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 2 Plan 01: 분석 기반 인프라 Summary

**analysisResults/analysisReports DB 스키마, AnalysisModule 인터페이스 계약, 데이터 로더/persist 함수, AI Gateway systemPrompt+usage 확장**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T06:05:12Z
- **Completed:** 2026-03-24T06:10:50Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- analysisResults + analysisReports Drizzle 테이블 스키마 정의 (jobId+module unique index)
- AnalysisModule 인터페이스, AnalysisInput 타입, MODULE_MODEL_MAP (9개 모듈) 정의
- loadAnalysisInput: DB에서 수집 데이터를 분석 입력 형식으로 변환 (토큰 절약 포함)
- persistAnalysisResult/persistAnalysisReport: 분석 결과 upsert 함수 구현
- AI Gateway에 systemPrompt 옵션 추가 + usage 반환 구조화

## Task Commits

Each task was committed atomically:

1. **Task 1: 분석 DB 스키마 + AnalysisModule 인터페이스/타입 + 데이터 로더 + persist 함수** - `cfbb1d6` (feat, TDD)
2. **Task 2: AI Gateway 확장 -- systemPrompt + usage 반환** - `fb0d686` (feat)

## Files Created/Modified
- `packages/core/src/db/schema/analysis.ts` - analysisResults + analysisReports Drizzle 테이블 스키마
- `packages/core/src/analysis/types.ts` - AnalysisModule 인터페이스, AnalysisInput, MODULE_MODEL_MAP
- `packages/core/src/analysis/data-loader.ts` - DB에서 수집 데이터 로드 -> AnalysisInput 변환
- `packages/core/src/analysis/persist-analysis.ts` - 분석 결과/리포트 upsert 함수
- `packages/core/src/analysis/index.ts` - 배럴 export
- `packages/core/tests/analysis-schema.test.ts` - 스키마/타입/함수 export 검증 테스트 (8개)
- `packages/core/src/db/schema/index.ts` - analysis 스키마 export 추가
- `packages/core/src/index.ts` - analysis 모듈 export 추가
- `packages/ai-gateway/src/gateway.ts` - systemPrompt 옵션 + usage 반환 구조화

## Decisions Made
- AIProvider 타입을 core 패키지에 로컬 정의하여 ai-gateway 의존성 순환을 방지함 (ai-gateway 패키지와 동일한 `'anthropic' | 'openai'` union type)
- analyzeText/analyzeStructured 반환값을 `{text/object, usage, finishReason}` 명시적 구조체로 변경 (기존 raw AI SDK 결과 직접 반환 대신)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AIProvider 타입 import 경로 변경**
- **Found during:** Task 1 (types.ts 구현)
- **Issue:** Plan에서 `import type { AIProvider } from '@ai-signalcraft/ai-gateway'`를 지정했으나, core 패키지에 ai-gateway 워크스페이스 의존성이 없어 빌드 실패
- **Fix:** AIProvider 타입을 core/analysis/types.ts에 로컬 정의 (`type AIProvider = 'anthropic' | 'openai'`)
- **Files modified:** packages/core/src/analysis/types.ts
- **Verification:** `pnpm -r build` 성공
- **Committed in:** cfbb1d6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 의존성 순환 방지를 위한 필수 변경. 기능적 영향 없음.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 분석 DB 스키마와 인터페이스가 확립되어 Plan 02~03 (분석 모듈 구현) 진행 가능
- AI Gateway가 systemPrompt + usage 반환을 지원하여 모듈별 분석 호출 준비 완료
- loadAnalysisInput + persistAnalysisResult로 데이터 흐름 인프라 완성

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|
| - | - | - | - |

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | Plan이 명확한 구현 사양을 제공하여 추가 브레인스토밍 불필요 |
| superpowers:test-driven-development | TDD 프로세스를 직접 수행 (RED->GREEN 사이클 완료) |
| superpowers:systematic-debugging | 버그 미발생 (1건의 빌드 에러는 Rule 3으로 즉시 해결) |
| superpowers:requesting-code-review | 병렬 실행 환경에서 코드 리뷰 스킬 호출 생략 |

## Self-Check: PASSED

All 8 created/modified files verified present. Both task commits (cfbb1d6, fb0d686) verified in git log.

---
*Phase: 02-ai-analysis-engine-report*
*Completed: 2026-03-24*
