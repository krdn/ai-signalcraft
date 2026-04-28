# Manipulation Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구독 단위 manipulation 분석 토글 추가 — 구독자가 분석 잡 트리거 시 Phase 2 Stage 5를 잡별로 켜고 끌 수 있게 한다.

**Architecture:** `keyword_subscriptions.options` JSONB에 `enableManipulation` 필드 추가 (마이그레이션 없음, default OFF). collector zod 스키마 확장 → web `SubscriptionRecord` 인터페이스 동기화 → `buildSubscriptionAnalysisMeta`가 `sub.options.enableManipulation === true`일 때만 `meta.options.runManipulation = true` 설정 → Phase 2 Stage 5 게이트 작동.

**Tech Stack:** TypeScript 5, Drizzle ORM, zod 3, tRPC 11, React 19, shadcn/ui, vitest 3, pnpm.

**Spec:** `docs/superpowers/specs/2026-04-28-manipulation-toggle-design.md`

**Worktree:** `.claude/worktrees/worktree-manipulation-toggle` (브랜치: `worktree-manipulation-toggle`, base: `main`)

---

## File Inventory

| 파일 | 변경 유형 | 책임 |
|------|----------|------|
| `apps/collector/src/db/schema/subscriptions.ts` | Modify | `SubscriptionOptions` 타입에 `enableManipulation?: boolean` 추가 |
| `apps/collector/src/server/trpc/subscriptions.ts` | Modify | `optionsSchema`에 zod 필드 추가 (silent strip 방지) |
| `apps/web/src/server/trpc/routers/subscriptions.ts` | Modify | `SubscriptionRecord.options` 인터페이스 1줄 추가 |
| `apps/web/src/server/trpc/routers/subscription-analysis-meta.ts` | Modify | 함수 시그니처 + 반환 타입 + `runManipulation` 합성 로직 |
| `apps/web/src/server/trpc/routers/analysis.ts` | Modify | `buildSubscriptionAnalysisMeta` 호출에 `options: sub.options` 전달 |
| `apps/web/src/components/subscriptions/subscription-form.tsx` | Modify | `enableManipulation` state + Checkbox 카드 UI + payload |
| `apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts` | Modify | `enableManipulation` 케이스 3건 추가 |

---

## Task 1: Collector zod 스키마에 enableManipulation 필드 추가

**Why first:** 백엔드 입력 검증 게이트가 통과해야 그 위 레이어가 의미를 갖는다. zod 기본 모드가 정의되지 않은 키를 silent strip하므로, 이 작업 전에는 UI에서 보낸 `enableManipulation`이 collector에 도달하지 못한다.

**Files:**
- Modify: `apps/collector/src/db/schema/subscriptions.ts:18-21`
- Modify: `apps/collector/src/server/trpc/subscriptions.ts:21-26`
- Test: 기존 collector 테스트 회귀로 충분 (단위 테스트 추가 안 함 — zod parse는 zod 자체가 보장)

- [ ] **Step 1: `SubscriptionOptions` 타입에 필드 추가**

`apps/collector/src/db/schema/subscriptions.ts`의 18-21줄을 다음으로 교체:

```typescript
export type SubscriptionOptions = {
  collectTranscript?: boolean;
  includeComments?: boolean;
  enableManipulation?: boolean;
};
```

- [ ] **Step 2: zod `optionsSchema` 확장**

`apps/collector/src/server/trpc/subscriptions.ts`의 21-26줄을 다음으로 교체:

```typescript
const optionsSchema = z
  .object({
    collectTranscript: z.boolean().optional(),
    includeComments: z.boolean().optional(),
    enableManipulation: z.boolean().optional(),
  })
  .optional();
```

- [ ] **Step 3: collector tsc + 테스트 실행**

```bash
cd ~/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-toggle
pnpm --filter @ai-signalcraft/collector exec tsc --noEmit
pnpm --filter @ai-signalcraft/collector test 2>&1 | tail -5
```

Expected:
- tsc: `No errors found`
- 기존 84 PASS 유지 (33 SASL DB 실패는 pre-existing — 새 실패만 없으면 OK)

- [ ] **Step 4: Commit**

```bash
git add apps/collector/src/db/schema/subscriptions.ts apps/collector/src/server/trpc/subscriptions.ts
git commit -m "feat(collector): SubscriptionOptions에 enableManipulation 필드 추가

zod silent strip 방지 — 정의되지 않은 키는 자동 제거되므로
타입과 스키마 양쪽에 모두 추가해야 UI 페이로드가 보존된다.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Web SubscriptionRecord 인터페이스 동기화

**Why:** Web 측이 collector 응답을 자체 타입으로 재정의해 트랜지티브 추론 누출을 막고 있다(`SubscriptionRecord`). 토글 필드도 이 경계에서 명시해야 UI가 `initial?.options?.enableManipulation`을 안전하게 읽을 수 있다.

**Files:**
- Modify: `apps/web/src/server/trpc/routers/subscriptions.ts:14-24`
- Test: 타입 체크만으로 검증 (vitest 회귀)

- [ ] **Step 1: `SubscriptionRecord.options` 인터페이스에 필드 추가**

`apps/web/src/server/trpc/routers/subscriptions.ts`의 16번째 줄을 다음으로 교체:

```typescript
  options?: {
    collectTranscript?: boolean;
    includeComments?: boolean;
    enableManipulation?: boolean;
  } | null;
```

- [ ] **Step 2: 전체 tsc 확인**

```bash
cd ~/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-toggle
pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/trpc/routers/subscriptions.ts
git commit -m "feat(web): SubscriptionRecord에 enableManipulation 필드 동기화

collector 응답 타입을 web 경계에서 재정의하는 패턴 유지.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: buildSubscriptionAnalysisMeta 합성 로직 — 실패 테스트

**TDD 첫 단계.** `enableManipulation: true` → `runManipulation: true`, `false`/부재 → 키 자체 부재. 3개 테스트.

**Files:**
- Modify: `apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts`

- [ ] **Step 1: 테스트 3건 추가**

`apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts`의 마지막 `});` 직전 (describe 블록 닫기 전)에 다음을 추가:

```typescript
  it('options.enableManipulation:true → meta.options.runManipulation:true', () => {
    const result = buildSubscriptionAnalysisMeta(
      {
        keyword: 'test',
        sources: ['naver-news'],
        limits: { maxPerRun: 100 },
        options: { enableManipulation: true },
      },
      { subscriptionId: 1 },
    );

    expect(result.options.runManipulation).toBe(true);
  });

  it('options.enableManipulation:false → meta.options에 runManipulation 키 부재', () => {
    const result = buildSubscriptionAnalysisMeta(
      {
        keyword: 'test',
        sources: ['naver-news'],
        limits: { maxPerRun: 100 },
        options: { enableManipulation: false },
      },
      { subscriptionId: 1 },
    );

    expect(result.options).not.toHaveProperty('runManipulation');
  });

  it('options 부재 → meta.options에 runManipulation 키 부재 (회귀 보호)', () => {
    const result = buildSubscriptionAnalysisMeta(
      {
        keyword: 'test',
        sources: ['naver-news'],
        limits: { maxPerRun: 100 },
      },
      { subscriptionId: 1 },
    );

    expect(result.options).not.toHaveProperty('runManipulation');
  });
```

- [ ] **Step 2: 테스트 실행 — 3건 모두 실패해야 함**

```bash
cd ~/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-toggle
pnpm --filter @ai-signalcraft/web test analysis-trigger-subscription 2>&1 | tail -20
```

Expected:
- 첫 번째 테스트: FAIL — `result.options.runManipulation`이 `undefined` 또는 `result.options.runManipulation` 키가 존재하지 않음 (TS 타입 에러 가능)
- 두 번째/세 번째: PASS (현재 코드는 `runManipulation` 키를 추가하지 않으므로 `not.toHaveProperty`는 통과)

만약 TS 타입 에러로 테스트가 컴파일되지 않으면 그것이 의도된 실패. Task 4에서 시그니처를 확장하면 컴파일 통과.

- [ ] **Step 3: 커밋 안 함** — TDD 원칙에 따라 실패 테스트는 구현과 함께 같은 커밋에 묶는다 (Task 4 Step 4에서 일괄 커밋).

---

## Task 4: buildSubscriptionAnalysisMeta 시그니처 + 합성 로직 구현

**Files:**
- Modify: `apps/web/src/server/trpc/routers/subscription-analysis-meta.ts`

- [ ] **Step 1: 입력 타입에 options 추가**

`apps/web/src/server/trpc/routers/subscription-analysis-meta.ts`의 함수 시그니처 (line 48-58)를 다음으로 교체:

```typescript
export function buildSubscriptionAnalysisMeta(
  sub: {
    keyword: string;
    sources?: string[] | null;
    limits?: Record<string, number> | null;
    options?: { enableManipulation?: boolean } | null;
  },
  args: {
    subscriptionId: number;
    optimizationPreset?: TokenOptimization;
  },
): SubscriptionJobMeta {
```

- [ ] **Step 2: 반환 타입에 runManipulation 추가**

같은 파일의 `SubscriptionJobMeta` 타입 (line 17-46) 중 `options` 블록 (line 39-45)을 다음으로 교체:

```typescript
  options: {
    subscriptionId: number;
    skipItemAnalysis: boolean;
    useCollectorLoader: boolean;
    tokenOptimization: TokenOptimization;
    sources: string[];
    runManipulation?: boolean;
  };
```

- [ ] **Step 3: return 합성에 조건부 spread 추가**

같은 파일의 return 블록 (line 84-94)을 다음으로 교체:

```typescript
  return {
    appliedPreset,
    limits,
    options: {
      subscriptionId: args.subscriptionId,
      skipItemAnalysis: true,
      useCollectorLoader: true,
      tokenOptimization,
      sources: subscriptionSources,
      ...(sub.options?.enableManipulation === true && { runManipulation: true }),
    },
  };
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd ~/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-toggle
pnpm --filter @ai-signalcraft/web test analysis-trigger-subscription 2>&1 | tail -15
```

Expected: 7 PASS (기존 4 + 신규 3 모두 통과)

- [ ] **Step 5: 전체 tsc**

```bash
pnpm tsc --noEmit 2>&1 | tail -3
```

Expected: `TypeScript: No errors found`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/trpc/routers/subscription-analysis-meta.ts \
        apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts
git commit -m "feat(web): buildSubscriptionAnalysisMeta가 enableManipulation을 runManipulation으로 합성

sub.options.enableManipulation === true 일 때만 meta.options.runManipulation:true 설정.
false/부재 시 키 자체를 추가하지 않아 Phase 2 Stage 5 게이트가 무음 SKIP.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: triggerSubscription mutation에서 sub.options 전달

**Files:**
- Modify: `apps/web/src/server/trpc/routers/analysis.ts:351-358`

- [ ] **Step 1: 호출부에 options 전달**

`apps/web/src/server/trpc/routers/analysis.ts`의 351-358줄을 다음으로 교체:

```typescript
      const meta = buildSubscriptionAnalysisMeta(
        {
          keyword: sub.keyword,
          sources: sub.sources,
          limits: sub.limits as Record<string, number> | null,
          options: sub.options,
        },
        { subscriptionId: input.subscriptionId, optimizationPreset: input.optimizationPreset },
      );
```

- [ ] **Step 2: 전체 tsc + 테스트**

```bash
cd ~/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-toggle
pnpm tsc --noEmit 2>&1 | tail -3
pnpm --filter @ai-signalcraft/web test analysis-trigger-subscription 2>&1 | tail -5
```

Expected:
- tsc: `No errors found`
- 7 PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/trpc/routers/analysis.ts
git commit -m "feat(web): triggerSubscription이 sub.options를 meta builder에 전달

collector subscriptions.get 응답의 options를 그대로 전달 — 추가 매핑 없음.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: SubscriptionForm UI — state + Checkbox 카드

**Files:**
- Modify: `apps/web/src/components/subscriptions/subscription-form.tsx`

- [ ] **Step 1: state 추가 (line 81 직후)**

`apps/web/src/components/subscriptions/subscription-form.tsx`의 81-83줄 (`const [collectTranscript, ...]` 다음)에 한 줄 추가:

기존:
```typescript
  const [collectTranscript, setCollectTranscript] = useState(
    initial?.options?.collectTranscript ?? false,
  );
```

추가 후:
```typescript
  const [collectTranscript, setCollectTranscript] = useState(
    initial?.options?.collectTranscript ?? false,
  );
  const [enableManipulation, setEnableManipulation] = useState(
    initial?.options?.enableManipulation ?? false,
  );
```

- [ ] **Step 2: createMut/updateMut input 타입에 enableManipulation 추가**

같은 파일의 92-106줄을 다음으로 교체:

```typescript
  const createMut = useMutation({
    mutationFn: (input: {
      keyword: string;
      sources: string[];
      intervalHours: number;
      limits: { maxPerRun: number; commentsPerItem: number };
      options?: { collectTranscript?: boolean; enableManipulation?: boolean };
    }) =>
      trpcClient.subscriptions.create.mutate({
        keyword: input.keyword,
        sources: input.sources as SourceId[],
        intervalHours: input.intervalHours,
        limits: input.limits,
        options: input.options,
      }),
    onSuccess: (row) => {
      toast.success('구독이 생성되었습니다');
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      if (row) notifySaved(row.id);
    },
    onError: (err) => {
      toast.error(`생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    },
  });
```

같은 파일의 117-131줄 `updateMut` 도 동일 패턴으로 교체:

```typescript
  const updateMut = useMutation({
    mutationFn: (input: {
      id: number;
      sources: string[];
      intervalHours: number;
      limits: { maxPerRun: number; commentsPerItem: number };
      options?: { collectTranscript?: boolean; enableManipulation?: boolean };
    }) =>
      trpcClient.subscriptions.update.mutate({
        id: input.id,
        sources: input.sources as SourceId[],
        intervalHours: input.intervalHours,
        limits: input.limits,
        options: input.options,
      }),
    onSuccess: (row) => {
      toast.success('구독이 수정되었습니다');
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      if (row) notifySaved(row.id);
    },
    onError: (err) => {
      toast.error(`수정 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    },
  });
```

- [ ] **Step 3: payload 단순화 + enableManipulation 추가**

같은 파일의 174-180줄을 다음으로 교체:

```typescript
    const payload = {
      keyword: keyword.trim(),
      sources,
      intervalHours,
      limits: { maxPerRun, commentsPerItem },
      options: {
        collectTranscript,
        enableManipulation,
      },
    };
```

- [ ] **Step 4: Checkbox 카드 추가**

같은 파일의 332줄(`)}`로 끝나는 `collectTranscript` 카드 닫기) 직후에 다음 블록 추가:

```tsx
      <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50">
        <Checkbox
          checked={enableManipulation}
          onCheckedChange={(checked) => setEnableManipulation(!!checked)}
          disabled={isPending}
          className="mt-0.5"
        />
        <div className="space-y-1">
          <span className="text-sm font-medium">여론 조작 신호 분석</span>
          <p className="text-xs text-muted-foreground">
            분석 실행 시 댓글·기사의 7개 조작 신호(트래픽 폭주, 유사도 클러스터, 매체 동조 등)를
            추가로 검출합니다. 분석 시간이 약 30~60초 늘어납니다.
          </p>
        </div>
      </label>
```

- [ ] **Step 5: 전체 tsc + lint**

```bash
cd ~/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-toggle
pnpm tsc --noEmit 2>&1 | tail -3
pnpm --filter @ai-signalcraft/web lint 2>&1 | tail -5
```

Expected:
- tsc: `No errors found`
- lint: 0 errors / 0 warnings (또는 기존 warning 수 유지)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/subscriptions/subscription-form.tsx
git commit -m "feat(web): 구독 폼에 manipulation 분석 토글 추가

기존 collectTranscript 카드 다음에 동일 패턴으로 배치.
default OFF, 모든 소스 조합에서 표시 (youtube 종속 없음).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 회귀 게이트 — 전체 테스트 + lint + tsc

**Why:** 전체 코드베이스 영향 없음을 최종 확인. 7개 파일 수정만으로 끝나는 변경이지만, web ↔ collector 타입 동기화가 들어 있으므로 타입 회귀 가능성을 막아야 한다.

- [ ] **Step 1: 전체 tsc**

```bash
cd ~/projects/ai/ai-signalcraft/.claude/worktrees/worktree-manipulation-toggle
pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: `TypeScript: No errors found`

- [ ] **Step 2: core 테스트 (Phase 2 회귀)**

```bash
pnpm --filter @ai-signalcraft/core test 2>&1 | tail -5
```

Expected: 452 PASS (Phase 2 main 기준 기대치 — 0 fail)

- [ ] **Step 3: web 테스트**

```bash
pnpm --filter @ai-signalcraft/web test 2>&1 | tail -5
```

Expected: 모든 테스트 PASS, 신규 3건 포함 (Task 4 Step 4에서 7 PASS 확인됨)

- [ ] **Step 4: lint**

```bash
pnpm lint 2>&1 | tail -5
```

Expected: 신규 lint 에러 0건 (기존 warning은 무관)

- [ ] **Step 5: 회귀 게이트 통과 확인 — 추가 커밋 없음**

이 task는 검증 단계로 새 코드 변경이 없다. 위 4단계가 모두 통과하면 완료.

만약 어느 단계든 실패한다면, 실패한 task로 돌아가서 root cause 수정 후 task 7 다시 실행.

---

## Self-Review Checklist (작성자 확인용)

**1. Spec coverage:**
- 데이터 모델 (`SubscriptionOptions`, zod, `SubscriptionRecord`) → Task 1, 2
- 데이터 흐름 (`buildSubscriptionAnalysisMeta`) → Task 3, 4
- `triggerSubscription` 호출부 → Task 5
- UI (state + 카드 + payload) → Task 6
- 테스트 (3건) → Task 3, 4
- 회귀 게이트 → Task 7
- 에러 처리 (Phase 2 안전망 활용, 신규 코드 없음) → spec에 명시, plan에서 별도 task 불필요

**2. Placeholder scan:** 없음. 모든 step이 실제 코드 또는 명령 포함.

**3. Type consistency:**
- `enableManipulation`: 모든 task에서 같은 키
- `runManipulation`: Task 4와 Phase 2 코드 (`stage5.ts`, `pipeline-orchestrator.ts`)에서 같은 키 — Phase 2 jobOptions 게이트와 정확히 일치
- `SubscriptionOptions` (collector) ↔ `SubscriptionRecord.options` (web): 동일 3 필드 (`collectTranscript`, `includeComments`, `enableManipulation`)
- `buildSubscriptionAnalysisMeta` 시그니처: Task 4 (입력 + 반환) ↔ Task 5 (호출부) 일치

---

## Estimated Effort

- Task 1-2: 5분 (1줄 변경 × 3 + tsc + commit)
- Task 3-4: 15분 (TDD 사이클 + tsc + commit)
- Task 5: 5분
- Task 6: 15분 (UI 코드 6곳 변경)
- Task 7: 5분 (검증만)

**총 ~45분.** 단일 세션 또는 단일 subagent 1회 dispatch로 완료 가능.
