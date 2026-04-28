# Manipulation Detection 구독 토글 설계

> **Phase 2 후속.** Phase 2 (`runAnalysisPipeline` Stage 5)는 `jobOptions.runManipulation === true`일 때만 실행되며 현재 항상 SKIP. 이 스펙은 구독별 사용자 토글로 Stage 5를 제어한다.

**날짜**: 2026-04-28
**관련 커밋**: `957d31f` (Phase 2 baseline 윈도우 fix), `515a16d` (Stage 5 통합)
**전제 (운영 검증 완료)**: jobId=273, subscriptionId=37로 `--useReal` dryrun 통과 — manipulation_score 57.21, 7 signals, 29 evidence

## 목표

구독자가 분석 잡 트리거 시 manipulation 분석을 잡별로 켜고 끌 수 있게 한다. 신규 구독은 default OFF, 기존 구독은 자동 OFF (마이그레이션 없음).

## 비목표 (YAGNI)

- 구독별 도메인 override (Phase 2 `manipulationDomainOverride`는 jobOptions 전용으로 유지)
- 토글이 없는 도메인의 disabled 처리 (UI 폴백 안내 안 함, 코드 측 political 폴백에 위임)
- 토글 변경 이력 추적 (audit log)

## 데이터 모델

### `apps/collector/src/db/schema/subscriptions.ts`

```typescript
export type SubscriptionOptions = {
  collectTranscript?: boolean;
  includeComments?: boolean;
  enableManipulation?: boolean;  // 추가
};
```

- 저장 위치: `keyword_subscriptions.options` JSONB의 새 필드
- 마이그레이션: 없음 (JSONB 동적 키)
- 기본값: `undefined` ≡ OFF (코드에서 `=== true` 게이트)
- 인덱스: 없음 (트리거 1회 읽기, 검색/필터 대상 아님)

### `apps/web/src/server/trpc/routers/subscriptions.ts`

```typescript
export interface SubscriptionRecord {
  // ...
  options?: {
    collectTranscript?: boolean;
    includeComments?: boolean;
    enableManipulation?: boolean;  // 추가
  } | null;
  // ...
}
```

### `apps/collector/src/server/trpc/subscriptions.ts` (zod 스키마)

```typescript
const optionsSchema = z.object({
  collectTranscript: z.boolean().optional(),
  includeComments: z.boolean().optional(),
  enableManipulation: z.boolean().optional(),  // 추가
}).optional();
```

`createInput`과 `updateInput`은 `optionsSchema` 재사용 — 변경 불필요.

## 데이터 흐름

```
[UI: SubscriptionForm enableManipulation Checkbox]
    ↓
[trpcClient.subscriptions.create/update]  options.enableManipulation
    ↓
[collector subscriptionsRouter]  JSONB 저장
    ↓
keyword_subscriptions.options.enableManipulation
    ↓
─── (이후 분석 트리거 시점) ──────────────────────
    ↓
[analysis.triggerSubscription mutation]
    ↓ getCollectorClient().subscriptions.get → sub.options 포함
[buildSubscriptionAnalysisMeta(sub, args)]
    ↓ sub.options.enableManipulation === true 일 때만
    ↓ meta.options.runManipulation = true 설정
[collection_jobs.options]
    ↓
[runAnalysisPipeline → Stage 5 게이트]
    ↓ jobOptions.runManipulation === true
[runStage5Manipulation 실행]
```

### 핵심 변경 — `buildSubscriptionAnalysisMeta`

**파일**: `apps/web/src/server/trpc/routers/subscription-analysis-meta.ts`

**시그니처 확장:**

```typescript
export function buildSubscriptionAnalysisMeta(
  sub: {
    keyword: string;
    sources?: string[] | null;
    limits?: Record<string, number> | null;
    options?: { enableManipulation?: boolean } | null;  // 추가
  },
  args: { ... },
): SubscriptionJobMeta { ... }
```

**반환 타입 확장:**

```typescript
export type SubscriptionJobMeta = {
  appliedPreset: { ... };
  limits: { ... };
  options: {
    subscriptionId: number;
    skipItemAnalysis: boolean;
    useCollectorLoader: boolean;
    tokenOptimization: TokenOptimization;
    sources: string[];
    runManipulation?: boolean;  // 추가 (선택적)
  };
};
```

**합성 로직:**

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

토글이 명시적 `true`가 아니면 `runManipulation` 키 자체를 추가하지 않는다 → Stage 5 게이트가 무음 SKIP.

### `triggerSubscription` mutation 호출부

**파일**: `apps/web/src/server/trpc/routers/analysis.ts:351`

`getCollectorClient().subscriptions.get`가 반환하는 `sub` 객체를 `buildSubscriptionAnalysisMeta`에 그대로 전달. `sub.options`는 collector 측 `keyword_subscriptions.options`를 그대로 통과 — 추가 매핑 불필요.

```typescript
const meta = buildSubscriptionAnalysisMeta(
  {
    keyword: sub.keyword,
    sources: sub.sources,
    limits: sub.limits as Record<string, number> | null,
    options: sub.options,  // 추가
  },
  { subscriptionId: input.subscriptionId, optimizationPreset: input.optimizationPreset },
);
```

## UI 변경

**파일**: `apps/web/src/components/subscriptions/subscription-form.tsx`

### State 추가 (line 81 근처, 기존 `collectTranscript` 옆)

```typescript
const [enableManipulation, setEnableManipulation] = useState(
  initial?.options?.enableManipulation ?? false,
);
```

### Checkbox 카드 추가 (`collectTranscript` 카드 다음, line 333 직전)

`collectTranscript`와 동일한 카드 패턴. youtube 의존성 없음 — 모든 소스 조합에서 의미 있음.

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
      분석 실행 시 댓글·기사의 7개 조작 신호(트래픽 폭주, 유사도 클러스터, 매체 동조 등)를 추가로
      검출합니다. 분석 시간이 약 30~60초 늘어납니다.
    </p>
  </div>
</label>
```

### 페이로드 변경 (line 174-180)

기존 `collectTranscript ? {...:true} : {...:false}` 분기를 청소하고 항상 두 키를 보내도록 단순화한다.

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

### Mutation 타입 (line 92-131)

`createMut`/`updateMut`의 `mutationFn` 입력 타입 `options?` 시그니처에 `enableManipulation?: boolean`을 추가.

## 에러 처리

신규 에러 처리 코드 없음. Phase 2가 이미 다음 안전망을 갖추고 있다:

| 시나리오 | 처리 |
|----------|------|
| `runManipulation !== true` | `stage5.ts` 무음 SKIP (appendJobEvent 호출조차 안 함) |
| Stage 5 도중 예외 | `stage5.ts` inner try/catch → `appendJobEvent('warn', ...)` |
| Stage 5 진입 자체에서 예외 (DB 등) | `pipeline-orchestrator.ts` outer try/catch → `logError` |
| 도메인 시드 없음 | `resolveDomainConfig`가 political 폴백 |
| 취소된 잡 | Stage 5 진입 전 `cancelledByUser` / `costLimitExceeded` 가드 |

## 테스트

### 추가 단위 테스트

**파일**: `apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts`

```typescript
it('enableManipulation:true → meta.options.runManipulation:true', () => {
  const result = buildSubscriptionAnalysisMeta(
    { keyword: 'k', sources: ['naver-news'], limits: null, options: { enableManipulation: true } },
    { subscriptionId: 1 },
  );
  expect(result.options.runManipulation).toBe(true);
});

it('enableManipulation:false → meta.options에 runManipulation 키 부재', () => {
  const result = buildSubscriptionAnalysisMeta(
    { keyword: 'k', sources: ['naver-news'], limits: null, options: { enableManipulation: false } },
    { subscriptionId: 1 },
  );
  expect(result.options).not.toHaveProperty('runManipulation');
});

it('options 부재 → meta.options에 runManipulation 키 부재', () => {
  const result = buildSubscriptionAnalysisMeta(
    { keyword: 'k', sources: ['naver-news'], limits: null },
    { subscriptionId: 1 },
  );
  expect(result.options).not.toHaveProperty('runManipulation');
});
```

### Zod 스키마 통과 검증

추가 테스트 불필요. `optionsSchema.parse({ enableManipulation: true })` 가 통과함은 zod 자체가 보장.

### 회귀 테스트

기존 `buildSubscriptionAnalysisMeta` 테스트 4건 모두 통과해야 한다 (`enableManipulation` 부재 시 동작 유지).

### E2E 수동 검증

1. 구독 생성 (토글 ON) → `keyword_subscriptions.options` JSONB에 `enableManipulation:true` 저장
2. 해당 구독으로 분석 트리거 → `collection_jobs.options.runManipulation === true` 확인
3. 분석 완료 후 `manipulation_runs` 1건 INSERT 확인 (signal_count=7, evidence_count>0)
4. 동일 구독을 토글 OFF로 수정 후 재분석 → `manipulation_runs` INSERT 안 됨 확인

## 마이그레이션 / 호환성

- 기존 `keyword_subscriptions` 행: `options.enableManipulation`이 없음 → 자동 OFF (코드 게이트가 `=== true` 검사)
- 기존 `collection_jobs` 행: 영향 없음 (Stage 5는 신규 트리거에만 적용)
- 기존 단위 테스트 4건: `options` 인자가 선택이므로 호출 형태 변경 불필요

## 파일 영향 요약

| 파일 | 변경 종류 | 변경 라인 (추정) |
|------|-----------|------------------|
| `apps/collector/src/db/schema/subscriptions.ts` | type 1줄 | +1 |
| `apps/collector/src/server/trpc/subscriptions.ts` | zod 1줄 | +1 |
| `apps/web/src/server/trpc/routers/subscriptions.ts` | interface 1줄 | +1 |
| `apps/web/src/server/trpc/routers/subscription-analysis-meta.ts` | 시그니처 + 합성 로직 | ~5 |
| `apps/web/src/server/trpc/routers/analysis.ts` | meta 호출에 options 전달 | +1 |
| `apps/web/src/components/subscriptions/subscription-form.tsx` | state + UI + payload | ~25 |
| `apps/web/src/server/trpc/routers/__tests__/analysis-trigger-subscription.test.ts` | 테스트 3건 | ~30 |

**총 변경 규모**: 약 60~70줄, 7개 파일.

## 위험 요소

| 위험 | 완화 |
|------|------|
| `sub.options`가 null인 신규 코드 경로에서 NPE | `sub.options?.enableManipulation === true` 체크로 옵셔널 처리 |
| collector tRPC `subscriptions.get` 응답에 `options`가 누락된 옛 캐시 | tRPC 클라이언트 캐싱 안 함 (mutation 직후 fresh fetch) — 무관 |
| 사용자가 토글을 알아채지 못함 | 카드 설명문에 비용 명시 ("30~60초 늘어남") — 의도적 무리한 강조는 안 함 |
| 토글 ON이지만 도메인이 manipulation_domain_configs에 없음 | Phase 2 `resolveDomainConfig`가 political 폴백 — 사용자 결정 |

## 향후 확장 (이 스펙 범위 외)

- 구독 상세 페이지에서 manipulation 결과 시계열 차트 (Phase 3)
- 도메인별 토글 default 정책 (정치 도메인은 ON 기본 등)
- audit log
