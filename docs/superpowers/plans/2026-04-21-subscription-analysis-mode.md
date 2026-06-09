# 구독 기반 분석 실행 모드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "구독에서 선택" 시 구독 모드로 전환하여 기간만 편집 가능하게 만들고, 소스/한도/옵션은 구독 설정을 읽기전용으로 적용한다.

**Architecture:** 기존 `TriggerForm`에 `subscriptionMode` 상태 플래그를 추가하고, `SubscriptionPicker`에서 구독 객체 전체를 반환하도록 콜백 시그니처를 변경한다. 백엔드 `trigger` 뮤테이션에 `subscriptionId`를 추가하여 구독 모드일 때 `forceRefetch`를 강제로 `false`로 만든다.

**Tech Stack:** React 19 · TypeScript · tRPC 11 · Zod

---

### Task 1: SubscriptionPicker 콜백 시그니처 변경

**Files:**

- Modify: `apps/web/src/components/analysis/subscription-picker.tsx`

- [ ] **Step 1: SubscriptionRow에 limits, options 필드 추가하고 onSelect 콜백 시그니처 변경**

현재 `SubscriptionRow`는 `id, keyword, sources, intervalHours`만 있다. `SubscriptionRecord`에 있는 `limits`, `options`, `domain`을 추가하고, `onSelect`가 객체 전체를 반환하도록 변경한다.

```typescript
// subscription-picker.tsx 전체를 다음으로 교체

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

export interface SubscriptionSummary {
  id: number;
  keyword: string;
  sources: string[];
  limits: { maxPerRun: number; maxPerDay?: number; commentsPerItem?: number };
  options: { collectTranscript?: boolean; includeComments?: boolean };
  domain?: string | null;
}

interface SubscriptionPickerProps {
  onSelect: (subscription: SubscriptionSummary) => void;
  disabled?: boolean;
}

export function SubscriptionPicker({ onSelect, disabled }: SubscriptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriptions.list', 'active'],
    queryFn: () => trpcClient.subscriptions.list.query({ status: 'active' }),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (error) setHasError(true);
  }, [error]);

  const subs: SubscriptionRecord[] = data ?? [];
  const hasSubs = subs.length > 0;
  const available = !hasError && !isLoading && hasSubs;

  const buttonClass = [
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors',
    available ? 'hover:bg-accent hover:text-accent-foreground' : 'cursor-not-allowed opacity-50',
  ].join(' ');

  const title = hasError
    ? '구독 서비스에 연결할 수 없습니다'
    : isLoading
      ? '구독 목록 로딩 중'
      : hasSubs
        ? '수집 중인 키워드에서 선택'
        : '활성 구독이 없습니다';

  const handleSelect = (sub: SubscriptionRecord) => {
    onSelect({
      id: sub.id,
      keyword: sub.keyword,
      sources: sub.sources,
      limits: sub.limits,
      options: {
        collectTranscript: sub.options?.collectTranscript ?? false,
        includeComments: sub.options?.includeComments ?? true,
      },
      domain: sub.domain,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled || !available}
        className={buttonClass}
        title={title}
      >
        <Database className="h-3.5 w-3.5" />
        구독에서 선택
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-xs text-muted-foreground">
          활성 구독 {subs.length}개
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {subs.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSelect(sub)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="truncate font-medium">{sub.keyword}</span>
              <span className="truncate text-xs text-muted-foreground">
                {sub.sources.join(', ')} · {sub.intervalHours}h
              </span>
            </button>
          ))}
          {!hasSubs && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              활성 구독이 없습니다.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | head -30`
Expected: `SubscriptionPicker`의 `onSelect` 타입이 변경되었으므로 `trigger-form.tsx`에서 타입 에러가 발생할 것. 다음 Task에서 수정.

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/analysis/subscription-picker.tsx
git commit -m "refactor: SubscriptionPicker onSelect 콜백에 구독 전체 객체 반환"
```

---

### Task 2: TriggerForm에 subscriptionMode 상태 및 구독 선택 핸들러 추가

**Files:**

- Modify: `apps/web/src/components/analysis/trigger-form.tsx`

- [ ] **Step 1: import 및 상태 추가**

`trigger-form.tsx` 상단에 `SubscriptionSummary` import를 추가하고, `SubscriptionPicker` import 경로를 업데이트한다.

```typescript
// 기존 import 목록에 추가
import { SubscriptionPicker, type SubscriptionSummary } from './subscription-picker';
```

컴포넌트 내부, `const [collectTranscript, setCollectTranscript] = useState(false);` 이후에 상태 추가:

```typescript
const [subscriptionMode, setSubscriptionMode] = useState<{
  isActive: boolean;
  subscription: SubscriptionSummary | null;
}>({ isActive: false, subscription: null });
```

- [ ] **Step 2: 구독 선택 핸들러 추가**

`handleCustomSourceToggle` 함수 이후에 추가:

```typescript
const handleSubscriptionSelect = (sub: SubscriptionSummary) => {
  setSubscriptionMode({ isActive: true, subscription: sub });
  setKeyword(sub.keyword);
  setSources(sub.sources as SourceId[]);
  setForceRefetch(false);
  setEnableItemAnalysis(sub.options.includeComments !== false);
  setCollectTranscript(sub.options.collectTranscript);
  // 수집 한도 기본값은 구독 설정 사용
  if (sub.limits.maxPerRun) {
    setMaxNaverArticles(Math.min(sub.limits.maxPerRun, 5000));
    setMaxYoutubeVideos(Math.min(Math.round(sub.limits.maxPerRun / 10), 500));
    setMaxCommunityPosts(Math.min(Math.round(sub.limits.maxPerRun / 10), 500));
  }
  if (sub.limits.commentsPerItem) {
    setMaxCommentsPerItem(Math.min(sub.limits.commentsPerItem, 2000));
  }
};

const handleSubscriptionClear = () => {
  setSubscriptionMode({ isActive: false, subscription: null });
  setKeyword('');
  setSources([...ALL_SOURCES]);
  setForceRefetch(false);
  setEnableItemAnalysis(true);
  setCollectTranscript(false);
  // 수집 한도는 서버 기본값으로 리셋
  if (defaultLimits) {
    setMaxNaverArticles(defaultLimits.naverArticles);
    setMaxYoutubeVideos(defaultLimits.youtubeVideos);
    setMaxCommunityPosts(defaultLimits.communityPosts);
    setMaxCommentsPerItem(defaultLimits.commentsPerItem);
  }
};
```

- [ ] **Step 3: SubscriptionPicker에 새 핸들러 연결**

`trigger-form.tsx`에서 기존 `SubscriptionPicker` 사용 부분을 변경:

```typescript
// 기존:
<SubscriptionPicker onSelect={setKeyword} disabled={triggerMutation.isPending} />
// 변경:
<SubscriptionPicker onSelect={handleSubscriptionSelect} disabled={triggerMutation.isPending} />
```

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx
git commit -m "feat: TriggerForm에 subscriptionMode 상태 및 구독 선택 핸들러 추가"
```

---

### Task 3: 구독 모드 UI 조건부 렌더링 적용

**Files:**

- Modify: `apps/web/src/components/analysis/trigger-form.tsx`

- [ ] **Step 1: 읽기전용 변수 추가**

컴포넌트 내부 `return`문 앞에 추가:

```typescript
const isSubMode = subscriptionMode.isActive;
```

- [ ] **Step 2: 키워드 필드에 구독 배지 및 X 버튼 추가**

기존 키워드 입력 섹션을 교체:

```tsx
{
  /* 키워드 입력 */
}
<div className="space-y-2">
  <Label htmlFor="keyword">키워드</Label>
  <div className="flex gap-2">
    <div className="flex flex-1 gap-2">
      <Input
        id="keyword"
        placeholder="인물 또는 키워드 입력"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        required
        maxLength={50}
        disabled={triggerMutation.isPending || isSubMode}
        className="flex-1"
      />
      {isSubMode && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 text-xs gap-1"
          onClick={handleSubscriptionClear}
          title="구독 모드 해제"
        >
          <span className="max-w-[120px] truncate">{subscriptionMode.subscription?.keyword}</span>✕
        </Button>
      )}
    </div>
    {!isSubMode && (
      <SubscriptionPicker
        onSelect={handleSubscriptionSelect}
        disabled={triggerMutation.isPending}
      />
    )}
  </div>
</div>;
```

- [ ] **Step 3: 소스 선택에 disabled 조건 추가**

소스 선택 섹션의 모든 `Checkbox`에 `disabled`에 `isSubMode` 추가:

```tsx
// "전체 선택" Checkbox — disabled 조건 변경:
disabled={triggerMutation.isPending || isSubMode}

// 개별 소스 Checkbox — disabled 조건 변경:
disabled={triggerMutation.isPending || isSubMode}

// 사용자 정의 소스 Checkbox — disabled 조건 변경:
disabled={triggerMutation.isPending || isSubMode}
```

구독 모드 배지를 소스 섹션 상단에 추가:

```tsx
{
  /* 소스 선택 */
}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Label>소스</Label>
    {isSubMode && (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
        구독 설정
      </span>
    )}
  </div>
  {/* ... 기존 소스 체크박스들 ... */}
</div>;
```

- [ ] **Step 4: 분석 옵션에 disabled 조건 추가**

분석 옵션 섹션의 Checkbox disabled에 `isSubMode` 추가:

```tsx
// "개별 기사/댓글 감정 분석" Checkbox:
disabled={isDemo || triggerMutation.isPending || isSubMode}

// "유튜브 자막 수집" Checkbox:
disabled={isDemo || triggerMutation.isPending || isSubMode}
```

분석 옵션 섹션에 구독 모드 배지 추가:

```tsx
{
  /* 분석 옵션 */
}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Label>분석 옵션</Label>
    {isSubMode && (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
        구독 설정
      </span>
    )}
  </div>
  {/* ... 기존 옵션 체크박스들 ... */}
</div>;
```

- [ ] **Step 5: 전량 재수집 조건부 숨김**

기존 `{!isDemo && (` 조건을 `{!isDemo && !isSubMode && (`로 변경:

```tsx
{
  /* 전량 재수집 옵션 — 데모 및 구독 모드에서는 표시하지 않음 */
}
{
  !isDemo && !isSubMode && (
    <label className="flex items-start gap-2 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-accent/50">
      {/* ... 기존 내용 ... */}
    </label>
  );
}
```

- [ ] **Step 6: 빌드 확인**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | head -30`
Expected: 타입 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx
git commit -m "feat: 구독 모드 UI 조건부 렌더링 (키워드/소스/옵션 읽기전용, 전량재수집 숨김)"
```

---

### Task 4: 백엔드 trigger 뮤테이션에 subscriptionId 추가

**Files:**

- Modify: `apps/web/src/server/trpc/routers/analysis.ts`

- [ ] **Step 1: input 스키마에 subscriptionId 추가**

`trigger` 프로시저의 `z.object({...})`에 `subscriptionId` 필드 추가:

```typescript
// 기존 forceRefetch 라인 아래에 추가:
subscriptionId: z.number().optional(),
```

- [ ] **Step 2: mutation 내부에서 subscriptionId가 있으면 forceRefetch 강제 false**

`triggerCollection` 호출 바로 앞에 추가:

```typescript
// 구독 모드: forceRefetch 강제 false
const effectiveForceRefetch = input.subscriptionId ? false : (input.forceRefetch ?? false);
```

그리고 `triggerCollection` 호출부에서 `forceRefetch: input.forceRefetch`를 `forceRefetch: effectiveForceRefetch`로 변경:

```typescript
await triggerCollection(
  {
    keyword: input.keyword,
    startDate: new Date(input.startDate).toISOString(),
    endDate: new Date(input.endDate).toISOString(),
    sources: input.sources,
    customSourceIds: input.customSourceIds,
    limits: effectiveLimits ?? undefined,
    limitMode,
    forceRefetch: effectiveForceRefetch,
    collectTranscript: input.options?.collectTranscript,
  },
  job.id,
);
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | head -30`
Expected: 타입 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/server/trpc/routers/analysis.ts
git commit -m "feat: trigger 뮤테이션에 subscriptionId 추가, 구독 모드 시 forceRefetch 강제 false"
```

---

### Task 5: TriggerForm doTrigger에 subscriptionId 전달

**Files:**

- Modify: `apps/web/src/components/analysis/trigger-form.tsx`

- [ ] **Step 1: triggerMutation.mutate 호출에 subscriptionId 추가**

`doTrigger` 함수 내 `triggerMutation.mutate({...})` 호출에 subscriptionId 필드 추가:

```typescript
triggerMutation.mutate({
  keyword: keyword.trim(),
  ...(preset?.slug && { keywordType: preset.slug }),
  ...(preset?.domain && { domain: preset.domain as any }),
  sources,
  customSourceIds: customSourceIds.length > 0 ? customSourceIds : undefined,
  startDate: resolvedStart.toISOString(),
  endDate: resolvedEnd.toISOString(),
  options:
    enableItemAnalysis || optimizationPreset !== 'none' || collectTranscript
      ? {
          ...(enableItemAnalysis && { enableItemAnalysis: true }),
          ...(optimizationPreset !== 'none' && { tokenOptimization: optimizationPreset }),
          ...(collectTranscript && { collectTranscript: true }),
        }
      : undefined,
  limits: {
    naverArticles: maxNaverArticles,
    youtubeVideos: maxYoutubeVideos,
    communityPosts: maxCommunityPosts,
    commentsPerItem: maxCommentsPerItem,
  },
  limitMode: dateMode === 'period' ? 'perDay' : 'total',
  breakpoints: breakpoints.length > 0 ? breakpoints : undefined,
  ...(selectedSeriesId && { seriesId: selectedSeriesId }),
  ...(createNewSeries && { createNewSeries: true }),
  ...(!isSubMode && forceRefetch && { forceRefetch: true }),
  ...(isSubMode &&
    subscriptionMode.subscription && { subscriptionId: subscriptionMode.subscription.id }),
});
```

- [ ] **Step 2: triggerMutation input 타입에 subscriptionId 추가**

`triggerMutation`의 `mutationFn` input 타입에 `subscriptionId?: number` 필드 추가:

```typescript
const triggerMutation = useMutation({
  mutationFn: (input: {
    keyword: string;
    keywordType?: string;
    domain?: string;
    sources: SourceId[];
    customSourceIds?: string[];
    startDate: string;
    endDate: string;
    options?: { enableItemAnalysis?: boolean; tokenOptimization?: OptimizationPreset };
    limits?: {
      naverArticles: number;
      youtubeVideos: number;
      communityPosts: number;
      commentsPerItem: number;
    };
    limitMode?: 'perDay' | 'total';
    breakpoints?: BreakpointValue[];
    forceRefetch?: boolean;
    subscriptionId?: number; // 추가
  }) => trpcClient.analysis.trigger.mutate(input as any),
  // ... onSuccess, onError 동일
});
```

- [ ] **Step 3: 빌드 및 린트 확인**

Run: `pnpm --filter web exec tsc --noEmit 2>&1 | head -30`
Expected: 타입 에러 없음

Run: `pnpm lint 2>&1 | tail -5`
Expected: lint 통과

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx
git commit -m "feat: 구독 모드 실행 시 subscriptionId 전달 및 forceRefetch 제어"
```

---

### Task 6: 최종 빌드 및 수동 테스트

**Files:**

- 없음 (검증만)

- [ ] **Step 1: 전체 빌드 확인**

Run: `pnpm build 2>&1 | tail -20`
Expected: 빌드 성공

- [ ] **Step 2: dev 서버 실행 후 수동 테스트**

Run: `pnpm dev`

테스트 체크리스트:

1. "구독에서 선택" 버튼 → 활성 구독 목록 표시
2. 구독 선택 → 키워드가 읽기전용, 구독 키워드 배지 + X 버튼 표시
3. 소스가 비활성화되고 구독 소스만 체크됨
4. 분석 옵션이 비활성화되고 구독 설정 반영됨
5. 전량 재수집 체크박스 숨김
6. 수집 한도 & 토큰 최적화 편집 가능, 기본값은 구독 설정
7. 기간 편집 가능
8. X 버튼 → 일반 모드 복귀, 폼 초기화
9. 분석 실행 → 정상 동작

- [ ] **Step 3: 최종 커밋**

```bash
git add -A
git commit -m "feat: 구독 기반 분석 실행 모드 완성"
```
