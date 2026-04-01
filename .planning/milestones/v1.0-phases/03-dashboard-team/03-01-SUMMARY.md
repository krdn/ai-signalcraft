---
phase: 03-dashboard-team
plan: 01
subsystem: ui, auth, api, database
tags: [shadcn-ui, tailwind-4, trpc-11, nextauth-v5, drizzle, dark-mode, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: core 패키지 DB 스키마 (collectionJobs, articles, videos, comments), Queue 시스템
  - phase: 02-analysis
    provides: 분석 결과 스키마 (analysisResults, analysisReports), AI 분석 파이프라인
provides:
  - shadcn/ui + Tailwind 4 다크모드 기본 UI 프레임워크
  - tRPC 11 라우터 (publicProcedure + protectedProcedure)
  - NextAuth v5 인증 시스템 (Credentials + Google OAuth)
  - Auth/Team DB 스키마 (users, teams, teamMembers, invitations)
  - Vitest + Testing Library 테스트 인프라
  - TanStack Query + ThemeProvider 클라이언트 프로바이더
affects: [03-02, 03-03, 03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: [shadcn/ui, tailwindcss-4, @tailwindcss/postcss, next-themes, @trpc/server, @trpc/client, @trpc/tanstack-react-query, @tanstack/react-query, next-auth@beta, @auth/drizzle-adapter, @auth/core, bcryptjs, recharts, react-markdown, remark-gfm, @isoterik/react-word-cloud, resend, vitest, @testing-library/react, @testing-library/jest-dom, @vitejs/plugin-react, jsdom, drizzle-orm]
  patterns: [Providers 패턴 (ThemeProvider + QueryClientProvider 래핑), tRPC context 패턴 (auth + db), NextAuth 설정 분리 패턴]

key-files:
  created:
    - apps/web/components.json
    - apps/web/postcss.config.mjs
    - apps/web/src/app/globals.css
    - apps/web/src/lib/utils.ts
    - apps/web/src/components/providers.tsx
    - apps/web/src/components/ui/button.tsx
    - apps/web/vitest.config.ts
    - apps/web/src/__tests__/setup.ts
    - apps/web/src/__tests__/app-smoke.test.tsx
    - apps/web/.env.example
    - packages/core/src/db/schema/auth.ts
    - apps/web/src/server/trpc/init.ts
    - apps/web/src/server/trpc/router.ts
    - apps/web/src/app/api/trpc/[trpc]/route.ts
    - apps/web/src/lib/trpc.ts
    - apps/web/src/server/auth.ts
    - apps/web/src/app/api/auth/[...nextauth]/route.ts
  modified:
    - apps/web/package.json
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - apps/web/tsconfig.json
    - packages/core/src/db/schema/index.ts
    - packages/core/src/db/schema/collections.ts

key-decisions:
  - "AdapterAccountType을 core 패키지에 인라인 정의하여 next-auth 의존성 순환 방지"
  - "@vitejs/plugin-react v4 사용 (v6은 vite@8 필요, vitest@3이 vite@7 제공)"
  - "NextAuth config에 명시적 타입 어노테이션으로 portable type 에러 해결"
  - "tRPC 바닐라 클라이언트 패턴 사용 (v11 createTRPCOptionsProxy는 queryClient 필수이므로 분리)"

patterns-established:
  - "Providers 패턴: ThemeProvider(dark default) + QueryClientProvider를 layout.tsx에서 래핑"
  - "tRPC context: auth() + db 인스턴스를 컨텍스트로 제공"
  - "protectedProcedure: session.user 없으면 UNAUTHORIZED 에러"
  - "UI-SPEC 색상 토큰: globals.css에 HSL 기반 chart 변수 + oklch 기반 시스템 변수"

requirements-completed: [TEAM-01, DASH-01]

# Metrics
duration: 9min
completed: 2026-03-24
---

# Phase 03 Plan 01: 기반 스캐폴딩 Summary

**shadcn/ui + Tailwind 4 다크모드 기본 앱 셸, tRPC 11 라우터, NextAuth v5(Credentials+Google) 인증, Auth/Team DB 스키마 6개 테이블 설정**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-24T08:42:40Z
- **Completed:** 2026-03-24T08:52:32Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- shadcn/ui + Tailwind CSS 4 + 다크모드 기본 테마가 설정된 Next.js 앱 셸 완성
- tRPC /api/trpc + NextAuth /api/auth 엔드포인트가 빌드에 포함됨
- users, accounts, sessions, verificationTokens, teams, teamMembers, invitations DB 스키마 정의
- Vitest + Testing Library 테스트 인프라 구축, smoke test 1개 green 통과

## Task Commits

Each task was committed atomically:

1. **Task 1: 의존성 설치 + shadcn/ui 초기화 + 다크모드 테마 + smoke test** - `0e1be8a` (feat)
2. **Task 2: Auth/Team DB 스키마 + tRPC 초기화 + NextAuth 설정** - `8143db1` (feat)

## Files Created/Modified

- `apps/web/components.json` - shadcn/ui 설정 파일
- `apps/web/postcss.config.mjs` - Tailwind 4 PostCSS 설정
- `apps/web/src/app/globals.css` - UI-SPEC 색상 토큰 + 다크모드 CSS 변수
- `apps/web/src/lib/utils.ts` - cn() 유틸리티 함수 (clsx + tailwind-merge)
- `apps/web/src/components/providers.tsx` - ThemeProvider + QueryClientProvider 래핑
- `apps/web/src/app/layout.tsx` - Geist 폰트 + Providers 래핑 + lang="ko"
- `apps/web/src/app/page.tsx` - SignalCraft Dashboard 임시 페이지
- `apps/web/vitest.config.ts` - Vitest 설정 (jsdom + React plugin + @ alias)
- `apps/web/src/__tests__/app-smoke.test.tsx` - smoke test
- `apps/web/.env.example` - 환경 변수 템플릿
- `packages/core/src/db/schema/auth.ts` - users, accounts, sessions, teams, teamMembers, invitations 테이블
- `packages/core/src/db/schema/index.ts` - auth 스키마 export 추가
- `packages/core/src/db/schema/collections.ts` - collectionJobs에 teamId FK 추가
- `apps/web/src/server/trpc/init.ts` - tRPC 초기화 (publicProcedure + protectedProcedure)
- `apps/web/src/server/trpc/router.ts` - 빈 appRouter + AppRouter 타입
- `apps/web/src/app/api/trpc/[trpc]/route.ts` - tRPC HTTP 핸들러
- `apps/web/src/lib/trpc.ts` - tRPC 바닐라 클라이언트
- `apps/web/src/server/auth.ts` - NextAuth v5 설정 (Credentials + Google + DrizzleAdapter)
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` - NextAuth HTTP 핸들러

## Decisions Made

- AdapterAccountType을 core 패키지에 인라인 정의하여 next-auth 의존성 순환 방지
- @vitejs/plugin-react v4 사용 (v6은 vite@8 필요하나 vitest@3이 vite@7 제공)
- NextAuth config에 명시적 타입 어노테이션 + 변수 분리로 portable type 에러 해결
- tRPC 바닐라 클라이언트 패턴 사용 (v11 createTRPCOptionsProxy는 queryClient 필수)
- @testing-library/jest-dom/vitest import 사용 (기본 import는 expect 미정의 에러)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @vitejs/plugin-react 버전 다운그레이드**

- **Found during:** Task 1 (테스트 인프라 설정)
- **Issue:** @vitejs/plugin-react@6이 vite@8 필요하나 vitest@3이 vite@7 제공
- **Fix:** @vitejs/plugin-react@^4.0.0으로 다운그레이드
- **Files modified:** apps/web/package.json
- **Verification:** vitest --run 성공
- **Committed in:** 0e1be8a

**2. [Rule 3 - Blocking] shadcn/ui 파일 위치 수정**

- **Found during:** Task 1 (shadcn/ui 초기화)
- **Issue:** shadcn init이 utils.ts, button.tsx를 프로젝트 루트 src/에 생성 (monorepo 인식 실패)
- **Fix:** 파일을 apps/web/src/로 이동
- **Files modified:** apps/web/src/lib/utils.ts, apps/web/src/components/ui/button.tsx
- **Verification:** build 성공
- **Committed in:** 0e1be8a

**3. [Rule 3 - Blocking] tsconfig.json baseUrl 추가**

- **Found during:** Task 1 (빌드 검증)
- **Issue:** @/ path alias가 동작하지 않음 (baseUrl이 루트 tsconfig.base.json에만 존재)
- **Fix:** apps/web/tsconfig.json에 "baseUrl": "." 추가
- **Files modified:** apps/web/tsconfig.json
- **Verification:** build 성공
- **Committed in:** 0e1be8a

**4. [Rule 3 - Blocking] drizzle-orm 직접 의존성 추가**

- **Found during:** Task 2 (빌드 검증)
- **Issue:** auth.ts에서 `import { eq } from 'drizzle-orm'` 사용하나 web 패키지에 직접 의존성 없음
- **Fix:** pnpm --filter web add drizzle-orm
- **Files modified:** apps/web/package.json
- **Verification:** build 성공
- **Committed in:** 8143db1

**5. [Rule 1 - Bug] NextAuth portable type 에러 해결**

- **Found during:** Task 2 (빌드 검증)
- **Issue:** `export const { handlers, auth, signIn, signOut } = NextAuth(...)` 시 portable type 추론 실패
- **Fix:** NextAuthConfig 타입 명시 + 변수 분리 후 개별 export
- **Files modified:** apps/web/src/server/auth.ts
- **Verification:** build 성공
- **Committed in:** 8143db1

---

**Total deviations:** 5 auto-fixed (4 blocking, 1 bug)
**Impact on plan:** 모든 auto-fix가 빌드/테스트 통과에 필수적. 스코프 변경 없음.

## Issues Encountered

- shadcn/ui init이 monorepo 구조에서 파일을 잘못된 위치에 생성 -- 수동 이동으로 해결
- NextAuth v5 beta의 TypeScript portable type 추론 문제 -- 명시적 타입 + 변수 분리로 해결

## User Setup Required

None - 외부 서비스 설정 불필요. DB 마이그레이션은 별도로 `pnpm --filter core db:push` 실행 필요.

## Superpowers 호출 기록

| #   | 스킬명 | 호출 시점 | 결과 요약                                                                      |
| --- | ------ | --------- | ------------------------------------------------------------------------------ |
| -   | -      | -         | GSD executor 병렬 실행 환경에서 Superpowers 스킬 호출 불가 (Agent tool 미사용) |

### 미호출 스킬 사유

| 스킬명                              | 미호출 사유                                 |
| ----------------------------------- | ------------------------------------------- |
| superpowers:brainstorming           | 병렬 실행 agent - Agent tool 미사용         |
| superpowers:test-driven-development | Plan이 tdd="true" 미지정, smoke test만 포함 |
| superpowers:systematic-debugging    | 빌드/타입 에러는 직접 수정으로 해결         |
| superpowers:requesting-code-review  | 병렬 실행 agent - Agent tool 미사용         |

## Next Phase Readiness

- shadcn/ui + tRPC + NextAuth 기반이 준비되어 Plan 02-06에서 즉시 사용 가능
- DB 마이그레이션 (`drizzle-kit push`) 실행 후 auth/team 테이블 생성 필요
- tRPC 라우터에 프로시저 추가 준비 완료 (appRouter에 기능별 라우터 병합)

## Self-Check: PASSED

- All 15 key files verified present
- Task 1 commit 0e1be8a verified
- Task 2 commit 8143db1 verified
- `pnpm --filter @ai-signalcraft/web build` exit 0
- `pnpm --filter @ai-signalcraft/web test -- --run` exit 0 (1 test passed)
- `pnpm tsc --noEmit -p packages/core/tsconfig.json` exit 0

---

_Phase: 03-dashboard-team_
_Completed: 2026-03-24_
