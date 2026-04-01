---
phase: 01-foundation-core-data-collection
plan: 03
subsystem: data-collection
tags: [naver, playwright, cheerio, scraping, web-crawler, async-generator]

requires:
  - phase: 01-02
    provides: Collector 인터페이스, CollectionOptions 스키마, Registry 패턴
provides:
  - NaverNewsCollector (키워드 기반 네이버 뉴스 기사 수집)
  - NaverCommentsCollector (비공식 API 기반 기사 댓글 수집)
  - naver-parser 유틸 (URL 파싱, objectId 생성, 검색/댓글 API URL 빌더)
affects: [01-04, 01-05, pipeline-orchestration]

tech-stack:
  added: [playwright, cheerio]
  patterns: [async-generator-chunked-yield, referer-header-auth, jsonp-parsing]

key-files:
  created:
    - packages/collectors/src/adapters/naver-news.ts
    - packages/collectors/src/adapters/naver-comments.ts
    - packages/collectors/src/utils/naver-parser.ts
    - packages/collectors/tests/naver-news.test.ts
    - packages/collectors/tests/naver-comments.test.ts
  modified:
    - packages/collectors/src/adapters/index.ts

key-decisions:
  - '날짜 형식 변환을 직접 구현 (toLocaleDateString 대신 수동 포매팅으로 타임존 이슈 방지)'
  - 'NaverCommentsCollector.collect()는 빈 제너레이터로 유지, collectForArticle()로 기사별 수집 분리'
  - 'JSONP 응답 파싱 로직을 별도 함수로 분리하여 재사용성 확보'

patterns-established:
  - 'AsyncGenerator 패턴: 페이지/기사 단위 yield로 메모리 효율 확보'
  - 'Rate limit 대응: 랜덤 딜레이 (min~max ms) 적용'
  - 'Referer 헤더 패턴: 비공식 API 호출 시 적절한 Referer 필수'
  - '부분 실패 허용: 개별 기사 본문 수집 실패 시 content=null, rawData에 에러 기록'

requirements-completed: [COLL-01, COLL-02]

duration: 3min
completed: 2026-03-24
---

# Phase 1 Plan 3: Naver Collectors Summary

**Playwright+Cheerio 기반 NaverNewsCollector와 비공식 댓글 API 기반 NaverCommentsCollector 구현, AsyncGenerator 청크 yield 패턴 적용**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T04:07:15Z
- **Completed:** 2026-03-24T04:10:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- NaverNewsCollector: Playwright로 검색 결과 JS 렌더링 + Cheerio 파싱, 기사 본문 개별 수집
- NaverCommentsCollector: 비공식 댓글 API 호출 + Referer 헤더 + JSONP 파싱
- naver-parser 유틸: URL 파싱(2가지 패턴), objectId 생성, 검색/댓글 API URL 빌더
- 단위 테스트 21개 전체 통과 (기존 3개 + 신규 18개)

## Task Commits

Each task was committed atomically:

1. **Task 1: 네이버 뉴스 기사 수집기** - `babbe4e` (feat)
2. **Task 2: 네이버 뉴스 댓글 수집기** - `cb8cb8f` (feat)

## Files Created/Modified

- `packages/collectors/src/utils/naver-parser.ts` - URL 파싱, 검색/댓글 API URL 빌더 유틸
- `packages/collectors/src/adapters/naver-news.ts` - NaverNewsCollector (Playwright + Cheerio)
- `packages/collectors/src/adapters/naver-comments.ts` - NaverCommentsCollector (비공식 댓글 API)
- `packages/collectors/src/adapters/index.ts` - NaverNews/NaverComments export 추가
- `packages/collectors/tests/naver-news.test.ts` - URL 파싱 + collector 인터페이스 테스트 (12개)
- `packages/collectors/tests/naver-comments.test.ts` - 댓글 collector 인터페이스 테스트 (6개)

## Decisions Made

- `buildNaverSearchUrl`에서 `toLocaleDateString` 대신 수동 포매팅 사용 -- 타임존에 따른 날짜 불일치 방지
- `NaverCommentsCollector.collect()`는 빈 AsyncGenerator로 유지 -- 댓글 수집은 기사 URL이 필요한 특수 케이스이므로 `collectForArticle()` 별도 제공
- JSONP 응답 파싱(`_callback({...})` 래퍼 제거)을 별도 함수로 분리

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] buildCommentApiUrl 함수 추가**

- **Found during:** Task 1 (naver-parser.ts 작성)
- **Issue:** Plan에 `buildCommentApiUrl` 함수가 exports에 명시되어 있으나 구현 코드에 누락
- **Fix:** 댓글 API URL 생성 함수를 naver-parser.ts에 추가
- **Files modified:** packages/collectors/src/utils/naver-parser.ts
- **Verification:** 테스트에서 URL 생성 검증
- **Committed in:** babbe4e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Plan의 must_haves.artifacts에 명시된 export를 보완. 정상 범위 내.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약 |
| --- | ------ | --------- | --------- |
| -   | -      | -         | 해당 없음 |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                          |
| ----------------------------------- | ---------------------------------------------------- |
| superpowers:brainstorming           | Plan이 명확하여 추가 브레인스토밍 불필요             |
| superpowers:test-driven-development | Plan에 tdd="true" 미지정, 테스트는 구현과 함께 작성  |
| superpowers:systematic-debugging    | 버그 미발생                                          |
| superpowers:requesting-code-review  | 병렬 실행 agent로 경량 실행, code review 스킬 미호출 |

## Next Phase Readiness

- NaverNewsCollector + NaverCommentsCollector 완성, 파이프라인에서 사용 가능
- YouTube 수집기(Plan 04) 구현에 동일한 Collector 패턴 적용 가능
- 통합 테스트(실제 네이버 API 호출)는 별도 integration test로 분리 필요

## Self-Check: PASSED

- All 6 files created: FOUND
- Commits babbe4e, cb8cb8f: FOUND
- All acceptance criteria: VERIFIED
- Note: `apis.naver.com/commentBox` URL은 naver-parser.ts에 위치 (naver-comments.ts에서 import하여 사용)

---

_Phase: 01-foundation-core-data-collection_
_Completed: 2026-03-24_
