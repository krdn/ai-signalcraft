---
phase: 07-collector
plan: 03
subsystem: data-pipeline
tags: [playwright, cheerio, refactoring, browser-collector, naver]

requires:
  - phase: 07-01
    provides: BrowserCollector 추상 클래스, browser.ts sleep/createBrowserContext 유틸
provides:
  - NaverNewsCollector가 BrowserCollector 상속으로 리팩토링됨
  - parseDateTextOrNull 공통 유틸 함수 (Date | null 반환)
  - index.ts에 BrowserCollector, CommunityBaseCollector re-export
affects: [07-collector]

tech-stack:
  added: []
  patterns: [BrowserCollector 상속 패턴을 뉴스 수집기에도 적용]

key-files:
  created: []
  modified:
    - packages/collectors/src/adapters/naver-news.ts
    - packages/collectors/src/utils/community-parser.ts
    - packages/collectors/src/adapters/index.ts

key-decisions:
  - "parseDateTextOrNull은 파싱 실패 시 null 반환 -- 기존 parseDateText(new Date() fallback)와 구분"

patterns-established:
  - "뉴스 수집기도 BrowserCollector.doCollect() 패턴 사용 (커뮤니티와 동일한 라이프사이클)"

requirements-completed: [COL-02, COL-04, COL-05]

duration: 3min
completed: 2026-03-27
---

# Phase 7 Plan 3: Naver News BrowserCollector Migration Summary

**NaverNewsCollector를 BrowserCollector 상속으로 마이그레이션하고 중복 코드 ~27줄 제거 + parseDateTextOrNull 공통 유틸 추가**

## Performance

- **Duration:** 3min
- **Started:** 2026-03-26T23:40:42Z
- **Completed:** 2026-03-26T23:43:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- NaverNewsCollector가 BrowserCollector<NaverArticle>를 상속하여 브라우저 라이프사이클 관리 위임
- 자체 delay() 함수와 parseDateText() 메서드 제거 (공통 유틸로 대체)
- community-parser.ts에 parseDateTextOrNull(Date | null) 함수 추가
- index.ts에 BrowserCollector, CommunityBaseCollector 추상 클래스 re-export 추가
- 49개 테스트 모두 통과 확인

## Task Commits

Each task was committed atomically:

1. **Task 1: community-parser.ts 타입 강화 + parseDateTextOrNull 추가** - `a701d4f` (refactor)
2. **Task 2: naver-news.ts BrowserCollector 상속 + index.ts export 정리** - `fface65` (refactor)

## Files Created/Modified
- `packages/collectors/src/utils/community-parser.ts` - parseDateTextOrNull 함수 추가 (파싱 실패 시 null 반환)
- `packages/collectors/src/adapters/naver-news.ts` - BrowserCollector 상속, 중복 코드 제거 (delay, parseDateText, 브라우저 초기화/종료)
- `packages/collectors/src/adapters/index.ts` - BrowserCollector, CommunityBaseCollector export 추가

## Decisions Made
- parseDateTextOrNull은 기존 parseDateText와 별도 함수로 추가 -- 기존 커뮤니티 수집기들이 사용하는 parseDateText(fallback: new Date())와 호환성 유지

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- NaverNewsCollector 리팩토링 완료, Plan 02(커뮤니티 3개)와 독립적으로 완성
- 모든 수집기가 BrowserCollector 계층을 공유하는 구조 완성

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 리팩토링 작업으로 Plan 지시가 명확하여 브레인스토밍 불필요 |
| superpowers:test-driven-development | 기존 테스트 49개가 이미 존재하며 리팩토링이므로 새 테스트 불필요 |
| superpowers:systematic-debugging | 버그 미발생 |
| superpowers:requesting-code-review | 단순 리팩토링으로 코드 리뷰 가치 낮음 |

---
*Phase: 07-collector*
*Completed: 2026-03-27*
