---
phase: 08-core
plan: 01
subsystem: core
tags: [error-handling, logger, provider-keys, refactoring]

# Dependency graph
requires:
  - phase: 07-collector
    provides: 'BaseCollector 추상화 완료, 안정적 코드 기반'
provides:
  - 'SignalCraftError 계층 에러 클래스 (5개)'
  - 'createLogger 팩토리 함수'
  - 'provider-keys.ts CRUD/테스트 분리 (443줄 -> 164줄 + 264줄)'
affects: [08-02, 08-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    ['계층형 에러 클래스 패턴 (SignalCraftError > 도메인별 Error)', 'createLogger 팩토리 패턴']

key-files:
  created:
    - packages/core/src/utils/errors.ts
    - packages/core/src/utils/logger.ts
    - packages/core/src/analysis/provider-test.ts
  modified:
    - packages/core/src/utils/index.ts
    - packages/core/src/analysis/provider-keys.ts
    - packages/core/src/analysis/index.ts

key-decisions:
  - '에러 클래스를 utils/errors.ts에 배치 (별도 errors/ 디렉토리 불필요)'
  - 'createLogger는 console 래핑 수준으로 간결 구현 (외부 로깅 라이브러리 미도입)'

patterns-established:
  - 'SignalCraftError > CollectionError/AnalysisError/PipelineError/ProviderError 계층'
  - 'createLogger(moduleName) 팩토리로 [module] prefix 자동 부여'
  - 'barrel export로 분할 파일의 기존 import 경로 유지'

requirements-completed: [CORE-02, CORE-04]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 8 Plan 1: 에러 클래스/로거 도입 + provider-keys 분할 Summary

**SignalCraftError 5개 계층 에러 클래스 + createLogger 팩토리 생성, provider-keys.ts를 CRUD(164줄)/테스트(264줄)로 분할**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T00:33:08Z
- **Completed:** 2026-03-27T00:36:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- SignalCraftError 계층 5개 클래스 생성 (errorCode, context 필드 포함)
- createLogger 팩토리 함수 생성 (info/warn/error 레벨, 모듈 prefix 자동)
- provider-keys.ts 443줄을 CRUD 164줄 + 테스트 264줄로 분리
- barrel export 유지로 기존 import 경로 호환성 보장

## Task Commits

Each task was committed atomically:

1. **Task 1: 에러 클래스 계층 + 구조화 로거 생성** - `d5bb0e8` (feat)
2. **Task 2: provider-keys.ts CRUD/테스트 분리** - `f129ef5` (refactor)

## Files Created/Modified

- `packages/core/src/utils/errors.ts` - SignalCraftError 계층 5개 에러 클래스
- `packages/core/src/utils/logger.ts` - createLogger 팩토리 함수
- `packages/core/src/utils/index.ts` - errors, logger barrel export 추가
- `packages/core/src/analysis/provider-test.ts` - testProviderConnection, chatWithProvider, getDefaultBaseUrl 분리
- `packages/core/src/analysis/provider-keys.ts` - CRUD 5개 함수만 잔존 (443줄 -> 164줄)
- `packages/core/src/analysis/index.ts` - provider-test barrel export 추가

## Decisions Made

- 에러 클래스를 utils/errors.ts에 배치 (별도 errors/ 디렉토리 불필요 -- 파일 1개로 충분)
- createLogger는 console 래핑 수준으로 간결 구현 (pino/winston 등 외부 라이브러리 미도입)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- tsc --noEmit에서 drizzle-orm/zod 모듈 미발견 에러 발생 -- worktree에 node_modules 미설치 상태의 기존 에러로 신규 파일과 무관. 신규 파일(errors.ts, logger.ts, provider-test.ts)에서는 TS 에러 없음 확인

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - 모든 코드가 실제 동작하는 구현체.

## Next Phase Readiness

- errors.ts, logger.ts가 준비되어 Plan 02(runner 분할), Plan 03(worker-process 분할)에서 활용 가능
- provider-test.ts 분리 완료로 CORE-02 요건 충족

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                                  |
| ----------------------------------- | ------------------------------------------------------------ |
| superpowers:brainstorming           | 순수 리팩토링 작업으로 요구사항 명확 -- brainstorming 불필요 |
| superpowers:test-driven-development | 기존 코드 분할만 수행, 새 기능 구현 없음                     |
| superpowers:systematic-debugging    | 버그 미발생                                                  |
| superpowers:requesting-code-review  | 2개 Task 단순 분할 작업으로 코드 리뷰 불필요                 |

---

_Phase: 08-core_
_Completed: 2026-03-27_
