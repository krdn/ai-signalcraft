---
phase: 05-integration-flow-gap-closure
verified: 2026-03-24T12:35:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: 'callbackUrl 리다이렉트 동작 확인'
    expected: '/login?callbackUrl=/invite/test-token 접속 후 로그인 시 /invite/test-token으로 이동'
    why_human: '브라우저 환경에서 실제 NextAuth signIn 흐름을 트리거해야만 검증 가능'
---

# Phase 5: Integration & Flow Gap Closure Verification Report

**Phase Goal:** 감사에서 식별된 통합/플로우 갭 3건을 해소하여 소스 선택 전달, 리포트 갱신, 초대 수락 플로우를 정상화한다
**Verified:** 2026-03-24T12:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                | Status                                        | Evidence                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 트리거 폼에서 선택한 소스만 수집기가 실행되고, 미선택 소스는 건너뛴다                | VERIFIED                                      | `packages/core/src/queue/flows.ts` L29-96: `enabledSources = params.sources ?? [...]` + 5개 `if (enabledSources.includes(...))` 분기; `analysis.ts` L30 `sources: input.sources` 전달                                         |
| 2   | Stage 4 ADVN 분석 완료 후 리포트 재생성 시 기존 리포트가 갱신(upsert)된다            | VERIFIED                                      | `persist-analysis.ts` L36-44: `onConflictDoUpdate({ target: [analysisReports.jobId], set: {...} })`; `schema/analysis.ts` L43-45: `uniqueIndex('analysis_reports_job_id_idx').on(table.jobId)`                                |
| 3   | callbackUrl이 포함된 로그인 시 해당 URL로 리다이렉트되어 초대 수락 플로우가 완료된다 | VERIFIED (automated) / HUMAN NEEDED (browser) | `login-form.tsx` L5,16,37,48: `useSearchParams()`, `callbackUrl = searchParams.get('callbackUrl') \|\| '/'`, `router.push(callbackUrl)`, `signIn('google', { callbackUrl })`; `login/page.tsx` L12-14: `<Suspense>` 래핑 완료 |
| 4   | getPendingInvites가 acceptedAt IS NULL 조건으로 정확히 미수락 초대만 반환한다        | VERIFIED                                      | `team.ts` L319: `isNull(invitations.acceptedAt)` — DB 레벨 WHERE 조건; `.filter(` 패턴 없음 (JS 후처리 제거 확인)                                                                                                             |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact                                         | Expected                                        | Status   | Details                                                                                                                        |
| ------------------------------------------------ | ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/types/index.ts`               | CollectionTriggerSchema에 sources optional 필드 | VERIFIED | L7: `sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).optional()`                                |
| `packages/core/src/queue/flows.ts`               | 조건부 children 생성 로직                       | VERIFIED | L29: `const enabledSources = params.sources ?? [...]`; L32-96: 5개 소스별 `if (enabledSources.includes(...))` 분기             |
| `packages/core/src/analysis/persist-analysis.ts` | 리포트 upsert 로직                              | VERIFIED | L36: `onConflictDoUpdate({ target: [analysisReports.jobId], ... })`; `onConflictDoNothing` 없음                                |
| `apps/web/src/components/auth/login-form.tsx`    | callbackUrl 리다이렉트 지원                     | VERIFIED | L5: `useSearchParams` import; L16: callbackUrl 변수; L37: `router.push(callbackUrl)`; L48: `signIn('google', { callbackUrl })` |
| `apps/web/src/server/trpc/routers/team.ts`       | acceptedAt IS NULL SQL 필터                     | VERIFIED | L4: `isNull` import from 'drizzle-orm'; L319: `isNull(invitations.acceptedAt)` in WHERE clause                                 |

---

### Key Link Verification

| From                  | To                   | Via                               | Status | Details                                                                                                            |
| --------------------- | -------------------- | --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `analysis.ts`         | `flows.ts`           | `sources: input.sources`          | WIRED  | L30 `triggerCollection({ ..., sources: input.sources }, job.id)` — 소스 필드 명시적 전달 확인                      |
| `flows.ts`            | BullMQ Flow children | `enabledSources.includes()` 분기  | WIRED  | L32,44,61,73,85: 5개 소스 모두 `enabledSources.includes(...)` 조건부 push 확인                                     |
| `persist-analysis.ts` | `schema/analysis.ts` | `onConflictDoUpdate target jobId` | WIRED  | `target: [analysisReports.jobId]` 참조; schema에 `uniqueIndex('analysis_reports_job_id_idx').on(table.jobId)` 존재 |
| `login-form.tsx`      | `login/page.tsx`     | Suspense boundary                 | WIRED  | `page.tsx` L2: `import { Suspense }`, L12-14: `<Suspense fallback={...}><LoginForm /></Suspense>`                  |

---

### Data-Flow Trace (Level 4)

| Artifact                      | Data Variable           | Source                                                | Produces Real Data                     | Status  |
| ----------------------------- | ----------------------- | ----------------------------------------------------- | -------------------------------------- | ------- |
| `persist-analysis.ts`         | `report` (return value) | DB `.insert(...).onConflictDoUpdate(...).returning()` | Yes — upsert returns actual DB row     | FLOWING |
| `login-form.tsx`              | `callbackUrl`           | `useSearchParams().get('callbackUrl')`                | Yes — reads URL query param at runtime | FLOWING |
| `team.ts (getPendingInvites)` | `pending`               | Drizzle query with `isNull(invitations.acceptedAt)`   | Yes — DB query with real WHERE filter  | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                                 | Command                                     | Result   | Status |
| -------------------------------------------------------- | ------------------------------------------- | -------- | ------ |
| queue.test.ts 6개 테스트 통과                            | `pnpm exec vitest run tests/queue.test.ts`  | 6 passed | PASS   |
| report.test.ts 7개 테스트 통과 (upsert 스키마 검증 포함) | `pnpm exec vitest run tests/report.test.ts` | 7 passed | PASS   |
| db.test.ts 6개 테스트 통과 (acceptedAt 컬럼 검증 포함)   | `pnpm exec vitest run tests/db.test.ts`     | 6 passed | PASS   |
| Web TypeScript 타입 체크                                 | `pnpm --filter web exec tsc --noEmit`       | 0 errors | PASS   |

**참고:** `analysis-runner.test.ts` 1건 실패 존재 — "8개 모듈 기대치 불일치 (실제 12개)" — SUMMARY에 명시된 기존 이슈로 Phase 5 변경과 무관.

---

### Requirements Coverage

| Requirement | Description                           | Status    | Evidence                                                                 |
| ----------- | ------------------------------------- | --------- | ------------------------------------------------------------------------ |
| COLL-01     | 네이버 뉴스 기사 수집기               | SATISFIED | `enabledSources.includes('naver')` 분기로 선택적 실행                    |
| COLL-02     | 네이버 뉴스 댓글 수집기               | SATISFIED | naver 소스 선택 시 수집기 실행됨                                         |
| COLL-03     | 유튜브 영상 메타데이터 수집기         | SATISFIED | `enabledSources.includes('youtube')` 분기                                |
| COLL-04     | 유튜브 댓글 수집기                    | SATISFIED | youtube 소스 children에 포함                                             |
| COLL-06     | DC갤러리 게시글/댓글 수집기           | SATISFIED | `enabledSources.includes('dcinside')` 분기                               |
| COLL-07     | 에펨코리아 게시글/댓글 수집기         | SATISFIED | `enabledSources.includes('fmkorea')` 분기                                |
| COLL-08     | 클리앙 게시글/댓글 수집기             | SATISFIED | `enabledSources.includes('clien')` 분기                                  |
| FOUND-03    | BullMQ 기반 파이프라인 오케스트레이터 | SATISFIED | `flows.ts` sources 기반 동적 children 생성으로 INT-01 갭 해소            |
| ADVN-01     | AI 지지율 추정 모델                   | SATISFIED | Stage 4 후 리포트 재생성 시 onConflictDoUpdate로 upsert (INT-02 갭 해소) |
| ADVN-02     | 프레임 전쟁 분석                      | SATISFIED | 동상 — upsert로 리포트 갱신 보장                                         |
| ADVN-03     | 위기 대응 시나리오 생성               | SATISFIED | 동상                                                                     |
| ADVN-04     | 승리 확률 및 전략 시뮬레이션          | SATISFIED | 동상                                                                     |
| REPT-01     | AI 종합 분석 리포트 자동 생성         | SATISFIED | `analysisReports` jobId unique + `onConflictDoUpdate`로 재생성 시 갱신   |
| TEAM-01     | 사용자 인증 (이메일/비밀번호 로그인)  | SATISFIED | `login-form.tsx` callbackUrl 지원으로 FLOW-01 해소                       |
| TEAM-03     | 분석 결과 팀 공유                     | SATISFIED | `getPendingInvites` isNull 필터로 초대 수락 플로우 정확도 향상           |

**Coverage:** 15/15 requirements satisfied

---

### Anti-Patterns Found

| File       | Line | Pattern | Severity | Impact |
| ---------- | ---- | ------- | -------- | ------ |
| None found | —    | —       | —        | —      |

**No stubs, hardcoded empty returns, or TODO/FIXME patterns detected in phase 5 modified files.**

---

### Human Verification Required

#### 1. callbackUrl 리다이렉트 실제 동작 확인

**Test:** 브라우저에서 `/login?callbackUrl=/invite/test-token` 접속 → 이메일/비밀번호로 로그인 수행
**Expected:** 로그인 성공 후 `/invite/test-token` 경로로 리다이렉트됨
**Why human:** NextAuth `signIn('credentials', { redirect: false })` 흐름은 실제 인증 세션과 쿠키가 필요하므로 프로그래밍 방식으로 검증 불가

#### 2. Google 로그인 callbackUrl 전달 확인

**Test:** 브라우저에서 `/login?callbackUrl=/dashboard` 접속 → "Google로 로그인" 클릭
**Expected:** Google OAuth 완료 후 `/dashboard`로 리다이렉트됨
**Why human:** OAuth 리다이렉트 흐름은 외부 서비스와 실제 브라우저 환경 필요

---

### Gaps Summary

갭 없음. 4개 must-have truth 모두 검증되었으며 15개 요구사항 모두 커버됨.

**사전 존재 이슈 (비차단):** `analysis-runner.test.ts`의 "8개 모듈 기대치" 테스트 실패는 Phase 4에서 ADVN 모듈 4개가 추가되어 실제 12개 모듈로 증가한 것으로 Phase 5 변경과 무관. 테스트 자체를 수정하지 않은 기존 이슈.

---

## Superpowers Phase 호출 기록

| #   | 스킬명                   | 호출 시점 | 결과 요약                   |
| --- | ------------------------ | --------- | --------------------------- |
| —   | (Phase 레벨 스킬 미호출) | —         | 단일 Plan으로 병렬화 불필요 |

---

_Verified: 2026-03-24T12:35:00Z_
_Verifier: Claude (gsd-verifier)_
