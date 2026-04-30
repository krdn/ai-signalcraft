# next-auth 5 안정화 평가 보고서

**작성일**: 2026-04-30
**평가 범위**: ai-signalcraft 프로젝트의 `next-auth: 5.0.0-beta.30` 의존성 향후 처리 방향
**결론**: **현 상태 유지 + Better Auth 마이그레이션 별도 spec 작성** (코드 변경 없음)

---

## 핵심 발견

### 1. Auth.js v5는 stable 릴리스 일정이 없다

[Auth.js v5 release schedule](https://github.com/nextauthjs/next-auth/discussions/7513)에서 확인된 사실:

- v5는 2024년 1월 첫 베타 이후 2026년 4월 현재까지 **stable 미릴리스**
- 베타 30+ 버전 누적, "stable 태그를 기다리지 말고 v5 API가 요구사항에 맞는지 직접 평가"라는 공식 권고
- 사실상 베타가 production-grade로 사용되고 있음

### 2. Auth.js는 Better Auth에 합병됨

[Auth.js is now part of Better Auth](https://better-auth.com/blog/authjs-joins-better-auth):

- Auth.js 프로젝트가 Better Auth 팀의 유지보수로 이관
- Auth.js v5는 **보안 패치 및 긴급 수정만 지속**, 새 기능 개발은 Better Auth로
- 신규 프로젝트는 Better Auth 권장
- 기존 Auth.js 사용자는 즉시 이전할 필요 없음 — 단, 장기적으로 Better Auth 마이그레이션 권장

### 3. Next.js 16에서 middleware.ts → proxy.ts 변경

Next.js 16에서 `middleware.ts`가 `proxy.ts`로 리네임됨. 본 프로젝트는 이미 Next 16.2.2를 사용 중이지만 `apps/web/src/middleware.ts`로 운영 중. **Next.js 자체는 한동안 호환성 유지**, 그러나 Better Auth 마이그레이션 시 `proxy.ts` 전환을 동시 수행 권장.

---

## 본 프로젝트의 사용 인벤토리

### 코어 모듈

| 파일                                 | 역할                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `apps/web/src/server/auth.ts`        | NextAuth 설정 + DrizzleAdapter + JWT/session 콜백 + signIn 콜백(Google 신규 가입자 처리) |
| `apps/web/src/server/auth.config.ts` | `NextAuthConfig` 베이스 (middleware에서 공유)                                            |
| `apps/web/src/middleware.ts`         | NextAuth(authConfig) 미들웨어 — 페이지 보호                                              |
| `apps/web/src/types/next-auth.d.ts`  | session.user.role 타입 확장                                                              |

### 호출 지점

**서버 측 `auth()`**:

- `apps/web/src/server/trpc/init.ts` — tRPC 컨텍스트에서 세션 추출
- `apps/web/src/app/api/pipeline/[jobId]/stream/route.ts` — SSE 스트림 권한 검증

**클라이언트 측 `useSession()` / `signIn()`**:

- `app/signup/page.tsx`, `app/dashboard/page.tsx`, `app/demo/page.tsx`, `app/invite/[token]/page.tsx`
- `components/analysis/trigger-form.tsx`, `history-table.tsx`, `recent-jobs.tsx`
- `components/auth/login-form.tsx`, `layout/app-sidebar.tsx`, `landing/landing-content.tsx`
- `components/providers.tsx` — `SessionProvider` 래퍼

**Drizzle Adapter**:

- `auth.ts:59`에서 `DrizzleAdapter(db, { usersTable, accountsTable, sessionsTable, verificationTokensTable })` 사용
- 스키마: `packages/core/src/db/schema/auth.ts` (recovered via `@ai-signalcraft/core` re-export)

### 사용 중인 프로바이더

- **Credentials** (이메일/비밀번호 + bcrypt) — `auth.ts:21-45`
- **Google OAuth** (조건부, 환경변수 있을 때만) — `auth.ts:47-53`

### 커스텀 콜백 (마이그레이션 시 영향 큼)

1. `events.createUser` — Google OAuth 신규 사용자에게 demo role/quota 부여 + demo_signup 쿠키 처리
2. `callbacks.signIn` — Google OAuth 신규 사용자가 demo 쿠키 없으면 `/demo?error=signup_required` 리디렉트
3. `callbacks.jwt` — 매 토큰 갱신 시 DB에서 role 재조회 (권한 즉시 반영)
4. `callbacks.session` — `session.user.id`와 `session.user.role` 주입

---

## 마이그레이션 옵션 비교

### 옵션 A: 현 상태 유지 (권장 — 본 평가의 결론)

**근거**:

- Auth.js v5 베타 30+이 production-grade로 사용되고 있음
- 보안 패치는 계속 지원됨
- 본 프로젝트의 인증 흐름이 **안정적으로 동작 중**, 마이그레이션 중 사용자 강제 로그아웃 리스크 회피
- 리팩토링 마스터플랜의 다른 phase(코드 분해, 테스트)에 집중

**리스크**:

- "곧 stable 나올 것"을 기대해 의존하는 것은 비현실 (3년차 베타)
- 장기적으로 Better Auth 마이그레이션 검토 필요 (1년 이내)

**조치**:

- 본 보고서를 spec으로 commit
- next-auth `5.0.0-beta.30` 버전 고정 유지 (PR 1-A에서 SemVer 명시)
- 보안 패치 모니터링: [Releases](https://github.com/nextauthjs/next-auth/releases)

### 옵션 B: 다른 v5 베타 버전으로 업그레이드 (소극적 이동)

**근거**: 현재 5.0.0-beta.30이 약간 오래됨. 최신 베타로 이동 가능.

**리스크**: 베타 내에서도 API 변경 가능성. 현재 안정적이므로 명확한 이유 없이 변경 비추천.

**조치**: 보안 issue 발견 시에만 시도.

### 옵션 C: Better Auth 마이그레이션 (장기 — 별도 spec)

**근거**: 신규 프로젝트 표준이며 적극 개발 중.

**필요 작업** (별도 spec으로 분리):

1. **DB 스키마 변경** ([Migrating from Auth.js](https://better-auth.com/docs/guides/next-auth-migration-guide)):
   - `users`, `accounts`, `sessions`, `verification_tokens` 테이블의 컬럼 이름/타입 차이
   - 기존 사용자 데이터 마이그레이션 SQL
2. **API Route 재작성**: `/app/api/auth/[...nextauth]/route.ts` → `/app/api/auth/[...all]/route.ts`
3. **미들웨어 → 프록시** (Next 16): `middleware.ts` → `proxy.ts` (선택적)
4. **클라이언트 hook 교체**: `useSession()` → Better Auth client hook
5. **콜백 재작성**: 위 4개 커스텀 콜백을 Better Auth의 hook/plugin으로 변환
6. **테스트**: 로그인/Google OAuth/세션 만료 시나리오 전수 테스트
7. **운영 배포 시 사용자 영향**: JWT 비밀 키 처리 변경 → **전 사용자 강제 로그아웃 가능** (배포 시점 사전 공지 필요)

**예상 작업량**: 별도 spec + 5~8개 PR + 1~2주 검증 기간

---

## 결론 및 권고

### 본 마스터플랜(리팩토링 Phase 1) 범위

✅ **PR 1-A에서 `5.0.0-beta.30` 명시 버전 유지** — 변경 없음 (이미 명시 버전이라 PR 1-A의 latest 고정 대상도 아님)
✅ **본 평가 보고서 commit** (PR 1-C 산출물)
❌ **마이그레이션은 본 마스터플랜 범위에서 제외**

### 후속 조치 (별도 spec 작성 시점)

다음 중 하나의 트리거가 발생하면 Better Auth 마이그레이션 spec 작성:

1. Auth.js v5에 보안 취약점이 발견되고 패치가 늦어지는 경우
2. Better Auth가 본 프로젝트가 필요한 기능(예: passkey, multi-tenant)을 제공하기 시작하는 경우
3. 팀이 인증 영역에 새로운 기능(SSO, 2FA 등)을 추가하기로 결정하는 경우
4. Phase 2~3 종료 후 안정 시기에 의도적으로 모던화 사이클을 갖는 경우

### 모니터링 리소스

- [Auth.js Releases](https://github.com/nextauthjs/next-auth/releases)
- [Better Auth Docs](https://better-auth.com/docs)
- [Migration Guide](https://better-auth.com/docs/guides/next-auth-migration-guide)
- [Auth.js → Better Auth 합병 발표](https://better-auth.com/blog/authjs-joins-better-auth)

---

## Sources

- [Auth.js Releases — GitHub](https://github.com/nextauthjs/next-auth/releases)
- [Auth.js v5 release schedule discussion](https://github.com/nextauthjs/next-auth/discussions/7513)
- [Auth.js is now part of Better Auth — discussion](https://github.com/nextauthjs/next-auth/discussions/13252)
- [Better Auth: Auth.js joins Better Auth — blog](https://better-auth.com/blog/authjs-joins-better-auth)
- [Migrating from Auth.js to Better Auth](https://better-auth.com/docs/guides/next-auth-migration-guide)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
