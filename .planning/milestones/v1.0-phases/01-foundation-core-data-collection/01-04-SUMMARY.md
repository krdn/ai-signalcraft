---
phase: 01-foundation-core-data-collection
plan: 04
subsystem: data-collection
tags: [youtube, googleapis, data-api-v3, async-generator, collector]

requires:
  - phase: 01-02
    provides: Collector 인터페이스 + CollectionOptions 스키마
  - phase: 01-03
    provides: 네이버 수집기 참조 구현 + adapters/index.ts 구조

provides:
  - YoutubeVideosCollector (search.list + videos.list 조합)
  - YoutubeCommentsCollector (commentThreads.list)
  - YouTube API 클라이언트 싱글턴 (getYoutubeClient)
  - adapters/index.ts에 4개 수집기 통합 export

affects: [01-05, pipeline-orchestration, dashboard]

tech-stack:
  added: [googleapis]
  patterns: [youtube-api-quota-optimization, comment-disabled-graceful-skip]

key-files:
  created:
    - packages/collectors/src/adapters/youtube-videos.ts
    - packages/collectors/src/adapters/youtube-comments.ts
    - packages/collectors/src/utils/youtube-client.ts
    - packages/collectors/tests/youtube-videos.test.ts
    - packages/collectors/tests/youtube-comments.test.ts
  modified:
    - packages/collectors/src/adapters/index.ts

key-decisions:
  - 'search.list(100유닛) + videos.list(1유닛) 2단계 조합으로 쿼터 효율 최적화'
  - '댓글 비활성화 영상 403 에러 시 graceful skip 처리'
  - 'YouTube 클라이언트를 싱글턴 패턴으로 관리 (테스트용 reset 함수 제공)'

patterns-established:
  - 'YouTube API 쿼터 효율: search.list 최소화, videos.list 배치 조회'
  - '댓글 수집기 keyword 필드에 videoId 전달하는 컨벤션'

requirements-completed: [COLL-03, COLL-04]

duration: 2min
completed: 2026-03-24
---

# Phase 1 Plan 4: YouTube 수집기 Summary

**YouTube Data API v3로 영상 메타데이터(search+videos.list) + 댓글(commentThreads.list) 수집기를 Collector 인터페이스로 구현, 쿼터 효율 최적화**

## Performance

- **Duration:** 2min
- **Started:** 2026-03-24T04:14:00Z
- **Completed:** 2026-03-24T04:16:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- YoutubeVideosCollector: search.list + videos.list 2단계 조합으로 50건 기준 101유닛만 소모
- YoutubeCommentsCollector: commentThreads.list로 댓글+대댓글 수집, 403 에러(댓글 비활성화) graceful skip
- googleapis YouTube 클라이언트 싱글턴 패턴 (YOUTUBE_API_KEY 환경변수)
- adapters/index.ts에 네이버(2) + 유튜브(2) 총 4개 수집기 통합 export

## Task Commits

Each task was committed atomically:

1. **Task 1: YouTube 영상 메타데이터 수집기** - `35341bf` (feat)
2. **Task 2: YouTube 댓글 수집기 + index.ts 통합** - `2d94035` (feat)

## Files Created/Modified

- `packages/collectors/src/utils/youtube-client.ts` - googleapis YouTube 클라이언트 싱글턴
- `packages/collectors/src/adapters/youtube-videos.ts` - 영상 메타데이터 수집기 (search.list + videos.list)
- `packages/collectors/src/adapters/youtube-comments.ts` - 댓글 수집기 (commentThreads.list)
- `packages/collectors/src/adapters/index.ts` - 4개 수집기 통합 export
- `packages/collectors/tests/youtube-videos.test.ts` - 영상 수집기 단위 테스트
- `packages/collectors/tests/youtube-comments.test.ts` - 댓글 수집기 단위 테스트

## Decisions Made

- search.list(100유닛) + videos.list(1유닛) 2단계 조합으로 쿼터 효율 최적화 (50건 = 101유닛)
- 댓글 비활성화 영상 403 에러 시 graceful skip (throw 대신 break)
- YouTube 클라이언트를 싱글턴 패턴으로 관리하여 API 키 초기화 1회만 수행
- YoutubeCommentsCollector는 keyword 필드에 videoId를 전달받는 컨벤션 채택

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

- YOUTUBE_API_KEY 환경변수 설정 필요 (Google Cloud Console에서 YouTube Data API v3 키 발급)
- .env.example에 YOUTUBE_API_KEY 항목이 이미 존재하는지 확인 필요

## Next Phase Readiness

- 4개 수집기(네이버 뉴스/댓글, 유튜브 영상/댓글) 모두 Collector 인터페이스 구현 완료
- Plan 05(파이프라인 통합)에서 BullMQ Flow로 수집기를 연결할 준비 완료
- 모든 수집기가 AsyncGenerator 패턴으로 통일되어 파이프라인 연결 용이

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약                                       |
| --- | ------ | --------- | ----------------------------------------------- |
| -   | -      | -         | 병렬 실행 에이전트로 Superpowers 스킬 호출 생략 |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                                |
| ----------------------------------- | ---------------------------------------------------------- |
| superpowers:brainstorming           | 병렬 실행 에이전트 -- Plan이 충분히 상세하여 생략          |
| superpowers:test-driven-development | Plan에서 TDD 미지정, 인터페이스 확인 수준 테스트           |
| superpowers:systematic-debugging    | 버그 미발생                                                |
| superpowers:requesting-code-review  | 병렬 실행 에이전트 -- 오케스트레이터가 Phase 레벨에서 수행 |

---

_Phase: 01-foundation-core-data-collection_
_Completed: 2026-03-24_
