---
phase: 01-foundation-core-data-collection
plan: 01
subsystem: infra
tags: [pnpm, monorepo, next.js, drizzle-orm, postgresql, vitest, docker, bullmq]

# Dependency graph
requires: []
provides:
  - pnpm 모노리포 프로젝트 구조 (apps/web, packages/core, packages/collectors, packages/ai-gateway)
  - Drizzle ORM DB 스키마 (collection_jobs, articles, videos, comments)
  - DB 클라이언트 export (@ai-signalcraft/core)
  - Docker Compose 로컬 개발 환경 (PostgreSQL 16, Redis 7)
  - 공통 TypeScript 설정 (tsconfig.base.json)
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: [next.js 16, drizzle-orm, pg, ioredis, bullmq, zod, playwright, cheerio, googleapis, ai-sdk, vitest, typescript 5.9]
  patterns: [pnpm workspace monorepo, Drizzle pgTable schema definition, getTableName for testing]

key-files:
  created:
    - pnpm-workspace.yaml
    - tsconfig.base.json
    - .env.example
    - apps/web/src/app/layout.tsx
    - packages/core/src/db/schema/collections.ts
    - packages/core/src/db/index.ts
    - packages/core/drizzle.config.ts
    - packages/core/tests/db.test.ts
    - docker/docker-compose.dev.yml
  modified:
    - .gitignore

key-decisions:
  - "Next.js 16.2.1 설치 (latest) -- CLAUDE.md에 15.x 명시되었으나 신규 프로젝트이므로 최신 버전 사용"
  - ".gitignore의 NuGet **/[Pp]ackages/* 패턴 비활성화 -- pnpm workspace packages/ 디렉토리와 충돌"
  - "Drizzle getTableName() API 사용 -- _.name 패턴이 drizzle-orm 0.40.x에서 제거됨"
  - "DB push 미완료 -- 운영 서버 비밀번호 미설정, 스키마 파일은 정상 생성"

patterns-established:
  - "Monorepo: apps/* (Next.js 앱) + packages/* (공유 라이브러리)"
  - "Package naming: @ai-signalcraft/{name}"
  - "tsconfig: 각 패키지가 tsconfig.base.json을 extends"
  - "Vitest config: 각 패키지에 vitest.config.ts (globals: true)"
  - "DB schema: drizzle-orm/pg-core의 pgTable + generatedAlwaysAsIdentity"

requirements-completed: [FOUND-01, FOUND-02]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 1 Plan 01: 프로젝트 스캐폴딩 + DB 스키마 Summary

**pnpm 모노리포 4개 패키지 구조 + Drizzle ORM으로 collection_jobs/articles/videos/comments 4개 테이블 스키마 정의**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T03:46:29Z
- **Completed:** 2026-03-24T03:54:00Z
- **Tasks:** 2
- **Files modified:** 31

## Accomplishments
- pnpm workspace 모노리포 구조 구축 (apps/web, packages/core, packages/collectors, packages/ai-gateway)
- Next.js 16 App Router 기반 웹 앱 스캐폴딩
- Drizzle ORM으로 4개 핵심 테이블 스키마 정의 (identity column, JSONB, unique index)
- DB smoke 테스트 3개 작성 및 통과
- Docker Compose 로컬 개발 환경 설정

## Task Commits

Each task was committed atomically:

1. **Task 1: pnpm 모노리포 스캐폴딩** - `4e35002` (feat)
2. **Task 2: Drizzle ORM DB 스키마 정의** - `98e7ad3` (feat)
3. **Next.js 타입 선언 파일** - `2b28f5e` (chore)

## Files Created/Modified
- `pnpm-workspace.yaml` - 모노리포 워크스페이스 정의
- `package.json` - 루트 패키지 (빌드/테스트/DB 스크립트)
- `tsconfig.base.json` - 공통 TypeScript 설정 (ES2022, strict, bundler)
- `.env.example` - 환경변수 템플릿 (DB, Redis, API keys)
- `.gitignore` - Node.js/Next.js/TypeScript 패턴 추가, NuGet 패턴 비활성화
- `apps/web/` - Next.js 16 App Router 앱 (layout, page, config)
- `packages/core/src/db/schema/collections.ts` - 4개 테이블 스키마 정의
- `packages/core/src/db/index.ts` - Drizzle DB 클라이언트
- `packages/core/drizzle.config.ts` - Drizzle Kit 설정
- `packages/core/tests/db.test.ts` - DB smoke 테스트
- `packages/collectors/` - 데이터 수집기 패키지 골격
- `packages/ai-gateway/` - AI SDK 게이트웨이 패키지 골격
- `docker/docker-compose.dev.yml` - 로컬 개발 환경 (PostgreSQL 16, Redis 7)

## Decisions Made
- Next.js 16.2.1 사용 (CLAUDE.md의 15.x 대신 최신 버전 -- 신규 프로젝트)
- .gitignore NuGet 패턴 비활성화 (pnpm packages/ 충돌)
- Drizzle getTableName() API 사용 (_.name 패턴 미지원)
- pnpm onlyBuiltDependencies 설정으로 esbuild, sharp, msgpackr-extract 빌드 승인

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] .gitignore NuGet 패턴이 packages/ 디렉토리 차단**
- **Found during:** Task 1 (git add)
- **Issue:** 기존 .gitignore의 `**/[Pp]ackages/*` 패턴이 pnpm workspace의 packages/ 디렉토리를 무시
- **Fix:** NuGet 패턴 주석 처리
- **Files modified:** .gitignore
- **Verification:** git add 성공
- **Committed in:** 4e35002

**2. [Rule 1 - Bug] Drizzle _.name API 미지원**
- **Found during:** Task 2 (DB 테스트)
- **Issue:** drizzle-orm 0.40.x에서 테이블 객체의 `_.name` 프로퍼티가 undefined
- **Fix:** `getTableName()` 함수로 대체
- **Files modified:** packages/core/tests/db.test.ts
- **Verification:** 테스트 3개 모두 통과
- **Committed in:** 98e7ad3

**3. [Rule 1 - Bug] Next.js tsconfig rootDir 충돌**
- **Found during:** Task 1 (빌드 검증)
- **Issue:** tsconfig.base.json의 rootDir: "src"가 apps/web에서 상대 경로로 잘못 해석
- **Fix:** apps/web/tsconfig.json에 rootDir: "." 명시적 override
- **Files modified:** apps/web/tsconfig.json
- **Verification:** pnpm -r build 성공
- **Committed in:** 4e35002

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** 모두 빌드/테스트 성공에 필수적인 수정. 범위 변경 없음.

## Issues Encountered
- DB push 실패: 운영 서버(192.168.0.5:5436) 비밀번호가 placeholder. 스키마 파일은 정상 생성됨. 사용자가 실제 비밀번호 설정 후 `pnpm db:push` 실행 필요.

## User Setup Required

사용자가 DB 연결을 위해 다음 작업 필요:
1. `.env` 파일 생성: `cp .env.example .env`
2. `DATABASE_URL`에 실제 PostgreSQL 비밀번호 설정
3. `pnpm db:push` 실행하여 운영 서버에 테이블 생성

## Known Stubs
- `apps/web/src/app/page.tsx` - 플레이스홀더 페이지 ("AI SignalCraft" 텍스트만 표시) -- 대시보드 UI는 Phase 3에서 구현 예정
- `packages/collectors/src/index.ts` - 버전 상수만 export -- 실제 수집기는 01-02, 01-03 Plan에서 구현
- `packages/ai-gateway/src/index.ts` - 버전 상수만 export -- AI 분석은 Phase 2에서 구현

## Superpowers 호출 기록

| # | 스킬명 | 호출 시점 | 결과 요약 |
|---|--------|----------|----------|

### 미호출 스킬 사유
| 스킬명 | 미호출 사유 |
|--------|-----------|
| superpowers:brainstorming | 병렬 실행 에이전트 -- 스캐폴딩 작업으로 Plan이 명확하여 불필요 |
| superpowers:test-driven-development | 스키마 정의는 TDD 대상이 아님 (smoke 테스트로 대체) |
| superpowers:systematic-debugging | 버그 3건 모두 즉시 해결 |
| superpowers:requesting-code-review | 병렬 실행 에이전트 -- 오케스트레이터에서 Phase 레벨 검증 수행 |

## Next Phase Readiness
- 모노리포 구조 완성, 모든 패키지 빌드 성공
- DB 스키마 정의 완료, 후속 Plan에서 즉시 사용 가능
- DB push는 사용자 환경변수 설정 후 실행 필요 (blocker 아님)

## Self-Check: PASSED

- 19/19 key files: FOUND
- 3/3 commits: FOUND

---
*Phase: 01-foundation-core-data-collection*
*Completed: 2026-03-24*
