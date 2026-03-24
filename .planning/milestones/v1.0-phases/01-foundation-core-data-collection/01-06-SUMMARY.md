---
phase: 01-foundation-core-data-collection
plan: 06
subsystem: pipeline
tags: [bullmq, naver-comments, collector, pipeline, flow]

# Dependency graph
requires:
  - phase: 01-foundation-core-data-collection (plan 03, 04, 05)
    provides: "NaverCommentsCollector, BullMQ Flow, worker-process 파이프라인"
provides:
  - "네이버 기사 수집 후 댓글 자동 수집 파이프라인"
  - "normalize-naver 핸들러에서 collectForArticle 통합 호출"
affects: [02-ai-analysis-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["normalize 단계에서 추가 데이터 수집 통합 패턴 (collect -> normalize+collect -> persist)"]

key-files:
  created: []
  modified:
    - packages/core/src/queue/flows.ts
    - packages/core/src/queue/worker-process.ts
    - packages/core/tests/worker.test.ts

key-decisions:
  - "collect-naver-comments 별도 자식 작업 제거, normalize-naver에서 직접 collectForArticle 호출"
  - "개별 기사 댓글 수집 실패 시 로깅 후 계속 (D-04 부분 실패 허용)"

patterns-established:
  - "normalize 핸들러에서 부모 데이터의 URL 기반 추가 수집 통합 패턴"

requirements-completed: [COLL-02]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 1 Plan 6: 네이버 댓글 수집 파이프라인 Gap Closure Summary

**BullMQ Flow에서 collect-naver-comments 자식 작업을 제거하고, normalize-naver 핸들러에서 기사 URL 추출 후 collectForArticle()로 댓글을 직접 수집하는 파이프라인 통합**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T05:09:21Z
- **Completed:** 2026-03-24T05:11:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- flows.ts에서 빈 제너레이터를 반환하던 collect-naver-comments 자식 작업 제거
- normalize-naver 핸들러에서 기사 수집 결과의 URL을 추출하여 collectForArticle()로 댓글 자동 수집
- 댓글 수집 결과가 results['naver-comments']에 포함되어 persist 단계로 전달
- 파이프라인 통합 테스트 3개 추가, 전체 23개 테스트 통과

## Task Commits

Each task was committed atomically:

1. **Task 1: Flow 구조 변경 + normalize-naver 핸들러에서 댓글 수집 통합** - `b1bafa9` (feat)
2. **Task 2: Worker 테스트 업데이트 + 전체 테스트 통과 확인** - `324bef3` (test)

## Files Created/Modified
- `packages/core/src/queue/flows.ts` - collect-naver-comments 제거, normalize-naver data에 maxComments 추가
- `packages/core/src/queue/worker-process.ts` - normalize-naver 핸들러에서 collectForArticle 통합 호출
- `packages/core/tests/worker.test.ts` - 네이버 댓글 파이프라인 통합 테스트 3개 추가

## Decisions Made
- collect-naver-comments 별도 BullMQ 자식 작업을 제거하고 normalize-naver에서 직접 수집 -- NaverCommentsCollector.collect()가 빈 제너레이터를 반환하는 구조적 한계 해결
- 개별 기사 댓글 수집 실패 시 console.warn 로깅 후 다음 기사로 계속 -- D-04 부분 실패 허용 원칙 적용

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- COLL-02 blocker 해결: 네이버 댓글 수집이 파이프라인에서 실제로 동작
- 기존 유튜브 수집 흐름에 영향 없음
- Phase 1의 모든 수집기(네이버 뉴스/댓글, 유튜브 영상/댓글) 파이프라인 연결 완료

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | gap closure plan으로 변경 범위가 명확하여 브레인스토밍 불필요 |
| superpowers:test-driven-development | Plan이 TDD가 아닌 통합 테스트 방식으로 지정됨 |
| superpowers:systematic-debugging | 버그 미발생 |
| superpowers:requesting-code-review | 변경 범위가 3개 파일로 제한적이며 Plan 지시대로 정확히 구현 |

---
*Phase: 01-foundation-core-data-collection*
*Completed: 2026-03-24*
