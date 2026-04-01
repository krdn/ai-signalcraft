---
phase: 03-dashboard-team
plan: 02
subsystem: ui, auth, api
tags: [nextauth-middleware, trpc-routers, shadcn-tabs, pipeline-monitor, date-fns, sonner-toast]

# Dependency graph
requires:
  - phase: 03-dashboard-team
    provides: shadcn/ui + Tailwind 4 + tRPC init + NextAuth v5 설정
  - phase: 01-foundation
    provides: collectionJobs, triggerCollection, analysisResults, analysisReports 스키마
provides:
  - 로그인 페이지 (이메일/비밀번호 + Google OAuth)
  - NextAuth v5 미들웨어 (경량 auth.config.ts 분리)
  - 4탭 대시보드 셸 (분석 실행/결과 대시보드/AI 리포트/히스토리)
  - tRPC 라우터 3개 (analysis + pipeline + history)
  - 분석 실행 폼 + 4단계 파이프라인 모니터 + 히스토리 테이블
affects: [03-03, 03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: [react-hook-form, @hookform/resolvers, sonner]
  patterns: [auth.config.ts 분리 패턴 (미들웨어에서 core 의존성 격리), usePipelineStatus 폴링 훅, vanilla tRPC + TanStack Query 조합]

key-files:
  created:
    - apps/web/src/middleware.ts
    - apps/web/src/server/auth.config.ts
    - apps/web/src/app/login/page.tsx
    - apps/web/src/components/auth/login-form.tsx
    - apps/web/src/components/layout/top-nav.tsx
    - apps/web/src/components/layout/tab-layout.tsx
    - apps/web/src/server/trpc/routers/analysis.ts
    - apps/web/src/server/trpc/routers/pipeline.ts
    - apps/web/src/server/trpc/routers/history.ts
    - apps/web/src/hooks/use-pipeline-status.ts
    - apps/web/src/components/analysis/trigger-form.tsx
    - apps/web/src/components/analysis/pipeline-monitor.tsx
    - apps/web/src/components/analysis/recent-jobs.tsx
    - apps/web/src/components/analysis/history-table.tsx
  modified:
    - apps/web/src/app/page.tsx
    - apps/web/src/server/auth.ts
    - apps/web/src/server/trpc/router.ts
    - apps/web/src/components/providers.tsx
    - apps/web/next.config.ts
    - apps/web/package.json

key-decisions:
  - "auth.config.ts 분리로 미들웨어에서 Playwright/BullMQ 번들링 방지 (core 패키지 전체 import 차단)"
  - "sonner 사용 (shadcn toast 컴포넌트 deprecated 대체)"
  - "vanilla tRPC client + TanStack useQuery/useMutation 조합 (createTRPCOptionsProxy 대신)"

patterns-established:
  - "auth.config.ts 경량 설정 분리: 미들웨어용 JWT 검증만, DB 없음"
  - "serverExternalPackages: playwright-core, bullmq, ioredis 번들 제외"
  - "pipelineStages 4단계 파생: collectionJobs + analysisResults + analysisReports 조합"
  - "usePipelineStatus: 완료/실패 시 폴링 중지, 진행 중 3초 간격"

requirements-completed: [TEAM-01, DASH-01, DASH-02, DASH-06]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 03 Plan 02: 로그인 + 대시보드 셸 + 분석 실행 UI Summary

**로그인/인증 미들웨어, 4탭 대시보드 셸, 분석 트리거 폼 + 4단계 파이프라인 모니터(3초 폴링), tRPC 라우터 3개(analysis/pipeline/history), 히스토리 테이블 구현**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T08:56:17Z
- **Completed:** 2026-03-24T09:04:17Z
- **Tasks:** 3
- **Files modified:** 41

## Accomplishments

- 로그인 페이지 + NextAuth v5 미들웨어로 미인증 사용자 /login 리다이렉트
- 4탭 대시보드 셸 (분석 실행/결과 대시보드/AI 리포트/히스토리) + 상단 네비게이션
- tRPC 라우터 3개: analysis (trigger + getResults + getReport), pipeline (getStatus 4단계 파생), history (list + 페이지네이션)
- 분석 실행 폼 (키워드/소스/기간) + 파이프라인 4단계 진행률 모니터 (3초 폴링) + 에러 복구 UI
- 히스토리 테이블 (전체 목록 + 페이지네이션 + 빈 상태)

## Task Commits

Each task was committed atomically:

1. **Task 1: 로그인 페이지 + 인증 미들웨어 + 4탭 대시보드 셸** - `a0f84f8` (feat)
2. **Task 2: tRPC 라우터 3개 (analysis + pipeline + history)** - `ab6473b` (feat)
3. **Task 3: 분석 실행 UI + 파이프라인 모니터 + 히스토리 테이블** - `b9e2127` (feat)

## Files Created/Modified

- `apps/web/src/middleware.ts` - NextAuth v5 미들웨어 (경량 auth.config 사용)
- `apps/web/src/server/auth.config.ts` - 미들웨어용 경량 인증 설정 (DB 의존성 없음)
- `apps/web/src/server/auth.ts` - authConfig 기반으로 리팩토링 (DB 프로바이더 오버라이드)
- `apps/web/src/app/login/page.tsx` - 로그인 페이지
- `apps/web/src/components/auth/login-form.tsx` - 이메일/비밀번호 + Google OAuth 로그인 폼
- `apps/web/src/components/layout/top-nav.tsx` - 상단 네비게이션 (로고 + 4탭 + 사용자 메뉴)
- `apps/web/src/components/layout/tab-layout.tsx` - 탭 패널 레이아웃
- `apps/web/src/server/trpc/routers/analysis.ts` - 분석 트리거/결과/리포트 tRPC 라우터
- `apps/web/src/server/trpc/routers/pipeline.ts` - 파이프라인 4단계 상태 파생 라우터
- `apps/web/src/server/trpc/routers/history.ts` - 히스토리 목록 페이지네이션 라우터
- `apps/web/src/server/trpc/router.ts` - 3개 라우터 등록
- `apps/web/src/hooks/use-pipeline-status.ts` - 파이프라인 상태 3초 폴링 훅
- `apps/web/src/components/analysis/trigger-form.tsx` - 분석 실행 폼 (키워드/소스/기간)
- `apps/web/src/components/analysis/pipeline-monitor.tsx` - 4단계 파이프라인 진행률 모니터
- `apps/web/src/components/analysis/recent-jobs.tsx` - 최근 분석 5건 테이블
- `apps/web/src/components/analysis/history-table.tsx` - 전체 히스토리 테이블 + 페이지네이션
- `apps/web/src/app/page.tsx` - 4탭 패널 배치 + 상태 관리
- `apps/web/src/components/providers.tsx` - SessionProvider + Toaster 추가
- `apps/web/next.config.ts` - serverExternalPackages 추가
- `apps/web/src/components/ui/*` - shadcn 컴포넌트 19개

## Decisions Made

- auth.config.ts 분리: 미들웨어가 `@ai-signalcraft/core`를 import하면 Playwright/BullMQ가 번들에 포함되어 빌드 실패. 경량 설정 파일을 분리하여 해결.
- sonner 사용: shadcn의 toast 컴포넌트가 deprecated 되어 sonner로 대체
- vanilla tRPC + TanStack Query 직접 조합: v11의 createTRPCOptionsProxy 대신 vanilla client + useQuery/useMutation 패턴
- serverExternalPackages에 playwright-core, bullmq, ioredis 추가: Node.js 전용 패키지가 클라이언트 번들에 포함되지 않도록 방지

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] auth.config.ts 분리로 미들웨어 빌드 에러 해결**

- **Found during:** Task 1 (미들웨어 설정)
- **Issue:** `middleware.ts`에서 `@/server/auth`를 import하면 `@ai-signalcraft/core` 전체가 번들에 포함되어 Playwright/chromium-bidi 모듈 미발견 에러
- **Fix:** DB 의존성 없는 `auth.config.ts` 분리, 미들웨어에서 경량 설정만 사용
- **Files modified:** apps/web/src/server/auth.config.ts, apps/web/src/server/auth.ts, apps/web/src/middleware.ts, apps/web/next.config.ts
- **Verification:** `pnpm --filter @ai-signalcraft/web build` 성공
- **Committed in:** a0f84f8

**2. [Rule 3 - Blocking] DropdownMenuTrigger asChild 속성 제거**

- **Found during:** Task 1 (빌드 검증)
- **Issue:** shadcn/ui가 @base-ui/react 기반으로 생성되어 Radix의 `asChild` 속성 미지원
- **Fix:** `asChild` 제거, className을 DropdownMenuTrigger에 직접 적용
- **Files modified:** apps/web/src/components/layout/top-nav.tsx
- **Verification:** TypeScript 빌드 통과
- **Committed in:** a0f84f8

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** 모든 auto-fix가 빌드 통과에 필수적. 스코프 변경 없음.

## Issues Encountered

- shadcn toast 컴포넌트 deprecated: sonner로 자동 대체됨 (shadcn add 시 안내)
- Next.js 16의 middleware deprecation 경고: "proxy" 사용 권장이나 NextAuth v5가 middleware 패턴 사용하므로 현재 유지

## Known Stubs

None - 모든 컴포넌트가 tRPC 라우터와 실제 연결됨. 결과 대시보드/AI 리포트 탭은 Plan 03/04에서 구현 예정이며 placeholder 표시.

## User Setup Required

None - 외부 서비스 설정 불필요.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약                                                                      |
| --- | ------ | --------- | ------------------------------------------------------------------------------ |
| -   | -      | -         | GSD executor 병렬 실행 환경에서 Superpowers 스킬 호출 불가 (Agent tool 미사용) |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                         |
| ----------------------------------- | ----------------------------------- |
| superpowers:brainstorming           | 병렬 실행 agent - Agent tool 미사용 |
| superpowers:test-driven-development | Plan이 tdd="true" 미지정            |
| superpowers:systematic-debugging    | 빌드 에러는 직접 수정으로 해결      |
| superpowers:requesting-code-review  | 병렬 실행 agent - Agent tool 미사용 |

## Next Phase Readiness

- 로그인 + 인증 미들웨어 완성, 모든 대시보드 라우트 보호됨
- tRPC analysis/pipeline/history 라우터 사용 가능
- 분석 실행 -> 모니터링 -> 히스토리 조회 핵심 워크플로우 완성
- Plan 03 (결과 대시보드)에서 analysis.getResults + 차트 컴포넌트 연결 필요
- Plan 04 (AI 리포트)에서 analysis.getReport + 마크다운 렌더러 연결 필요

## Self-Check: PASSED

- All 14 key files verified present
- Task 1 commit a0f84f8 verified
- Task 2 commit ab6473b verified
- Task 3 commit b9e2127 verified
- `pnpm --filter @ai-signalcraft/web build` exit 0

---

_Phase: 03-dashboard-team_
_Completed: 2026-03-24_
