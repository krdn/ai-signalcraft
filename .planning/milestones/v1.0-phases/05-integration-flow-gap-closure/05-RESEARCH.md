# Phase 5: Integration & Flow Gap Closure - Research

**Researched:** 2026-03-24
**Domain:** Cross-phase integration bugs (data flow, DB upsert, auth redirect)
**Confidence:** HIGH

## Summary

Phase 5 addresses three specific integration gaps identified during the v1.0 milestone audit: INT-01 (sources field not passed from tRPC to BullMQ), INT-02 (persistAnalysisReport uses onConflictDoNothing preventing report updates after Stage 4), and FLOW-01 (login-form.tsx ignores callbackUrl, breaking invite acceptance flow). Additionally, getPendingInvites lacks an `acceptedAt IS NULL` SQL filter.

All four issues have been precisely located in the codebase with clear root causes. The fixes are surgical -- each involves modifying 1-3 files with small, well-defined changes. No new libraries, architecture changes, or schema migrations are needed.

**Primary recommendation:** Fix all four issues in a single plan with 4 tasks (one per gap + getPendingInvites filter), since they are independent and each is small (5-20 lines changed).

<phase_requirements>

## Phase Requirements

| ID       | Description                      | Research Support                                                                  |
| -------- | -------------------------------- | --------------------------------------------------------------------------------- |
| COLL-01  | 네이버 뉴스 기사 수집기          | INT-01 fix: sources 필드 전달로 미선택 시 건너뛰기                                |
| COLL-02  | 네이버 뉴스 댓글 수집기          | INT-01 fix: sources 필드 전달로 미선택 시 건너뛰기                                |
| COLL-03  | 유튜브 영상 메타데이터 수집기    | INT-01 fix: sources 필드 전달로 미선택 시 건너뛰기                                |
| COLL-04  | 유튜브 댓글 수집기               | INT-01 fix: sources 필드 전달로 미선택 시 건너뛰기                                |
| COLL-06  | DC갤러리 수집기                  | INT-01 fix: sources 필드 전달로 미선택 시 건너뛰기                                |
| COLL-07  | 에펨코리아 수집기                | INT-01 fix: sources 필드 전달로 미선택 시 건너뛰기                                |
| COLL-08  | 클리앙 수집기                    | INT-01 fix: sources 필드 전달로 미선택 시 건너뛰기                                |
| FOUND-03 | BullMQ 파이프라인 오케스트레이터 | INT-01 fix: triggerCollection이 sources 파라미터 기반 조건부 Flow 생성            |
| ADVN-01  | AI 지지율 추정 모델              | INT-02 fix: Stage 4 후 리포트 upsert로 ADVN 결과 반영                             |
| ADVN-02  | 프레임 전쟁 분석                 | INT-02 fix: Stage 4 후 리포트 upsert로 ADVN 결과 반영                             |
| ADVN-03  | 위기 대응 시나리오               | INT-02 fix: Stage 4 후 리포트 upsert로 ADVN 결과 반영                             |
| ADVN-04  | 승리 확률 시뮬레이션             | INT-02 fix: Stage 4 후 리포트 upsert로 ADVN 결과 반영                             |
| REPT-01  | AI 종합 분석 리포트 자동 생성    | INT-02 fix: 리포트 upsert로 최신 분석 결과가 항상 리포트에 포함                   |
| TEAM-01  | 사용자 인증                      | FLOW-01 fix: callbackUrl 반영으로 초대 수락 후 로그인 리다이렉트 정상화           |
| TEAM-03  | 분석 결과 팀 공유                | FLOW-01 fix: 초대 수락 플로우 완료로 팀 합류 정상화 + getPendingInvites 필터 수정 |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **패키지 매니저**: pnpm
- **GSD Workflow Enforcement**: Edit/Write 전 GSD 명령으로 작업 시작
- **커밋 메시지**: 한국어, `<타입>: <제목>` 형식
- **보안**: API 키 하드코딩 금지, .env 커밋 금지
- **FSD 아키텍처**: 의존성 방향 준수 (app -> widgets -> features -> entities -> shared)
- **Superpowers 호출 규칙**: brainstorming(Task 1 전), TDD(코드 구현 시), code-review(완료 후) 필수

## Standard Stack

이 Phase는 기존 스택에서 작업하며 새 라이브러리 추가 없음.

### 변경 대상 파일 목록

| File                                             | Gap     | Change                                                    |
| ------------------------------------------------ | ------- | --------------------------------------------------------- |
| `packages/core/src/types/index.ts`               | INT-01  | CollectionTrigger에 `sources` 필드 추가                   |
| `packages/core/src/queue/flows.ts`               | INT-01  | triggerCollection에서 sources 기반 조건부 Flow 생성       |
| `apps/web/src/server/trpc/routers/analysis.ts`   | INT-01  | trigger mutation에서 sources를 triggerCollection에 전달   |
| `packages/core/src/analysis/persist-analysis.ts` | INT-02  | persistAnalysisReport를 onConflictDoUpdate로 변경         |
| `packages/core/src/db/schema/analysis.ts`        | INT-02  | analysisReports에 jobId unique constraint 추가            |
| `apps/web/src/components/auth/login-form.tsx`    | FLOW-01 | useSearchParams로 callbackUrl 읽어서 signIn 후 리다이렉트 |
| `apps/web/src/server/trpc/routers/team.ts`       | FLOW-01 | getPendingInvites에 acceptedAt IS NULL SQL 조건 추가      |

## Architecture Patterns

### Gap 1: INT-01 -- sources 필드 tRPC -> BullMQ 전달

**현재 문제:**

- `trigger-form.tsx`에서 `sources: ['naver', 'youtube']` 등 선택 전달
- `analysis.ts` tRPC router에서 input.sources를 받지만 triggerCollection에 전달하지 않음 (line 26-30)
- `flows.ts` triggerCollection은 CollectionTrigger에 sources 필드가 없어 항상 5개 소스 전부 실행

**수정 전략:**

1. `CollectionTrigger` 스키마에 `sources` 필드 추가 (optional, 하위 호환)
2. `analysis.ts`에서 `triggerCollection({ ...params, sources: input.sources }, job.id)` 전달
3. `flows.ts`에서 `params.sources`가 있으면 해당 소스만 children에 포함

```typescript
// packages/core/src/types/index.ts -- sources 필드 추가
export const CollectionTriggerSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).optional(),
  limits: z
    .object({
      /* 기존 */
    })
    .optional(),
});
```

```typescript
// packages/core/src/queue/flows.ts -- 조건부 children 생성
const enabledSources = params.sources ?? ['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'];
const children = [];

if (enabledSources.includes('naver')) {
  children.push({ name: 'normalize-naver' /* 기존 naver 블록 */ });
}
if (enabledSources.includes('youtube')) {
  children.push({ name: 'normalize-youtube' /* 기존 youtube 블록 */ });
}
// dcinside, fmkorea, clien 동일 패턴
```

### Gap 2: INT-02 -- persistAnalysisReport onConflictDoNothing -> onConflictDoUpdate

**현재 문제:**

- `analysisReports` 테이블에 jobId unique constraint가 없음
- `persistAnalysisReport`가 `onConflictDoNothing()` 사용 -- 충돌 시 아무 것도 안 함
- `runner.ts` line 201-210에서 Stage 4 완료 후 `generateIntegratedReport` 재호출하지만, 이미 리포트가 있으면 갱신 불가

**수정 전략:**

1. `analysisReports` 스키마에 `jobId` uniqueIndex 추가
2. `persistAnalysisReport`를 `onConflictDoUpdate`로 변경 -- title, markdownContent, oneLiner, metadata 갱신

```typescript
// packages/core/src/db/schema/analysis.ts -- unique constraint 추가
export const analysisReports = pgTable(
  'analysis_reports',
  {
    // 기존 필드 동일
  },
  (table) => [uniqueIndex('analysis_reports_job_id_idx').on(table.jobId)],
);
```

```typescript
// packages/core/src/analysis/persist-analysis.ts -- upsert로 변경
export async function persistAnalysisReport(data: typeof analysisReports.$inferInsert) {
  const [report] = await db
    .insert(analysisReports)
    .values(data)
    .onConflictDoUpdate({
      target: [analysisReports.jobId],
      set: {
        title: sql`excluded.title`,
        markdownContent: sql`excluded.markdown_content`,
        oneLiner: sql`excluded.one_liner`,
        metadata: sql`excluded.metadata`,
      },
    })
    .returning();
  return report;
}
```

**DB 마이그레이션 필요:** `analysisReports.jobId`에 unique constraint 추가. Drizzle push 또는 migration 생성 필요. 기존 데이터에 중복 jobId가 없으면 안전하게 적용 가능.

### Gap 3: FLOW-01 -- login-form.tsx callbackUrl 미반영

**현재 문제:**

- `invite/[token]/page.tsx` line 45: 미인증 시 `/login?callbackUrl=/invite/${token}`으로 리다이렉트
- `login-form.tsx` line 35: 로그인 성공 시 항상 `router.push('/')` 하드코딩
- line 46: Google 로그인도 `callbackUrl: '/'` 하드코딩

**수정 전략:**

- `useSearchParams()`로 URL에서 callbackUrl 읽기
- credentials 로그인 성공 시 `router.push(callbackUrl || '/')`
- Google 로그인 시 `signIn('google', { callbackUrl: callbackUrl || '/' })`

```typescript
// apps/web/src/components/auth/login-form.tsx
import { useSearchParams } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  // ...

  // credentials 로그인 성공 시
  router.push(callbackUrl);

  // Google 로그인
  signIn('google', { callbackUrl });
}
```

**Suspense boundary 주의:** `useSearchParams()`는 Next.js App Router에서 Suspense boundary를 요구할 수 있음. `login/page.tsx`에서 `<Suspense>` 래핑이 필요할 수 있음.

### Gap 4: getPendingInvites acceptedAt 필터 누락

**현재 문제:**

- `team.ts` line 305-323: getPendingInvites가 `acceptedAt IS NULL` 조건 없이 조회
- SQL WHERE에 `teamId == ctx.teamId AND expiresAt > now()` 조건만 있음
- line 323의 JS 필터는 `!inv.expiresAt || inv.expiresAt > new Date()` -- acceptedAt 필터 아님 (버그)

**수정 전략:**
Drizzle의 `isNull()` 사용:

```typescript
import { eq, and, gt, isNull } from 'drizzle-orm';

// getPendingInvites
const pending = await ctx.db
  .select({
    /* 기존 필드 */
  })
  .from(invitations)
  .where(
    and(
      eq(invitations.teamId, ctx.teamId),
      gt(invitations.expiresAt, new Date()),
      isNull(invitations.acceptedAt), // 미수락 초대만
    ),
  );
return pending; // JS 필터 제거
```

## Don't Hand-Roll

| Problem                | Don't Build                    | Use Instead                  | Why                                     |
| ---------------------- | ------------------------------ | ---------------------------- | --------------------------------------- |
| SQL IS NULL 조건       | JS `.filter()` post-processing | Drizzle `isNull()`           | DB 레벨 필터가 정확하고 성능적으로 우수 |
| URL 쿼리 파라미터 파싱 | 수동 URL.searchParams          | Next.js `useSearchParams()`  | App Router 통합, 자동 서스펜스 처리     |
| Upsert 로직            | SELECT + INSERT/UPDATE 분기    | Drizzle `onConflictDoUpdate` | 원자적 작업, race condition 방지        |

## Common Pitfalls

### Pitfall 1: Suspense boundary for useSearchParams

**What goes wrong:** Next.js App Router에서 `useSearchParams()`를 사용하면 빌드 시 static rendering을 opt-out하며, Suspense boundary 없으면 경고/에러 발생
**Why it happens:** useSearchParams는 클라이언트에서만 사용 가능한 dynamic API
**How to avoid:** `login/page.tsx`에서 `LoginForm`을 `<Suspense fallback={...}>`로 래핑
**Warning signs:** 빌드 시 "useSearchParams() should be wrapped in a suspense boundary" 경고

### Pitfall 2: analysisReports uniqueIndex migration

**What goes wrong:** unique constraint 추가 시 기존 중복 데이터가 있으면 migration 실패
**Why it happens:** 개발 중 같은 jobId로 여러 리포트가 생성되었을 가능성
**How to avoid:** migration 전 `SELECT job_id, COUNT(*) FROM analysis_reports GROUP BY job_id HAVING COUNT(*) > 1` 확인
**Warning signs:** Drizzle push 실패, "duplicate key violates unique constraint" 에러

### Pitfall 3: BullMQ Flow children 빈 배열

**What goes wrong:** sources 필터링 후 children이 빈 배열이면 Flow가 실패하거나 persist 작업이 즉시 완료됨
**Why it happens:** 사용자가 소스를 선택하지 않으면 (UI에서 min(1) 검증이 있지만 방어적 처리 필요)
**How to avoid:** tRPC input validation에서 `sources.min(1)` 이미 적용됨 (analysis.ts line 11). flows.ts에서도 방어적 체크 추가

### Pitfall 4: onConflictDoUpdate의 target과 실제 constraint 불일치

**What goes wrong:** Drizzle onConflictDoUpdate의 target이 DB의 실제 unique constraint와 다르면 SQL 에러
**Why it happens:** 스키마에 uniqueIndex를 추가했지만 DB에 반영하지 않음
**How to avoid:** Drizzle push 또는 migration을 반드시 실행하여 DB 스키마 동기화

## Code Examples

### INT-01: analysis.ts에서 sources 전달

```typescript
// apps/web/src/server/trpc/routers/analysis.ts -- line 26-30 수정
await triggerCollection(
  {
    keyword: input.keyword,
    startDate: new Date(input.startDate).toISOString(),
    endDate: new Date(input.endDate).toISOString(),
    sources: input.sources, // 추가
  },
  job.id,
);
```

### INT-02: persistAnalysisReport upsert

```typescript
// packages/core/src/analysis/persist-analysis.ts -- line 32-38 수정
export async function persistAnalysisReport(data: typeof analysisReports.$inferInsert) {
  const [report] = await db
    .insert(analysisReports)
    .values(data)
    .onConflictDoUpdate({
      target: [analysisReports.jobId],
      set: {
        title: sql`excluded.title`,
        markdownContent: sql`excluded.markdown_content`,
        oneLiner: sql`excluded.one_liner`,
        metadata: sql`excluded.metadata`,
      },
    })
    .returning();
  return report;
}
```

### FLOW-01: login-form.tsx callbackUrl 처리

```typescript
// apps/web/src/components/auth/login-form.tsx
import { useSearchParams } from 'next/navigation';

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  // ... 기존 state

  // credentials 성공 시
  router.push(callbackUrl);
  router.refresh();

  // Google 로그인
  signIn('google', { callbackUrl });
}
```

### getPendingInvites 수정

```typescript
// apps/web/src/server/trpc/routers/team.ts -- line 305-324 수정
import { eq, and, gt, isNull } from 'drizzle-orm';

getPendingInvites: adminProcedure.query(async ({ ctx }) => {
  const pending = await ctx.db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.teamId, ctx.teamId),
        gt(invitations.expiresAt, new Date()),
        isNull(invitations.acceptedAt),
      ),
    );
  return pending;
}),
```

## Validation Architecture

### Test Framework

| Property           | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Framework          | Vitest 3.x                                                    |
| Config file        | `packages/core/vitest.config.ts`, `apps/web/vitest.config.ts` |
| Quick run command  | `pnpm --filter @ai-signalcraft/core test`                     |
| Full suite command | `pnpm -r test`                                                |

### Phase Requirements -> Test Map

| Req ID   | Behavior                                                                       | Test Type   | Automated Command                                                       | File Exists?                   |
| -------- | ------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------- | ------------------------------ |
| INT-01   | sources 필드가 triggerCollection에 전달되어 선택한 소스만 Flow children에 포함 | unit        | `pnpm --filter @ai-signalcraft/core vitest run tests/queue.test.ts -x`  | 기존 queue.test.ts 확장 필요   |
| INT-02   | persistAnalysisReport가 동일 jobId에 대해 upsert 수행                          | unit        | `pnpm --filter @ai-signalcraft/core vitest run tests/report.test.ts -x` | 기존 report.test.ts 확장 필요  |
| FLOW-01  | LoginForm이 callbackUrl 쿼리 파라미터를 읽어 리다이렉트                        | manual-only | N/A                                                                     | 웹 컴포넌트 테스트 인프라 없음 |
| FLOW-01b | getPendingInvites가 acceptedAt IS NULL 필터 적용                               | unit        | `pnpm --filter @ai-signalcraft/core vitest run tests/db.test.ts -x`     | 신규 테스트 또는 기존 확장     |

### Sampling Rate

- **Per task commit:** `pnpm --filter @ai-signalcraft/core test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/core/tests/queue.test.ts` -- sources 필터링 검증 테스트 추가
- [ ] `packages/core/tests/report.test.ts` -- upsert 동작 검증 테스트 추가

## Open Questions

1. **analysisReports 중복 데이터 존재 여부**
   - What we know: 개발 중 동일 jobId로 여러 리포트가 생성되었을 가능성
   - What's unclear: 실제 DB에 중복이 있는지
   - Recommendation: unique constraint 추가 전 중복 확인 쿼리 실행. 중복이 있으면 최신 것만 남기고 삭제 후 constraint 추가

2. **Suspense boundary 기존 패턴**
   - What we know: login/page.tsx는 현재 LoginForm을 직접 렌더링 (Suspense 없음)
   - What's unclear: 프로젝트에서 Suspense 사용 패턴이 일관적인지
   - Recommendation: LoginForm만 Suspense 래핑. 다른 페이지에 영향 없음

## Sources

### Primary (HIGH confidence)

- 코드베이스 직접 분석 -- `flows.ts`, `analysis.ts`, `persist-analysis.ts`, `login-form.tsx`, `team.ts`
- v1.0-MILESTONE-AUDIT.md -- INT-01, INT-02, FLOW-01 갭 정의

### Secondary (MEDIUM confidence)

- Drizzle ORM onConflictDoUpdate API -- 기존 `persist-analysis.ts` line 14-26에서 이미 사용 중 (analysisResults)
- Next.js useSearchParams -- App Router 표준 패턴

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - 새 라이브러리 없음, 기존 패턴 재사용
- Architecture: HIGH - 모든 수정 위치와 코드 변경이 명확히 식별됨
- Pitfalls: HIGH - 각 갭의 root cause가 코드에서 직접 확인됨

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (안정적 -- 기존 코드 버그 수정)
