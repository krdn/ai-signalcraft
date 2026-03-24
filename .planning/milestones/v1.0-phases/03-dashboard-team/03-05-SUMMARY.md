---
phase: 03-dashboard-team
plan: 05
subsystem: team
tags: [trpc, resend, email, invitation, team-management, rbac]

requires:
  - phase: 03-01
    provides: Auth/Team DB 스키마 + tRPC 초기화
  - phase: 03-02
    provides: analysis/pipeline/history tRPC 라우터

provides:
  - teamRouter (생성/조회/초대/수락/제거/역할변경)
  - adminProcedure (관리자 전용 미들웨어)
  - sendInviteEmail (Resend API 기반 초대 이메일)
  - 팀 ID 기반 분석 결과 필터링 미들웨어
  - 팀 설정 UI (초대 다이얼로그 + 멤버 목록)
  - /invite/[token] 초대 수락 페이지

affects: [03-06, dashboard-features]

tech-stack:
  added: [resend]
  patterns: [adminProcedure RBAC 미들웨어, lazy Resend 초기화, 팀 기반 데이터 격리]

key-files:
  created:
    - apps/web/src/server/email.ts
    - apps/web/src/server/trpc/routers/team.ts
    - apps/web/src/components/team/invite-dialog.tsx
    - apps/web/src/components/team/member-list.tsx
    - apps/web/src/components/team/team-settings.tsx
    - apps/web/src/app/invite/[token]/page.tsx
  modified:
    - apps/web/src/server/trpc/init.ts
    - apps/web/src/server/trpc/router.ts
    - apps/web/src/server/trpc/routers/analysis.ts
    - apps/web/src/server/trpc/routers/pipeline.ts
    - apps/web/src/server/trpc/routers/history.ts
    - apps/web/src/components/layout/top-nav.tsx

key-decisions:
  - "Resend lazy 초기화로 빌드 시 API 키 없어도 에러 방지"
  - "adminProcedure를 별도 미들웨어로 분리하여 재사용 가능하게 구현"
  - "팀 필터링을 각 라우터의 쿼리 레벨에서 WHERE 조건으로 적용"

patterns-established:
  - "adminProcedure: 관리자 전용 tRPC 미들웨어 패턴"
  - "protectedProcedure에 teamId/teamRole 컨텍스트 주입"
  - "Dialog-in-Dropdown: top-nav 드롭다운 내 Dialog 트리거 패턴"

requirements-completed: [TEAM-02, TEAM-03]

duration: 8min
completed: 2026-03-24
---

# Phase 03 Plan 05: Team Management Summary

**Resend 이메일 기반 팀원 초대 + RBAC 역할 관리(Admin/Member) + 팀 ID 기반 분석 결과 격리 필터링**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T09:07:45Z
- **Completed:** 2026-03-24T09:15:45Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- teamRouter: 팀 CRUD + 초대/수락/제거/역할변경 7개 프로시저 구현
- adminProcedure: 관리자 전용 미들웨어로 RBAC 적용
- Resend API 기반 초대 이메일 발송 (lazy 초기화로 빌드 안전)
- analysis/pipeline/history 라우터에 팀 ID 기반 데이터 격리 필터링 추가
- 팀 설정 UI: 초대 다이얼로그 + 멤버 테이블 + 역할 Badge + 제거 확인
- /invite/[token] 페이지: 자동 수락 + 만료/중복/에러 상태 처리

## Task Commits

Each task was committed atomically:

1. **Task 1: Resend 이메일 + 팀 tRPC 라우터** - `a56ee5a` (feat)
2. **Task 2: 팀원 초대 UI + 멤버 목록 + 초대 수락 페이지** - `87a1802` (feat)

## Files Created/Modified
- `apps/web/src/server/email.ts` - Resend API 이메일 발송 (lazy 초기화)
- `apps/web/src/server/trpc/init.ts` - adminProcedure + protectedProcedure 팀 컨텍스트 주입
- `apps/web/src/server/trpc/routers/team.ts` - 팀 관리 tRPC 라우터 (7개 프로시저)
- `apps/web/src/server/trpc/router.ts` - teamRouter 등록
- `apps/web/src/server/trpc/routers/analysis.ts` - 팀 필터링 추가
- `apps/web/src/server/trpc/routers/pipeline.ts` - 팀 소속 확인 추가
- `apps/web/src/server/trpc/routers/history.ts` - 팀 기반 목록 필터링
- `apps/web/src/components/team/invite-dialog.tsx` - 이메일+역할 선택 초대 다이얼로그
- `apps/web/src/components/team/member-list.tsx` - 팀원 테이블 + 역할 관리 + AlertDialog 제거 확인
- `apps/web/src/components/team/team-settings.tsx` - 팀 생성/조회 + 컴포넌트 조합
- `apps/web/src/app/invite/[token]/page.tsx` - 초대 수락 페이지 (자동 합류)
- `apps/web/src/components/layout/top-nav.tsx` - "팀 설정" Dialog 메뉴 추가

## Decisions Made
- Resend lazy 초기화: 빌드 시 RESEND_API_KEY 없이도 에러 방지 (new Resend()가 즉시 에러 발생하므로)
- adminProcedure를 init.ts에 별도 미들웨어로 구현: teamRouter뿐 아니라 향후 관리자 기능에도 재사용
- 팀 필터링을 각 라우터 쿼리 레벨에서 적용: 미들웨어가 아닌 WHERE 조건으로 세밀한 제어

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resend lazy 초기화**
- **Found during:** Task 1
- **Issue:** `new Resend(process.env.RESEND_API_KEY)` 가 빌드 시 환경 변수 없으면 즉시 에러 발생
- **Fix:** lazy getter 패턴으로 변경, 실제 이메일 발송 시에만 인스턴스 생성
- **Files modified:** apps/web/src/server/email.ts
- **Verification:** `pnpm --filter @ai-signalcraft/web build` exit 0

**2. [Rule 1 - Bug] TypeScript 타입 에러 수정**
- **Found during:** Task 1
- **Issue:** `ctx.session.user.id`에서 user가 undefined일 수 있다는 TS 에러
- **Fix:** optional chaining (`ctx.session.user?.id`) 적용
- **Files modified:** apps/web/src/server/trpc/routers/team.ts

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** 빌드 안정성과 타입 안전성을 위한 필수 수정. 스코프 변경 없음.

## Issues Encountered
- 병렬 에이전트 빌드 충돌: `.next/build-lock` 파일로 인해 빌드 재시도 필요 (lock 삭제 후 해결)

## User Setup Required

다음 환경 변수가 필요합니다:
- `RESEND_API_KEY` - Resend API 키 (https://resend.com에서 발급)
- `EMAIL_FROM` (선택) - 발신 이메일 주소 (기본값: `AI SignalCraft <noreply@yourdomain.com>`)

## Next Phase Readiness
- 팀 관리 기능 완성: 초대 -> 이메일 -> 수락 -> 합류 플로우 동작
- 팀 기반 데이터 격리 적용: 같은 팀원이 동일한 분석 결과에 접근 가능
- Plan 06 (리포트 뷰어/다운로드)에서 팀 필터링 활용 가능

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 병렬 실행 에이전트로 Skill 도구 미사용 |
| superpowers:test-driven-development | Plan에 TDD 태스크 없음 |
| superpowers:systematic-debugging | 치명적 버그 미발생 (타입 에러만 발생) |
| superpowers:requesting-code-review | 병렬 실행 에이전트로 Skill 도구 미사용 |

---
*Phase: 03-dashboard-team*
*Completed: 2026-03-24*
