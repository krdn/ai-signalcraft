---
phase: 05-integration-flow-gap-closure
plan: 01
subsystem: api, database, auth
tags: [bullmq, drizzle, zod, nextauth, trpc, upsert]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: CollectionTriggerSchema, triggerCollection, BullMQ Flow
  - phase: 02-analysis-engine
    provides: persistAnalysisReport, analysisReports schema
  - phase: 03-dashboard-team
    provides: login-form, team router, invitations schema
  - phase: 04-expansion-advanced-analysis
    provides: 소스 체크박스 UI, ADVN 모듈
provides:
  - sources 필드 기반 선택적 수집기 실행 (INT-01)
  - analysisReports jobId upsert로 리포트 갱신 (INT-02)
  - callbackUrl 기반 로그인 리다이렉트 (FLOW-01)
  - getPendingInvites DB 레벨 acceptedAt 필터
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'enabledSources 기반 조건부 BullMQ Flow children 생성'
    - 'onConflictDoUpdate로 리포트 upsert 패턴'
    - 'useSearchParams + Suspense로 callbackUrl 처리'
    - 'isNull() DB 레벨 필터로 JS 후처리 대체'

key-files:
  created: []
  modified:
    - packages/core/src/types/index.ts
    - packages/core/src/queue/flows.ts
    - apps/web/src/server/trpc/routers/analysis.ts
    - packages/core/src/db/schema/analysis.ts
    - packages/core/src/analysis/persist-analysis.ts
    - apps/web/src/components/auth/login-form.tsx
    - apps/web/src/app/login/page.tsx
    - apps/web/src/server/trpc/routers/team.ts
    - packages/core/tests/queue.test.ts
    - packages/core/tests/report.test.ts
    - packages/core/tests/db.test.ts

key-decisions:
  - 'sources 필드를 optional로 추가하여 기존 호출 하위 호환 유지'
  - 'onConflictDoUpdate target을 jobId uniqueIndex로 설정'
  - 'JS .filter() 후처리를 isNull() DB 레벨 쿼리로 대체'

patterns-established:
  - 'enabledSources 패턴: params.sources ?? ALL_SOURCES로 기본값 처리'
  - 'Suspense boundary: useSearchParams 사용 컴포넌트는 반드시 Suspense 래핑'

requirements-completed:
  - COLL-01
  - COLL-02
  - COLL-03
  - COLL-04
  - COLL-06
  - COLL-07
  - COLL-08
  - FOUND-03
  - ADVN-01
  - ADVN-02
  - ADVN-03
  - ADVN-04
  - REPT-01
  - TEAM-01
  - TEAM-03

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 5 Plan 1: Integration/Flow Gap Closure Summary

**감사 갭 3건(INT-01, INT-02, FLOW-01) 해소 -- sources 선택적 수집, 리포트 upsert, callbackUrl 리다이렉트, acceptedAt DB 필터**

## Performance

- **Duration:** 4min
- **Started:** 2026-03-24T12:20:56Z
- **Completed:** 2026-03-24T12:25:30Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- CollectionTriggerSchema에 sources optional 필드를 추가하고 triggerCollection이 선택한 소스만 Flow children에 포함하도록 변경
- analysisReports 테이블에 jobId uniqueIndex 추가 및 persistAnalysisReport를 onConflictDoUpdate로 변경하여 리포트 갱신 가능
- LoginForm에 useSearchParams로 callbackUrl 지원 추가, Suspense boundary 래핑
- getPendingInvites에 isNull(acceptedAt) DB 레벨 필터 추가하여 수락된 초대 제외

## Task Commits

Each task was committed atomically:

1. **Task 1: INT-01 sources 필드 전달** - `feb8f3c` (fix)
2. **Task 2: INT-02 리포트 upsert** - `5fbe699` (fix)
3. **Task 3: FLOW-01 callbackUrl + acceptedAt 필터** - `f1a85e5` (fix)

## Files Created/Modified

- `packages/core/src/types/index.ts` - CollectionTriggerSchema에 sources optional 필드 추가
- `packages/core/src/queue/flows.ts` - enabledSources 기반 조건부 Flow children 생성
- `apps/web/src/server/trpc/routers/analysis.ts` - sources를 triggerCollection에 전달
- `packages/core/src/db/schema/analysis.ts` - analysisReports jobId uniqueIndex 추가
- `packages/core/src/analysis/persist-analysis.ts` - onConflictDoUpdate로 upsert 변경
- `apps/web/src/components/auth/login-form.tsx` - useSearchParams + callbackUrl 지원
- `apps/web/src/app/login/page.tsx` - Suspense boundary 래핑
- `apps/web/src/server/trpc/routers/team.ts` - isNull(acceptedAt) DB 필터 추가
- `packages/core/tests/queue.test.ts` - sources 관련 테스트 3개 추가
- `packages/core/tests/report.test.ts` - upsert 스키마 검증 테스트 2개 추가
- `packages/core/tests/db.test.ts` - invitations 스키마 검증 테스트 3개 추가

## Decisions Made

- sources 필드를 optional로 추가하여 기존 호출 하위 호환 유지 (미전달 시 전체 소스 실행)
- onConflictDoUpdate target을 jobId uniqueIndex로 설정하여 동일 작업의 리포트 갱신
- JS .filter() 후처리를 isNull() DB 레벨 쿼리로 대체하여 정확성 보장

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- analysis-runner.test.ts에 사전 존재하는 테스트 실패 발견 (8개 모듈 기대치 불일치) - 본 플랜의 변경과 무관한 기존 이슈로 확인됨

## Known Stubs

None - 모든 변경사항이 실제 동작하는 코드로 구현됨.

## User Setup Required

None - no external service configuration required.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |
| -   | -      | -         | -         |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                                      |
| ----------------------------------- | ---------------------------------------------------------------- |
| superpowers:brainstorming           | 갭 해소 플랜으로 명확한 수정 사항이 지정되어 브레인스토밍 불필요 |
| superpowers:test-driven-development | TDD 패턴은 수동으로 적용 (RED-GREEN 사이클 준수)                 |
| superpowers:systematic-debugging    | 버그 미발생                                                      |
| superpowers:requesting-code-review  | Skill 도구 미사용 (병렬 실행 에이전트 환경)                      |

## Next Phase Readiness

- v1.0 마일스톤 감사에서 식별된 INT-01, INT-02, FLOW-01 갭이 모두 해소됨
- DB 마이그레이션(drizzle-kit push)은 운영 서버 접속 시 별도 실행 필요

---

_Phase: 05-integration-flow-gap-closure_
_Completed: 2026-03-24_
