---
phase: 04-expansion-advanced-analysis
plan: 02
subsystem: analysis
tags: [zod, ai-sdk, analysis-pipeline, approval-rating, frame-war, crisis-scenario, win-simulation]

# Dependency graph
requires:
  - phase: 02-ai-analysis-engine
    provides: "8개 기본 분석 모듈 + 3단계 파이프라인 + 통합 리포트 생성기"
provides:
  - "4개 고급 분석 Zod 스키마 (approval-rating, frame-war, crisis-scenario, win-simulation)"
  - "4개 고급 분석 모듈 (AnalysisModule 인터페이스 구현)"
  - "runner.ts Stage 4 확장 (병렬+순차 ADVN 실행)"
  - "generator.ts 고급 분석 섹션 선택적 통합"
affects: [04-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Stage 4 ADVN 병렬+순차 파이프라인", "선택적 리포트 섹션 통합"]

key-files:
  created:
    - packages/core/src/analysis/schemas/approval-rating.schema.ts
    - packages/core/src/analysis/schemas/frame-war.schema.ts
    - packages/core/src/analysis/schemas/crisis-scenario.schema.ts
    - packages/core/src/analysis/schemas/win-simulation.schema.ts
    - packages/core/src/analysis/modules/approval-rating.ts
    - packages/core/src/analysis/modules/frame-war.ts
    - packages/core/src/analysis/modules/crisis-scenario.ts
    - packages/core/src/analysis/modules/win-simulation.ts
    - packages/core/tests/advn-schema.test.ts
  modified:
    - packages/core/src/analysis/types.ts
    - packages/core/src/analysis/schemas/index.ts
    - packages/core/src/analysis/modules/index.ts
    - packages/core/src/analysis/runner.ts
    - packages/core/src/report/generator.ts
    - packages/core/tests/analysis-schema.test.ts

key-decisions:
  - "ADVN 모듈은 모두 anthropic/claude-sonnet-4-20250514 모델 사용"
  - "Stage 4 실행 전 기본 리포트 생성 후, ADVN 완료 시 재생성으로 기존 리포트 안전 보장"
  - "CrisisScenarioSchema에 z.tuple로 3개 시나리오 타입 순서 강제"

patterns-established:
  - "Stage 4 ADVN 패턴: STAGE4_PARALLEL(독립) + STAGE4_SEQUENTIAL(의존) 분리"
  - "선택적 리포트 섹션: advnResults.length === 0이면 추가 없음"

requirements-completed: [ADVN-01, ADVN-02, ADVN-03, ADVN-04]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 04 Plan 02: 고급 분석 모듈 Summary

**4개 고급 분석 모듈(AI 지지율/프레임 전쟁/위기 시나리오/승리 시뮬레이션) Zod 스키마 + Stage 4 파이프라인 통합**

## Performance

- **Duration:** 6min
- **Started:** 2026-03-24T10:45:54Z
- **Completed:** 2026-03-24T10:52:00Z
- **Tasks:** 2 (TDD: RED+GREEN+verify)
- **Files modified:** 15

## Accomplishments
- 4개 고급 분석 Zod 스키마 구현 (ApprovalRating, FrameWar, CrisisScenario, WinSimulation)
- 4개 고급 분석 모듈이 AnalysisModule 인터페이스를 구현하고 buildPromptWithContext로 선행 결과 참조
- runner.ts에 Stage 4(4a 병렬 + 4b 순차) 파이프라인 확장
- generator.ts에 고급 분석 섹션 선택적 통합 (결과 없으면 기존 리포트 유지)
- 15개 Zod 스키마 검증 테스트 전체 통과

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: 4개 스키마 검증 테스트** - `69dde2e` (test)
2. **Task 1 GREEN: 4개 스키마 + 4개 모듈 구현** - `bdee3ea` (feat)
3. **Task 2: runner Stage 4 + 리포트 통합** - `6519ded` (feat)

## Files Created/Modified
- `packages/core/src/analysis/schemas/approval-rating.schema.ts` - AI 지지율 추정 Zod 스키마
- `packages/core/src/analysis/schemas/frame-war.schema.ts` - 프레임 전쟁 Zod 스키마
- `packages/core/src/analysis/schemas/crisis-scenario.schema.ts` - 위기 시나리오 Zod 스키마 (3개 tuple)
- `packages/core/src/analysis/schemas/win-simulation.schema.ts` - 승리 시뮬레이션 Zod 스키마
- `packages/core/src/analysis/modules/approval-rating.ts` - AI 지지율 추정 모듈
- `packages/core/src/analysis/modules/frame-war.ts` - 프레임 전쟁 분석 모듈
- `packages/core/src/analysis/modules/crisis-scenario.ts` - 위기 시나리오 모듈
- `packages/core/src/analysis/modules/win-simulation.ts` - 승리 시뮬레이션 모듈
- `packages/core/src/analysis/types.ts` - MODULE_MODEL_MAP, MODULE_NAMES 확장
- `packages/core/src/analysis/schemas/index.ts` - 4개 ADVN 스키마 export 추가
- `packages/core/src/analysis/modules/index.ts` - 4개 ADVN 모듈 export 추가
- `packages/core/src/analysis/runner.ts` - Stage 4 파이프라인 로직 추가
- `packages/core/src/report/generator.ts` - 고급 분석 섹션 선택적 통합
- `packages/core/tests/advn-schema.test.ts` - 15개 Zod 스키마 검증 테스트
- `packages/core/tests/analysis-schema.test.ts` - MODULE_MODEL_MAP 카운트 업데이트 (9->13)

## Decisions Made
- ADVN 모듈은 모두 anthropic/claude-sonnet-4-20250514 모델 사용 (전략적 분석에 적합)
- Stage 4 실행 전에 기본 리포트(Stage 1~3)를 먼저 생성하고, ADVN 완료 시 재생성하여 기존 리포트 안전 보장
- CrisisScenarioSchema에 z.tuple 사용으로 3개 시나리오(spread/control/reverse) 순서와 타입 강제

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 기존 analysis-schema.test.ts MODULE_MODEL_MAP 카운트 수정**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** 기존 테스트가 MODULE_MODEL_MAP.length === 9를 기대하나 ADVN 4개 추가로 13이 됨
- **Fix:** expectedModules에 4개 ADVN 모듈 추가, 카운트를 13으로 업데이트
- **Files modified:** packages/core/tests/analysis-schema.test.ts
- **Committed in:** bdee3ea

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** 기존 테스트 호환성 유지를 위한 필수 수정. 스코프 변경 없음.

## Issues Encountered
None

## User Setup Required
None - 외부 서비스 설정 불필요.

## Known Stubs
None - 모든 모듈이 완전히 구현됨.

## Next Phase Readiness
- 4개 ADVN 모듈이 파이프라인에 통합되어 Stage 4로 실행 가능
- 대시보드(04-03-PLAN)에서 고급 분석 결과를 표시할 준비 완료

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|
| - | - | - | - |

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 플랜이 상세하게 명시되어 추가 브레인스토밍 불필요 |
| superpowers:test-driven-development | TDD 플로우를 직접 수행 (RED->GREEN 패턴 적용) |
| superpowers:systematic-debugging | 버그 미발생 |
| superpowers:requesting-code-review | 병렬 실행 에이전트로 코드 리뷰 스킬 호출 불가 |

## Self-Check: PASSED

- All 10 key files: FOUND
- All 3 commit hashes: FOUND (69dde2e, bdee3ea, 6519ded)
- Tests: 15/15 passed

---
*Phase: 04-expansion-advanced-analysis*
*Completed: 2026-03-24*
