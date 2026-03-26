---
phase: 07-collector
plan: 01
subsystem: data-pipeline
tags: [playwright, scraping, abstract-class, browser, community]

requires:
  - phase: 03-collectors
    provides: "기존 커뮤니티 수집기(clien, dcinside, fmkorea) 구현체"
provides:
  - "browser.ts 확장 유틸 (createBrowserContext, getRandomUserAgent, sleep, DEFAULT_CONTEXT_OPTIONS)"
  - "BrowserCollector<T> 추상 클래스 (브라우저 라이프사이클 관리)"
  - "CommunityBaseCollector 추상 클래스 (페이지 순회 + 게시글 수집 루프)"
  - "SiteSelectors 인터페이스"
  - "BrowserCollectorConfig 인터페이스"
affects: [07-02-PLAN, 07-03-PLAN]

tech-stack:
  added: []
  patterns: [template-method-pattern, abstract-class-hierarchy]

key-files:
  created:
    - packages/collectors/src/adapters/browser-collector.ts
    - packages/collectors/src/adapters/community-base-collector.ts
  modified:
    - packages/collectors/src/utils/browser.ts

key-decisions:
  - "sleep 함수를 browser.ts에 추가하되 community-parser.ts의 기존 sleep은 유지 (import 호환성)"
  - "detectBlocked()를 기본 false 훅으로 제공, 서브클래스에서 override"
  - "BrowserCollector<T> 제네릭으로 커뮤니티 외 브라우저 수집기도 재사용 가능하게 설계"

patterns-established:
  - "Template Method Pattern: BrowserCollector.collect() -> doCollect() 위임"
  - "Two-level abstraction: BrowserCollector (브라우저) -> CommunityBaseCollector (커뮤니티 공통)"

requirements-completed: [COL-01, COL-03]

duration: 3min
completed: 2026-03-27
---

# Phase 07 Plan 01: Collector 추상 클래스 Summary

**browser.ts 유틸 확장 + BrowserCollector/CommunityBaseCollector 추상 클래스로 커뮤니티 수집기 공통 패턴 추출**

## Performance

- **Duration:** 3min
- **Started:** 2026-03-26T23:30:34Z
- **Completed:** 2026-03-26T23:33:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- browser.ts에 5개 export 추가 (getRandomUserAgent, DEFAULT_CONTEXT_OPTIONS, createBrowserContext, sleep, USER_AGENTS)
- BrowserCollector<T> 추상 클래스로 브라우저 라이프사이클(launch/context/close) 공통화
- CommunityBaseCollector 추상 클래스로 페이지 순회 + 게시글 수집 루프 공통화
- 기존 49개 테스트 모두 통과 확인

## Task Commits

Each task was committed atomically:

1. **Task 1: browser.ts 유틸 확장** - `39f9b53` (feat)
2. **Task 2: BrowserCollector + CommunityBaseCollector 추상 클래스 생성** - `2398fc2` (feat)

## Files Created/Modified
- `packages/collectors/src/utils/browser.ts` - createBrowserContext, getRandomUserAgent, sleep, DEFAULT_CONTEXT_OPTIONS 추가
- `packages/collectors/src/adapters/browser-collector.ts` - BrowserCollector<T> 추상 클래스 (브라우저 라이프사이클 관리)
- `packages/collectors/src/adapters/community-base-collector.ts` - CommunityBaseCollector 추상 클래스 (페이지 순회 + 게시글 수집 루프)

## Decisions Made
- sleep 함수를 browser.ts에 추가하되 community-parser.ts의 기존 sleep은 유지 (기존 import를 깨뜨리지 않기 위해)
- detectBlocked()를 기본 false 훅으로 제공하여 서브클래스에서 선택적 override
- BrowserCollector를 제네릭 <T>로 설계하여 커뮤니티 외 브라우저 수집기에도 재사용 가능

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02에서 clien/fmkorea를 CommunityBaseCollector 상속으로 마이그레이션할 준비 완료
- Plan 03에서 dcinside를 CommunityBaseCollector 상속으로 마이그레이션할 준비 완료
- community-parser.ts의 sleep은 Plan 02/03에서 어댑터가 browser.ts sleep을 사용하도록 전환 후 제거 가능

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | Plan이 명확하고 단순한 추출/생성 작업으로 추가 분석 불필요 |
| superpowers:test-driven-development | 추상 클래스 생성으로 구현체 변경 없음, 기존 49개 테스트로 검증 충분 |
| superpowers:systematic-debugging | 버그 미발생 |
| superpowers:requesting-code-review | 새 파일 3개 생성 + 기존 코드 미변경, 기존 테스트 전체 통과로 검증 완료 |

## Self-Check: PASSED

- [x] browser.ts - FOUND
- [x] browser-collector.ts - FOUND
- [x] community-base-collector.ts - FOUND
- [x] 07-01-SUMMARY.md - FOUND
- [x] Commit 39f9b53 - FOUND
- [x] Commit 2398fc2 - FOUND
- [x] TypeScript compilation - PASSED
- [x] 49 tests - ALL PASSED

---
*Phase: 07-collector*
*Completed: 2026-03-27*
