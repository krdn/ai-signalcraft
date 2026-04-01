---
phase: 07-collector
plan: 02
subsystem: data-pipeline
tags: [playwright, scraping, refactoring, community, inheritance]

requires:
  - phase: 07-01
    provides: 'BrowserCollector + CommunityBaseCollector 추상 클래스'
provides:
  - 'ClienCollector extends CommunityBaseCollector (중복 코드 제거)'
  - 'DCInsideCollector extends CommunityBaseCollector (중복 코드 제거)'
  - 'FMKoreaCollector extends CommunityBaseCollector (중복 코드 제거)'
affects: [07-03-PLAN]

tech-stack:
  added: []
  patterns: [template-method-inheritance, protected-method-override]

key-files:
  created: []
  modified:
    - packages/collectors/src/adapters/clien.ts
    - packages/collectors/src/adapters/dcinside.ts
    - packages/collectors/src/adapters/fmkorea.ts

key-decisions:
  - 'selectors를 인스턴스 프로퍼티(this.selectors)로 참조하여 상수와 메서드의 결합도 제거'
  - 'detectBlocked()는 clien과 fmkorea만 override, dcinside는 기본 false 사용'

patterns-established:
  - 'CommunityBaseCollector 상속 패턴: config + selectors + buildSearchUrl + parseSearchResults + fetchPost'
  - '사이트별 private 헬퍼(parseComments, extractSourceId, extractBoardFromUrl)는 private 유지'

requirements-completed: [COL-02, COL-05]

duration: 2min
completed: 2026-03-27
---

# Phase 07 Plan 02: 커뮤니티 어댑터 마이그레이션 Summary

**clien/dcinside/fmkorea 3개 어댑터를 CommunityBaseCollector 상속으로 전환하여 collect()/USER_AGENTS/브라우저 초기화 중복 207줄 제거**

## Performance

- **Duration:** 2min
- **Started:** 2026-03-26T23:40:05Z
- **Completed:** 2026-03-26T23:42:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- ClienCollector를 CommunityBaseCollector 상속으로 전환 (262줄 -> 191줄, -27%)
- DCInsideCollector를 CommunityBaseCollector 상속으로 전환 (224줄 -> 160줄, -29%)
- FMKoreaCollector를 CommunityBaseCollector 상속으로 전환 (258줄 -> 186줄, -28%)
- 3개 어댑터에서 collect(), USER_AGENTS, Browser import, launchBrowser import 완전 제거
- 기존 49개 테스트 모두 통과 확인

## Task Commits

Each task was committed atomically:

1. **Task 1: clien.ts를 CommunityBaseCollector 상속으로 리팩토링** - `ee7838c` (refactor)
2. **Task 2: dcinside.ts + fmkorea.ts를 CommunityBaseCollector 상속으로 리팩토링** - `24cf200` (refactor)

## Files Created/Modified

- `packages/collectors/src/adapters/clien.ts` - CommunityBaseCollector 상속, detectBlocked override
- `packages/collectors/src/adapters/dcinside.ts` - CommunityBaseCollector 상속, 기본 detectBlocked 사용
- `packages/collectors/src/adapters/fmkorea.ts` - CommunityBaseCollector 상속, detectBlocked override (captcha 감지)

## Decisions Made

- selectors를 인스턴스 프로퍼티(this.selectors)로 참조하여 모듈 상수 대신 클래스 내부에서 관리
- detectBlocked()는 clien(접근 제한/403/차단)과 fmkorea(자동등록방지/captcha)만 override, dcinside는 기본 false 사용

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (naver-news 마이그레이션)에서 BrowserCollector 직접 상속으로 리팩토링 준비 완료
- community-parser.ts의 sleep은 3개 어댑터에서 더 이상 import하지 않음 (browser.ts의 sleep을 CommunityBaseCollector가 사용)

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                             |
| ----------------------------------- | ------------------------------------------------------- |
| superpowers:brainstorming           | 명확한 리팩토링 작업으로 추가 분석 불필요               |
| superpowers:test-driven-development | 기존 49개 테스트로 리팩토링 검증 충분                   |
| superpowers:systematic-debugging    | 버그 미발생                                             |
| superpowers:requesting-code-review  | 패턴 동일한 리팩토링, 기존 테스트 전체 통과로 검증 완료 |

## Self-Check: PASSED

- [x] clien.ts - FOUND
- [x] dcinside.ts - FOUND
- [x] fmkorea.ts - FOUND
- [x] 07-02-SUMMARY.md - FOUND
- [x] Commit ee7838c - FOUND
- [x] Commit 24cf200 - FOUND
- [x] TypeScript compilation - PASSED
- [x] 49 tests - ALL PASSED

---

_Phase: 07-collector_
_Completed: 2026-03-27_
