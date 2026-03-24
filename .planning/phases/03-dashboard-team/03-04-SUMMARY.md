---
phase: 03-dashboard-team
plan: 04
subsystem: ui
tags: [react-markdown, remark-gfm, intersection-observer, trpc, report-viewer]

requires:
  - phase: 02-analysis-pipeline
    provides: analysisReports 스키마 + 마크다운 리포트 생성
  - phase: 03-dashboard-team
    provides: tRPC init + shadcn UI 컴포넌트 + 탭 레이아웃
provides:
  - report tRPC 라우터 (getByJobId)
  - 마크다운 리포트 뷰어 (react-markdown + remark-gfm)
  - 섹션 네비게이션 (IntersectionObserver 기반)
  - PDF 내보내기 (window.print 기반)
affects: [03-dashboard-team]

tech-stack:
  added: [scroll-area (shadcn)]
  patterns: [IntersectionObserver 기반 섹션 추적, 마크다운 커스텀 컴포넌트 매핑]

key-files:
  created:
    - apps/web/src/server/trpc/routers/report.ts
    - apps/web/src/components/report/report-viewer.tsx
    - apps/web/src/components/report/section-nav.tsx
    - apps/web/src/components/report/report-view.tsx
    - apps/web/src/components/ui/scroll-area.tsx
  modified:
    - apps/web/src/server/trpc/router.ts
    - apps/web/src/app/page.tsx

key-decisions:
  - "window.print() 기반 PDF 내보내기 (서버사이드 Playwright PDF는 API route 불필요, 클라이언트에서 간이 처리)"
  - "handleSelectJob에서 activeJobId 설정 추가 (리포트 탭 연동 위해)"

patterns-established:
  - "마크다운 h2 -> id 자동 생성 패턴: 공백을 하이픈으로, 특수문자 제거"
  - "IntersectionObserver로 스크롤 위치 기반 네비게이션 활성 상태 동기화"

requirements-completed: [DASH-05, DASH-06]

duration: 4min
completed: 2026-03-24
---

# Phase 3 Plan 4: AI 리포트 뷰어 Summary

**react-markdown + remark-gfm 기반 마크다운 리포트 뷰어, 좌측 섹션 네비게이션(IntersectionObserver), PDF 내보내기 버튼 구현**

## Performance

- **Duration:** 4min
- **Started:** 2026-03-24T09:08:01Z
- **Completed:** 2026-03-24T09:12:46Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments
- report tRPC 라우터로 jobId 기반 리포트 조회 구현
- react-markdown + remark-gfm으로 마크다운 리포트를 커스텀 shadcn 컴포넌트로 렌더링
- IntersectionObserver로 스크롤 시 활성 섹션 자동 업데이트 + 클릭 시 smooth scroll
- 데스크톱 200px 고정 사이드바 / 모바일 수평 스크롤 탭 반응형 네비
- 리포트 메타데이터(제목, 한 줄 요약, 생성일) 표시
- 빈 상태 / 로딩 스켈레톤 / 리포트 없음 상태 처리

## Task Commits

Each task was committed atomically:

1. **Task 1: 리포트 tRPC 라우터 + 마크다운 뷰어 + 섹션 네비 + PDF 내보내기** - `4206812` (feat)

## Files Created/Modified
- `apps/web/src/server/trpc/routers/report.ts` - report tRPC 라우터 (getByJobId)
- `apps/web/src/components/report/report-viewer.tsx` - 마크다운 렌더러 (react-markdown + remark-gfm + IntersectionObserver)
- `apps/web/src/components/report/section-nav.tsx` - 섹션 네비게이션 (데스크톱 사이드바 + 모바일 탭)
- `apps/web/src/components/report/report-view.tsx` - 리포트 뷰 컨테이너 (tRPC 쿼리 + 레이아웃 조합)
- `apps/web/src/components/ui/scroll-area.tsx` - shadcn scroll-area 컴포넌트
- `apps/web/src/server/trpc/router.ts` - appRouter에 reportRouter 등록
- `apps/web/src/app/page.tsx` - ReportTab에 ReportView 연결 + handleSelectJob에 jobId 설정

## Decisions Made
- window.print() 기반 PDF 내보내기 선택: Phase 2의 Playwright PDF는 서버사이드 전용이므로 클라이언트에서는 브라우저 인쇄 기능 활용
- handleSelectJob에서 activeJobId를 설정하도록 수정하여 히스토리에서 선택한 분석의 리포트도 열람 가능

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handleSelectJob에서 jobId 미설정 수정**
- **Found during:** Task 1 (page.tsx 업데이트)
- **Issue:** 기존 handleSelectJob이 _jobId를 무시하여 리포트 탭에서 jobId가 전달되지 않음
- **Fix:** setActiveJobId(jobId) 호출 추가
- **Files modified:** apps/web/src/app/page.tsx
- **Verification:** 컴파일 통과
- **Committed in:** 4206812

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** 필수 수정 -- jobId 없이는 리포트 조회 불가

## Issues Encountered
- 빌드 검증 시 team.ts (다른 병렬 에이전트 코드)에서 타입 에러 발생했으나 해당 에이전트가 자체 수정함. 이후 빌드에서 DB 연결 부재로 page data collection 실패하나, TypeScript 컴파일은 정상 통과 (pre-existing 인프라 이슈)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AI 리포트 탭 뷰어 완성, 분석 실행 후 리포트 조회 가능
- 히스토리에서 과거 분석 선택 시 리포트 열람 지원
- "비교" 기능은 향후 Phase로 이월 (03-CONTEXT.md Deferred Ideas 참조)

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|
| - | - | - | - |

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 단일 Task Plan으로 구현 범위 명확, 추가 브레인스토밍 불필요 |
| superpowers:test-driven-development | Plan에 tdd="true" 미지정, UI 컴포넌트 중심 작업 |
| superpowers:systematic-debugging | 버그 미발생 (타입 에러 없이 컴파일 통과) |
| superpowers:requesting-code-review | 병렬 실행 환경에서 코드 리뷰 스킬 호출이 다른 에이전트 작업과 충돌 가능 |

## Self-Check: PASSED

All 6 created files verified on disk. Commit 4206812 verified in git log.

---
*Phase: 03-dashboard-team*
*Completed: 2026-03-24*
