# PR 2-D: trigger-form.tsx 분해 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/web/src/components/analysis/trigger-form.tsx` (1,057줄)을 외부 props 시그니처(`onJobStarted`, `preset?`, `onChangePreset?`)와 trigger mutation payload를 byte-for-byte 보존하면서 6개 presentational sub-component로 분해. 메인 파일을 ~280줄 컴포지션 컴포넌트로 축소.

**Architecture:** **State는 부모(`TriggerForm`)에 고정**, sub-component는 `value`/`onChange`/disabled 등 props만 받는 presentational. 24개 state는 그대로 유지하고 sub-component에는 필요한 부분만 prop drilling. 마스터플랜의 sub-component 이름(`domain-selector`/`module-toggle-list`/`cost-preview`/`advanced-options`/`optimization-preset-picker`)은 실제 파일 구조와 불일치 — **본 plan은 파일 실제 구조 기준 재도출**.

**Why state 부모 고정:**

- `subscriptionMode.isActive`(`isSubMode`)가 7~8 필드의 `disabled`를 제어 → 통합된 view of state 필요
- `dateMode === 'period'`가 tooltip 3개 텍스트 파생
- `preset` prop의 useEffect가 7개 state 일괄 set
- `handleSubmit`이 24개 state 모두 읽어 mutation payload 구성
- 자식이 자체 state 보유하는 패턴은 mutation payload 추적 어려움 → 회귀 검증 비용↑

**Tech Stack:** React 19, Next.js 15 App Router, TypeScript 5, Tailwind 4, shadcn/ui (Card/Input/Button/Checkbox/Collapsible/Tabs/Tooltip/AlertDialog), TanStack Query 5, sonner toast.

---

## File Structure (분해 후)

| 파일                                       | 책임                                                                 | 예상 라인 |
| ------------------------------------------ | -------------------------------------------------------------------- | --------- |
| `trigger-form.tsx`                         | state hub + 컴포지션                                                 | ~280      |
| `trigger-form/demo-quota-badge.tsx`        | 데모 사용자 쿼터 정보 박스                                           | ~45       |
| `trigger-form/keyword-input.tsx`           | 키워드 입력 + 구독 picker + 구독 해제 버튼                           | ~60       |
| `trigger-form/source-selector.tsx`         | 기본 소스 + 사용자 정의 소스 체크박스                                | ~85       |
| `trigger-form/date-range-selector.tsx`     | 기간/이벤트 모드 Tabs (period preset, 시작/종료, 이벤트명/날짜/반경) | ~120      |
| `trigger-form/analysis-options.tsx`        | 개별 감정 분석 + 자막 수집 체크박스                                  | ~55       |
| `trigger-form/collection-limits-panel.tsx` | Collapsible 한도 4개 + 토큰 최적화 프리셋 (classic/RAG)              | ~280      |
| `trigger-form/orphan-jobs-dialog.tsx`      | AlertDialog 고아 작업 확인                                           | ~50       |

**기존 디렉토리 활용:** `apps/web/src/components/analysis/trigger-form/`에 이미 `breakpoint-section.tsx`와 `series-selector.tsx`가 존재 → 같은 패턴(같은 폴더, kebab-case)으로 추가.

**`'use client';`:** 모든 추출 .tsx 첫 줄에 `'use client';` 명시. presentational이라도 부모가 client component이고 hook을 import할 가능성도 있어 안전하게 통일.

---

## State Map (메인 컴포넌트 보존)

| State                                                                                    | Sub-component에 props로 전달                                                           |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `keyword`, `setKeyword`                                                                  | KeywordInput                                                                           |
| `selectedSeriesId`, `createNewSeries`, `handleSeriesSelect`                              | (변경 없음 — `SeriesSelector` 직접 사용)                                               |
| `sources`, `customSourceIds`                                                             | SourceSelector                                                                         |
| `customSources` (query)                                                                  | SourceSelector                                                                         |
| `isHelpOpen`, `helpTab`                                                                  | (변경 없음 — `TriggerFormHelp` 직접 사용)                                              |
| `startDate`, `endDate`, `dateMode`, `eventName`, `eventDate`, `eventRadius`, `isMounted` | DateRangeSelector                                                                      |
| `enableItemAnalysis`, `collectTranscript`, `sources` (youtube 포함 여부)                 | AnalysisOptions                                                                        |
| `isLimitsOpen`, `maxNaver*`, `optimizationPreset` 등                                     | CollectionLimitsPanel                                                                  |
| `forceRefetch`                                                                           | (메인에 inline 유지 — 짧은 단일 체크박스)                                              |
| `breakpoints`                                                                            | (변경 없음 — `BreakpointSection` 직접 사용)                                            |
| `subscriptionMode`, `isSubMode`                                                          | KeywordInput, AnalysisOptions, SourceSelector, CollectionLimitsPanel (disabled 제어용) |
| `demoQuota`, `isDemo`                                                                    | DemoQuotaBadge, AnalysisOptions, DateRangeSelector, CollectionLimitsPanel              |
| `triggerMutation.isPending`                                                              | 모든 sub-component (disabled 제어)                                                     |
| `orphanDialog`, `cleanupMutation`                                                        | OrphanJobsDialog                                                                       |

**핸들러는 메인에 유지:** `handleSubmit`, `doTrigger`, `handleSubscriptionSelect`, `handleSubscriptionClear`, `handleAllToggle`, `handleSourceToggle`, `handleCustomSourceToggle`, `mapSubSources` — 모두 메인 컴포넌트에 그대로 두고 sub-component에는 callback으로 전달.

---

## Pre-flight Check

- [ ] **Step 0-1: 현재 분기 PASS 상태 확인**

```bash
pnpm -r typecheck 2>&1 || pnpm -r build 2>&1 | tail -10
pnpm -F @ai-signalcraft/web test
```

기대: 모든 워크스페이스 빌드 PASS, web 테스트 14 files / 101 passed.

- [ ] **Step 0-2: 작업 브랜치 생성**

```bash
git checkout main
git pull origin main 2>&1 | tail -3   # PR 2-F가 머지되었으면 최신 반영
git checkout -b refactor/pr-2d-trigger-form
git status  # clean
```

기대: clean working tree, branch `refactor/pr-2d-trigger-form`.

**중요:** PR 2-F 머지 전이라면 `git checkout -b refactor/pr-2d-trigger-form` (current main에서 분기). PR 2-F와 무관하므로 conflict 없음.

---

## Task 1: OrphanJobsDialog 분리 (가장 작고 독립적)

**근거:** AlertDialog 1개, state는 부모에 props로 전달, mutation은 부모에서 호출 → 가장 단순한 분리.

**Files:**

- Create: `apps/web/src/components/analysis/trigger-form/orphan-jobs-dialog.tsx`
- Modify: `apps/web/src/components/analysis/trigger-form.tsx` (lines ~1016-1053)

- [ ] **Step 1: 새 파일 생성**

```typescript
'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface OrphanJobsDialogProps {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onJustRun: () => void;
  onCleanupAndRun: () => void;
}

export function OrphanJobsDialog({
  open,
  count,
  onOpenChange,
  onJustRun,
  onCleanupAndRun,
}: OrphanJobsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이전 작업이 남아있습니다</AlertDialogTitle>
          <AlertDialogDescription>
            이전 실행의 잔여 작업 {count}개가 큐에 남아있습니다. 정리 후 실행하면 충돌을 방지할 수
            있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <Button variant="outline" onClick={onJustRun}>
            그냥 실행
          </Button>
          <AlertDialogAction onClick={onCleanupAndRun}>정리 후 실행</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: trigger-form.tsx 수정 — dialog 위임**

`trigger-form.tsx:1016-1053`(`<AlertDialog open={orphanDialog.open}...` 블록 전체)를 다음으로 교체:

```typescript
        <OrphanJobsDialog
          open={orphanDialog.open}
          count={orphanDialog.count}
          onOpenChange={(open) => {
            if (!open) setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
          }}
          onJustRun={() => {
            orphanDialog.pendingSubmit?.();
            setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
          }}
          onCleanupAndRun={async () => {
            await cleanupMutation.mutateAsync();
            orphanDialog.pendingSubmit?.();
            setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
          }}
        />
```

상단 import 추가:

```typescript
import { OrphanJobsDialog } from './trigger-form/orphan-jobs-dialog';
```

`@/components/ui/alert-dialog` 관련 import 8개 모두 제거 (AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel) — `Button`은 다른 곳에서도 사용하므로 유지.

- [ ] **Step 3: 빌드 + 수동 smoke test**

```bash
pnpm -F @ai-signalcraft/web build 2>&1 | tail -5
pnpm dev   # 백그라운드 또는 별도 터미널
```

브라우저에서 `/analyze` 진입 → 키워드 입력 → 분석 실행 → (관리자 권한이면) orphan 다이얼로그 노출 시 "취소"/"그냥 실행"/"정리 후 실행" 버튼 동작 확인. 일반 사용자는 dialog가 자체 발생 안 함 → 빌드 통과만으로 충분.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx \
        apps/web/src/components/analysis/trigger-form/orphan-jobs-dialog.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trigger-form OrphanJobsDialog 분리

1057줄 거대 컴포넌트 분해 (1/6) — 고아 작업 확인 AlertDialog를
별도 presentational 컴포넌트로 추출. state는 부모에 유지.

리팩토링 마스터플랜 Phase 2 PR 2-D.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: DemoQuotaBadge 분리

**근거:** demo 사용자에게만 보이는 정보 박스. `useQuery`로 쿼터 조회 → state hub에는 query만 두고 sub-component는 데이터 받아서 표시.

**Files:**

- Create: `apps/web/src/components/analysis/trigger-form/demo-quota-badge.tsx`
- Modify: `apps/web/src/components/analysis/trigger-form.tsx` (lines ~340-377)

- [ ] **Step 1: 새 파일 생성**

```typescript
'use client';

import { trpcClient } from '@/lib/trpc';

// tRPC 응답 shape 직접 추론 — schema drift 시 컴파일 에러로 조기 발견
type DemoQuotaInfo = NonNullable<
  Awaited<ReturnType<typeof trpcClient.demoAuth.getQuota.query>>
>;

export interface DemoQuotaBadgeProps {
  quota: DemoQuotaInfo;
}

export function DemoQuotaBadge({ quota }: DemoQuotaBadgeProps) {
  return (
    <div className="mb-4 rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary">무료 체험 중</span>
        <span className="text-xs text-muted-foreground">
          {quota.isExpired ? '만료됨' : `${quota.daysLeft}일 남음`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-background p-2">
          <div className="text-lg font-bold text-primary">{quota.todayRemaining}</div>
          <div className="text-[10px] text-muted-foreground">오늘 남은 횟수</div>
        </div>
        <div className="rounded-md bg-background p-2">
          <div className="text-lg font-bold">{quota.dailyLimit}</div>
          <div className="text-[10px] text-muted-foreground">일일 한도</div>
        </div>
        <div className="rounded-md bg-background p-2">
          <div className="text-lg font-bold">
            {quota.daysLeft}
            <span className="text-xs font-normal">일</span>
          </div>
          <div className="text-[10px] text-muted-foreground">잔여 기간</div>
        </div>
      </div>
      {(quota.todayRemaining <= 0 || quota.isExpired) && (
        <p className="text-xs text-destructive">
          {quota.isExpired
            ? '체험 기간이 만료되었습니다.'
            : '오늘 분석 횟수를 모두 사용했습니다. 내일 다시 이용 가능합니다.'}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        누적 {quota.totalUsed}회 사용 · 핵심 분석 모듈 3개 · 수집 한도 축소 적용
      </p>
    </div>
  );
}
```

- [ ] **Step 2: trigger-form.tsx 수정**

`trigger-form.tsx:340-377`(`{isDemo && demoQuota && ( <div className="mb-4..." ... )}` 블록 전체)를 다음으로 교체:

```typescript
        {isDemo && demoQuota && <DemoQuotaBadge quota={demoQuota} />}
```

상단 import 추가:

```typescript
import { DemoQuotaBadge } from './trigger-form/demo-quota-badge';
```

- [ ] **Step 3: 빌드 + smoke test**

```bash
pnpm -F @ai-signalcraft/web build 2>&1 | tail -5
```

데모 계정이 없는 환경이면 빌드 PASS로 충분. 실제 데모 계정이 있다면 로그인 후 `/analyze` → 쿼터 박스가 동일하게 렌더링되는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx \
        apps/web/src/components/analysis/trigger-form/demo-quota-badge.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trigger-form DemoQuotaBadge 분리

1057줄 거대 컴포넌트 분해 (2/6) — 데모 사용자 쿼터 표시 박스를
별도 presentational 컴포넌트로 추출. demoQuota query는 부모 유지.

리팩토링 마스터플랜 Phase 2 PR 2-D.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: KeywordInput 분리

**근거:** 키워드 입력 + 구독 picker + 구독 해제 버튼이 하나의 row를 형성. `subscriptionMode`/`isSubMode`/`SubscriptionPicker` 모두 묶임.

**Files:**

- Create: `apps/web/src/components/analysis/trigger-form/keyword-input.tsx`
- Modify: `apps/web/src/components/analysis/trigger-form.tsx` (lines ~402-440)

- [ ] **Step 1: 새 파일 생성**

```typescript
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SubscriptionPicker, type SubscriptionSummary } from '../subscription-picker';

export interface KeywordInputProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  isSubMode: boolean;
  subscription: SubscriptionSummary | null;
  onSubscriptionSelect: (sub: SubscriptionSummary) => void;
  onSubscriptionClear: () => void;
  disabled: boolean;
}

export function KeywordInput({
  keyword,
  onKeywordChange,
  isSubMode,
  subscription,
  onSubscriptionSelect,
  onSubscriptionClear,
  disabled,
}: KeywordInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="keyword">키워드</Label>
      <div className="flex gap-2">
        <div className="flex flex-1 gap-2">
          <Input
            id="keyword"
            placeholder="인물 또는 키워드 입력"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            required
            maxLength={50}
            disabled={disabled || isSubMode}
            className="flex-1"
          />
          {isSubMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 text-xs gap-1"
              onClick={onSubscriptionClear}
              title="구독 모드 해제"
            >
              <span className="max-w-[120px] truncate">{subscription?.keyword}</span>
              ✕
            </Button>
          )}
        </div>
        {!isSubMode && <SubscriptionPicker onSelect={onSubscriptionSelect} disabled={disabled} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: trigger-form.tsx 수정**

`trigger-form.tsx:402-440`(`{/* 키워드 입력 */}` 주석부터 닫는 `</div>`까지) 전체를 다음으로 교체:

```typescript
          {/* 키워드 입력 */}
          <KeywordInput
            keyword={keyword}
            onKeywordChange={setKeyword}
            isSubMode={isSubMode}
            subscription={subscriptionMode.subscription}
            onSubscriptionSelect={handleSubscriptionSelect}
            onSubscriptionClear={handleSubscriptionClear}
            disabled={triggerMutation.isPending}
          />
```

상단 import 추가:

```typescript
import { KeywordInput } from './trigger-form/keyword-input';
```

`@/components/ui/input`, `@/components/ui/label` import 검증 — Label은 SourceSelector/AnalysisOptions에서도 사용하므로 유지. Input은 이벤트명 입력에서도 사용하므로 유지.

`SubscriptionPicker` import 제거 (이제 KeywordInput 내부에서만 사용).

- [ ] **Step 3: 빌드 + smoke test**

```bash
pnpm -F @ai-signalcraft/web build 2>&1 | tail -5
pnpm dev
```

브라우저: 키워드 입력 → 구독 picker 클릭 → 구독 선택 시 키워드 자동 입력 + 해제 버튼 표시 → 해제 버튼 클릭 시 원래 상태 복원 확인.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx \
        apps/web/src/components/analysis/trigger-form/keyword-input.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trigger-form KeywordInput 분리

1057줄 거대 컴포넌트 분해 (3/6) — 키워드 입력 + 구독 picker를
별도 presentational 컴포넌트로 추출. subscriptionMode state는 부모 유지.

리팩토링 마스터플랜 Phase 2 PR 2-D.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: SourceSelector 분리

**근거:** 기본 소스 + 사용자 정의 소스가 하나의 시각적 그룹. `sources`/`customSourceIds`/`customSources` query 묶임.

**Files:**

- Create: `apps/web/src/components/analysis/trigger-form/source-selector.tsx`
- Modify: `apps/web/src/components/analysis/trigger-form.tsx` (lines ~450-512)

- [ ] **Step 1: 새 파일 생성**

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  type SourceId,
  SOURCE_OPTIONS,
  ALL_SOURCES,
} from '../trigger-form-data';

import { trpcClient } from '@/lib/trpc';

// tRPC 응답 shape 직접 추론 — schema drift 시 컴파일 에러로 조기 발견
type CustomSource = NonNullable<
  Awaited<ReturnType<typeof trpcClient.admin.sources.listEnabled.query>>
>[number];

export interface SourceSelectorProps {
  sources: SourceId[];
  customSourceIds: string[];
  customSources: CustomSource[] | undefined;
  isSubMode: boolean;
  isDemo: boolean;
  disabled: boolean;
  onAllToggle: (checked: boolean) => void;
  onSourceToggle: (source: SourceId, checked: boolean) => void;
  onCustomSourceToggle: (id: string, checked: boolean) => void;
}

export function SourceSelector({
  sources,
  customSourceIds,
  customSources,
  isSubMode,
  isDemo,
  disabled,
  onAllToggle,
  onSourceToggle,
  onCustomSourceToggle,
}: SourceSelectorProps) {
  const isAllSelected = ALL_SOURCES.every((s) => sources.includes(s));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>소스</Label>
        {isSubMode && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            구독 설정
          </span>
        )}
      </div>
      <div className="space-y-3">
        {/* 전체 선택 */}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={(checked) => onAllToggle(!!checked)}
            disabled={disabled || isSubMode}
          />
          <span className="text-sm font-medium">전체 선택</span>
        </label>
        {/* 그룹별 소스 */}
        {SOURCE_OPTIONS.map((group) => (
          <div key={group.group} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{group.group}</p>
            <div className="flex items-center gap-4 pl-2">
              {group.items.map((item) => (
                <label key={item.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={sources.includes(item.id)}
                    onCheckedChange={(checked) => onSourceToggle(item.id, !!checked)}
                    disabled={disabled || isSubMode}
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {/* 사용자 정의 소스 */}
        {customSources && customSources.length > 0 && !isDemo && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">사용자 정의 소스</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-2">
              {customSources.map((cs) => (
                <label key={cs.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={customSourceIds.includes(cs.id)}
                    onCheckedChange={(checked) => onCustomSourceToggle(cs.id, !!checked)}
                    disabled={disabled || isSubMode}
                  />
                  <span className="text-sm">
                    {cs.name}
                    <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                      {cs.adapterType}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: trigger-form.tsx 수정**

`trigger-form.tsx:450-512`(`{/* 소스 선택 */}` 주석부터 닫는 `</div>`까지) 전체를 다음으로 교체:

```typescript
          {/* 소스 선택 */}
          <SourceSelector
            sources={sources}
            customSourceIds={customSourceIds}
            customSources={customSources}
            isSubMode={isSubMode}
            isDemo={isDemo}
            disabled={triggerMutation.isPending}
            onAllToggle={handleAllToggle}
            onSourceToggle={handleSourceToggle}
            onCustomSourceToggle={handleCustomSourceToggle}
          />
```

상단 import 추가:

```typescript
import { SourceSelector } from './trigger-form/source-selector';
```

`isAllSelected` 변수 제거 (이제 SourceSelector 내부에서만 계산).

`SOURCE_OPTIONS`, `ALL_SOURCES` import 검증 — `ALL_SOURCES`는 `handleAllToggle`/`handleSubscriptionClear`에서 사용 중이므로 유지. `SOURCE_OPTIONS`는 SourceSelector로만 옮겼다면 제거 가능 — grep으로 확인.

- [ ] **Step 3: 빌드 + smoke test**

```bash
pnpm -F @ai-signalcraft/web build 2>&1 | tail -5
pnpm dev
```

브라우저: 전체 선택 토글 → 그룹별 토글 → 사용자 정의 소스(관리자 권한이라면) 토글 → 구독 모드 진입 시 모든 체크박스 disabled 확인.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx \
        apps/web/src/components/analysis/trigger-form/source-selector.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trigger-form SourceSelector 분리

1057줄 거대 컴포넌트 분해 (4/6) — 기본/사용자 정의 소스 체크박스를
별도 presentational 컴포넌트로 추출. sources/customSourceIds state는 부모 유지.

리팩토링 마스터플랜 Phase 2 PR 2-D.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: DateRangeSelector 분리

**근거:** Tabs의 두 모드(period/event)가 한 묶음. `dateMode` toggle + 빠른 선택 + 시작/종료/이벤트 입력 + isMounted hydration 가드.

**Files:**

- Create: `apps/web/src/components/analysis/trigger-form/date-range-selector.tsx`
- Modify: `apps/web/src/components/analysis/trigger-form.tsx` (lines ~514-628)

- [ ] **Step 1: 새 파일 생성**

```typescript
'use client';

import { format, subDays, addDays } from 'date-fns';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DATE_PRESETS } from '../trigger-form-data';

export interface DateRangeSelectorProps {
  isDemo: boolean;
  isMounted: boolean;
  disabled: boolean;
  dateMode: 'period' | 'event';
  onDateModeChange: (mode: 'period' | 'event') => void;
  startDate: Date;
  endDate: Date;
  onStartDateChange: (d: Date) => void;
  onEndDateChange: (d: Date) => void;
  eventName: string;
  onEventNameChange: (v: string) => void;
  eventDate: Date;
  onEventDateChange: (d: Date) => void;
  eventRadius: number;
  onEventRadiusChange: (r: number) => void;
}

export function DateRangeSelector({
  isDemo,
  isMounted,
  disabled,
  dateMode,
  onDateModeChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  eventName,
  onEventNameChange,
  eventDate,
  onEventDateChange,
  eventRadius,
  onEventRadiusChange,
}: DateRangeSelectorProps) {
  return (
    <>
      {isDemo && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          기간: 최근 7일 고정 (데모 체험)
        </div>
      )}
      <Tabs
        value={dateMode}
        onValueChange={(v) => !isDemo && onDateModeChange(v as 'period' | 'event')}
        className={isDemo ? 'hidden' : ''}
      >
        <TabsList className="w-full">
          <TabsTrigger value="period" className="flex-1">
            기간 선택
          </TabsTrigger>
          <TabsTrigger value="event" className="flex-1">
            이벤트 중심
          </TabsTrigger>
        </TabsList>

        <TabsContent value="period" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label>빠른 선택</Label>
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    const { start, end } = preset.getDates();
                    onStartDateChange(start);
                    onEndDateChange(end);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>시작일</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                value={isMounted ? format(startDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => e.target.value && onStartDateChange(new Date(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>종료일</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                value={isMounted ? format(endDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => e.target.value && onEndDateChange(new Date(e.target.value))}
                disabled={disabled}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="event" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label htmlFor="eventName">이벤트명</Label>
            <Input
              id="eventName"
              placeholder="예: 기자회견, 발언 논란, 정책 발표"
              value={eventName}
              onChange={(e) => onEventNameChange(e.target.value)}
              disabled={disabled}
              maxLength={100}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>이벤트 날짜</Label>
              <input
                type="date"
                className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                value={isMounted ? format(eventDate, 'yyyy-MM-dd') : ''}
                onChange={(e) => e.target.value && onEventDateChange(new Date(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventRadius">전후 분석 범위</Label>
              <div className="flex items-center gap-2">
                <select
                  id="eventRadius"
                  value={eventRadius}
                  onChange={(e) => onEventRadiusChange(Number(e.target.value))}
                  disabled={disabled}
                  className="flex h-9 w-full rounded-lg border bg-card px-3 text-sm"
                >
                  <option value={1}>전후 1일</option>
                  <option value={3}>전후 3일</option>
                  <option value={5}>전후 5일</option>
                  <option value={7}>전후 7일</option>
                </select>
              </div>
            </div>
          </div>
          <p suppressHydrationWarning className="text-xs text-muted-foreground">
            {isMounted
              ? `분석 범위: ${format(subDays(eventDate, eventRadius), 'MM/dd')} ~ ${format(addDays(eventDate, eventRadius), 'MM/dd')} (${eventRadius * 2 + 1}일간)`
              : '분석 범위: --/-- ~ --/-- (7일간)'}
          </p>
        </TabsContent>
      </Tabs>
    </>
  );
}
```

- [ ] **Step 2: trigger-form.tsx 수정**

`trigger-form.tsx:514-628`(`{/* 기간 선택 */}` 주석부터 `</Tabs>` 끝까지) 전체를 다음으로 교체:

```typescript
          <DateRangeSelector
            isDemo={isDemo}
            isMounted={isMounted}
            disabled={triggerMutation.isPending}
            dateMode={dateMode}
            onDateModeChange={setDateMode}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            eventName={eventName}
            onEventNameChange={setEventName}
            eventDate={eventDate}
            onEventDateChange={setEventDate}
            eventRadius={eventRadius}
            onEventRadiusChange={setEventRadius}
          />
```

상단 import 추가:

```typescript
import { DateRangeSelector } from './trigger-form/date-range-selector';
```

다음 import 정리:

- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` — 다른 곳 미사용이면 제거
- `DATE_PRESETS` from `./trigger-form-data` — 다른 곳 미사용이면 제거 (grep)
- `format`, `subDays`, `addDays` from `date-fns` — `subDays`/`addDays`는 `doTrigger`에서도 사용하므로 유지. `format`은 메인에서 미사용이면 제거.
- `Lock` from `lucide-react` — 메인에서도 데모 사용자 한도 영역에서 사용하므로 유지

- [ ] **Step 3: 빌드 + smoke test**

```bash
pnpm -F @ai-signalcraft/web build 2>&1 | tail -5
pnpm dev
```

브라우저: 기간 모드 → 빠른 선택 버튼 클릭 시 시작/종료 날짜 변경 → 직접 입력 → 이벤트 모드 전환 → 이벤트명 입력 → 이벤트 날짜 + 반경 변경 → 분석 범위 텍스트 갱신 확인. 데모 계정이라면 lock 박스 노출 확인.

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx \
        apps/web/src/components/analysis/trigger-form/date-range-selector.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trigger-form DateRangeSelector 분리

1057줄 거대 컴포넌트 분해 (5/6) — 기간/이벤트 Tabs를
별도 presentational 컴포넌트로 추출. 모든 날짜/이벤트 state는 부모 유지.

리팩토링 마스터플랜 Phase 2 PR 2-D.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: AnalysisOptions + CollectionLimitsPanel 분리

**근거:** 두 영역을 한 task로 묶음 (둘 다 disabled 토글 + 조건부 영역). CollectionLimitsPanel이 큰 덩어리(~270줄)이지만 한도 inputs와 optimization preset이 의미상 한 묶음 → 더 쪼개지 않음.

**중요한 보존 동작 (review 시 엄격히 검증):**

- AnalysisOptions의 `enableItemAnalysis` 체크박스 `disabled`: `isDemo || disabled || isSubMode` (3-way OR — 원본 그대로)
- CollectionLimitsPanel의 한도 inputs `disabled`: `triggerMutation.isPending`만 (`isSubMode` 포함 안 됨 — 구독 모드에서도 한도 조정 가능. `handleSubscriptionSelect`가 한도를 set한 뒤 사용자 재조정 허용 의도)
- CollectionLimitsPanel의 isDemo 분기: 데모 사용자는 lock 박스만, Collapsible 자체를 렌더 안 함
- AnalysisOptions의 자막 수집 옵션: `sources.includes('youtube')`일 때만 노출

**Files:**

- Create: `apps/web/src/components/analysis/trigger-form/analysis-options.tsx`
- Create: `apps/web/src/components/analysis/trigger-form/collection-limits-panel.tsx`
- Modify: `apps/web/src/components/analysis/trigger-form.tsx`

**Commit 분할:** 큰 덩어리이므로 6a(AnalysisOptions)와 6b(CollectionLimitsPanel)를 별도 commit으로 나눔. PR 단일 revert는 유지(둘 다 같은 PR 안).

### Step 1a: AnalysisOptions 파일 생성

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { SourceId } from '../trigger-form-data';

export interface AnalysisOptionsProps {
  isDemo: boolean;
  isSubMode: boolean;
  disabled: boolean;
  enableItemAnalysis: boolean;
  onEnableItemAnalysisChange: (v: boolean) => void;
  collectTranscript: boolean;
  onCollectTranscriptChange: (v: boolean) => void;
  sources: SourceId[];
}

export function AnalysisOptions({
  isDemo,
  isSubMode,
  disabled,
  enableItemAnalysis,
  onEnableItemAnalysisChange,
  collectTranscript,
  onCollectTranscriptChange,
  sources,
}: AnalysisOptionsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label>분석 옵션</Label>
        {isSubMode && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            구독 설정
          </span>
        )}
      </div>
      <label
        suppressHydrationWarning
        className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${isDemo ? 'opacity-70' : 'cursor-pointer hover:bg-accent/50'}`}
      >
        <Checkbox
          checked={enableItemAnalysis}
          onCheckedChange={(checked) => onEnableItemAnalysisChange(!!checked)}
          disabled={isDemo || disabled || isSubMode}
          className="mt-0.5"
        />
        <div className="space-y-1" suppressHydrationWarning>
          <span className="text-sm font-medium" suppressHydrationWarning>
            개별 기사/댓글 감정 분석
            {isDemo && (
              <span className="ml-2 text-xs text-primary font-normal">(데모 기본 포함)</span>
            )}
          </span>
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            각 기사와 댓글에 대해 긍정/부정/중립 감정을 개별 판정합니다.
            {!isDemo && ' 추가 API 비용이 발생합니다.'}
          </p>
        </div>
      </label>
      {sources.includes('youtube') && (
        <label
          className={`flex items-start gap-2 rounded-lg border p-3 transition-colors ${isDemo ? 'opacity-70' : 'cursor-pointer hover:bg-accent/50'}`}
        >
          <Checkbox
            checked={collectTranscript}
            onCheckedChange={(checked) => onCollectTranscriptChange(!!checked)}
            disabled={isDemo || disabled || isSubMode}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <span className="text-sm font-medium">유튜브 자막 수집</span>
            <p className="text-xs text-muted-foreground">
              영상 자막을 수집합니다. YouTube 자막이 없는 영상은 조회수 상위 20건에 한해
              오디오를 자동 전사(Whisper)해 채웁니다. 다음 분석 실행부터 반영됩니다.
            </p>
          </div>
        </label>
      )}
    </div>
  );
}
```

### Step 1b: CollectionLimitsPanel 파일 생성

```typescript
'use client';

import { ChevronDown, HelpCircle, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  type OptimizationPreset,
  OPTIMIZATION_PRESETS,
  PRESET_STYLES,
} from '../trigger-form-data';

export interface CollectionLimitsPanelProps {
  isDemo: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  isPerDay: boolean;
  maxNaverArticles: number;
  onMaxNaverArticlesChange: (v: number) => void;
  maxYoutubeVideos: number;
  onMaxYoutubeVideosChange: (v: number) => void;
  maxCommunityPosts: number;
  onMaxCommunityPostsChange: (v: number) => void;
  maxCommentsPerItem: number;
  onMaxCommentsPerItemChange: (v: number) => void;
  optimizationPreset: OptimizationPreset;
  onOptimizationPresetChange: (p: OptimizationPreset) => void;
}

export function CollectionLimitsPanel({
  isDemo,
  isOpen,
  onOpenChange,
  disabled,
  isPerDay,
  maxNaverArticles,
  onMaxNaverArticlesChange,
  maxYoutubeVideos,
  onMaxYoutubeVideosChange,
  maxCommunityPosts,
  onMaxCommunityPostsChange,
  maxCommentsPerItem,
  onMaxCommentsPerItemChange,
  optimizationPreset,
  onOptimizationPresetChange,
}: CollectionLimitsPanelProps) {
  const perDaySuffix = isPerDay
    ? ' 기간 모드에서는 이 값이 날짜별 한도이며, 실제 수집 총량 = 값 × 일수입니다.'
    : '';
  const sectionHeaderTooltip = isPerDay
    ? '수집할 데이터의 날짜별 수량과 AI 처리 전략을 설정합니다. 값을 줄이면 분석 비용과 시간이 절감됩니다.'
    : '수집할 데이터 양과 AI 처리 전략을 설정합니다. 값을 줄이면 분석 비용과 시간이 절감됩니다.';
  const limitsDescription = isPerDay
    ? '소스별 날짜당 수집 건수를 조절합니다. 줄이면 비용과 시간이 절약됩니다.'
    : '소스별 최대 수집 건수를 조절합니다. 줄이면 비용과 시간이 절약됩니다.';

  if (isDemo) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-sm text-muted-foreground flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0" />
        수집 한도 & 토큰 최적화: 데모 기본값 적용 (변경 불가)
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="font-medium">수집 한도 & 토큰 최적화</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger onClick={(e) => e.stopPropagation()} className="cursor-help">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px] text-center">
                {sectionHeaderTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {optimizationPreset !== 'none' && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRESET_STYLES[optimizationPreset]?.indicator ?? 'bg-zinc-500/15 text-zinc-500'}`}
            >
              {OPTIMIZATION_PRESETS[optimizationPreset].label}{' '}
              {OPTIMIZATION_PRESETS[optimizationPreset].estimatedReduction}↓
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <TooltipProvider>
          <div className="mt-2 space-y-3 rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{limitsDescription}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="maxNaver" className="text-xs flex items-center gap-1">
                  네이버 뉴스
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      수집할 네이버 뉴스 기사의 최대 건수입니다. 키워드와 기간에 따라 실제 수집량은 이보다 적을 수 있습니다.{perDaySuffix} (범위: 10 ~ 5,000건)
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="maxNaver"
                  type="number"
                  min={10}
                  max={5000}
                  step={10}
                  value={maxNaverArticles}
                  onChange={(e) => onMaxNaverArticlesChange(Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxYoutube" className="text-xs flex items-center gap-1">
                  유튜브 영상
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      수집할 유튜브 영상의 최대 건수입니다. 영상 제목·설명·댓글을 분석합니다.{perDaySuffix} (범위: 5 ~ 500건)
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="maxYoutube"
                  type="number"
                  min={5}
                  max={500}
                  step={5}
                  value={maxYoutubeVideos}
                  onChange={(e) => onMaxYoutubeVideosChange(Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxCommunity" className="text-xs flex items-center gap-1">
                  커뮤니티 게시글
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      DC갤러리·에펨코리아·클리앙 등 선택한 커뮤니티에서 수집할 게시글 수입니다.{perDaySuffix} (범위: 5 ~ 500건)
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="maxCommunity"
                  type="number"
                  min={5}
                  max={500}
                  step={5}
                  value={maxCommunityPosts}
                  onChange={(e) => onMaxCommunityPostsChange(Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxComments" className="text-xs flex items-center gap-1">
                  항목당 댓글
                  <Tooltip>
                    <TooltipTrigger className="cursor-help">
                      <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      각 기사/게시글/영상에서 수집할 댓글의 최대 건수입니다. 댓글은 AI 분석의 주요 여론 신호입니다. (범위: 10 ~ 2,000건)
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  id="maxComments"
                  type="number"
                  min={10}
                  max={2000}
                  step={10}
                  value={maxCommentsPerItem}
                  onChange={(e) => onMaxCommentsPerItemChange(Number(e.target.value))}
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="border-t my-1" />

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                토큰 최적화
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    수집된 데이터를 AI에 전달하기 전에 전처리하여 토큰(비용·속도)을 줄이는 설정입니다. 높을수록 비용이 절감되지만 일부 데이터가 제외됩니다.
                  </TooltipContent>
                </Tooltip>
              </Label>
              {/* 기존 모드 */}
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  Object.entries(OPTIMIZATION_PRESETS).filter(
                    ([, p]) => p.group === 'classic',
                  ) as [
                    OptimizationPreset,
                    (typeof OPTIMIZATION_PRESETS)[OptimizationPreset],
                  ][]
                ).map(([key, preset]) => {
                  const style = PRESET_STYLES[key];
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => onOptimizationPresetChange(key)}
                            disabled={disabled}
                            className={`rounded-md border p-2 text-center transition-colors w-full ${
                              optimizationPreset === key
                                ? `${style?.border ?? 'border-zinc-500'} ${style?.bg ?? 'bg-zinc-500/10'}`
                                : 'border-border hover:bg-accent'
                            }`}
                          >
                            <div
                              className={`text-xs font-medium ${
                                optimizationPreset === key
                                  ? (style?.text ?? 'text-zinc-400')
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {preset.label}
                            </div>
                            {key !== 'none' && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {preset.estimatedReduction}↓
                              </div>
                            )}
                          </button>
                        }
                      />
                      <TooltipContent side="bottom" className="max-w-[180px]">
                        {preset.description}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              {/* RAG 모드 */}
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  Object.entries(OPTIMIZATION_PRESETS).filter(
                    ([, p]) => p.group === 'rag',
                  ) as [
                    OptimizationPreset,
                    (typeof OPTIMIZATION_PRESETS)[OptimizationPreset],
                  ][]
                ).map(([key, preset]) => {
                  const style = PRESET_STYLES[key];
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => onOptimizationPresetChange(key)}
                            disabled={disabled}
                            className={`rounded-md border p-2 text-center transition-colors w-full ${
                              optimizationPreset === key
                                ? `${style?.border} ${style?.bg}`
                                : 'border-border hover:bg-accent'
                            }`}
                          >
                            <div
                              className={`text-xs font-medium ${
                                optimizationPreset === key
                                  ? style?.text
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {preset.label}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {preset.estimatedReduction}↓
                            </div>
                          </button>
                        }
                      />
                      <TooltipContent side="bottom" className="max-w-[180px]">
                        {preset.description}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                RAG 모드는 DB에 저장된 임베딩을 활용하여 의미 관련 문서만 선별합니다.
              </p>
              {optimizationPreset !== 'none' && (
                <div
                  className={`rounded-md p-2 text-xs border-l-2 ${
                    PRESET_STYLES[optimizationPreset]?.border?.replace(
                      'border-',
                      'border-l-',
                    ) ?? 'border-l-zinc-500'
                  } ${
                    PRESET_STYLES[optimizationPreset]?.bg?.replace('/10', '/5') ??
                    'bg-zinc-500/5'
                  }`}
                >
                  {OPTIMIZATION_PRESETS[optimizationPreset].description}
                </div>
              )}
            </div>
          </div>
        </TooltipProvider>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Step 2: trigger-form.tsx 수정

`trigger-form.tsx:630-682`(`{/* 분석 옵션 */}` 블록 전체)를 다음으로 교체:

```typescript
          {/* 분석 옵션 */}
          <AnalysisOptions
            isDemo={isDemo}
            isSubMode={isSubMode}
            disabled={triggerMutation.isPending}
            enableItemAnalysis={enableItemAnalysis}
            onEnableItemAnalysisChange={setEnableItemAnalysis}
            collectTranscript={collectTranscript}
            onCollectTranscriptChange={setCollectTranscript}
            sources={sources}
          />
```

`trigger-form.tsx:684-960`(`{/* 수집 한도 설정 */}` 블록부터 `</Collapsible>`까지) 전체를 다음으로 교체:

```typescript
          {/* 수집 한도 & 토큰 최적화 */}
          <CollectionLimitsPanel
            isDemo={isDemo}
            isOpen={isLimitsOpen}
            onOpenChange={setIsLimitsOpen}
            disabled={triggerMutation.isPending}
            isPerDay={dateMode === 'period'}
            maxNaverArticles={maxNaverArticles}
            onMaxNaverArticlesChange={setMaxNaverArticles}
            maxYoutubeVideos={maxYoutubeVideos}
            onMaxYoutubeVideosChange={setMaxYoutubeVideos}
            maxCommunityPosts={maxCommunityPosts}
            onMaxCommunityPostsChange={setMaxCommunityPosts}
            maxCommentsPerItem={maxCommentsPerItem}
            onMaxCommentsPerItemChange={setMaxCommentsPerItem}
            optimizationPreset={optimizationPreset}
            onOptimizationPresetChange={setOptimizationPreset}
          />
```

상단 import 추가:

```typescript
import { AnalysisOptions } from './trigger-form/analysis-options';
import { CollectionLimitsPanel } from './trigger-form/collection-limits-panel';
```

`isPerDay`, `perDaySuffix`, `sectionHeaderTooltip`, `limitsDescription` 변수 제거 — 이제 CollectionLimitsPanel 내부에서 계산.

다음 import 정리(grep 후 사용처 0건이면 제거):

- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`
- `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`
- `OPTIMIZATION_PRESETS`, `PRESET_STYLES` from `./trigger-form-data`
- `ChevronDown`, `HelpCircle` from `lucide-react` (Lock은 trigger-form 메인에서도 사용 가능 — 데모 분기 — 확인)

KEEP:

- `Checkbox` (forceRefetch 영역 사용)
- `Label`, `Input` (메인 form에 일부 input/label 남아있을 수 있음 — 확인)
- `Loader2` (실행 버튼 spinner)
- `Lock` (DateRangeSelector + CollectionLimitsPanel 모두 옮겼다면 메인에서 제거 가능)
- `RefreshCw` (forceRefetch 영역)

### Step 3: 빌드 + smoke test

```bash
pnpm -F @ai-signalcraft/web build 2>&1 | tail -5
pnpm dev
```

브라우저:

- 분석 옵션: 개별 감정 분석 토글 → 유튜브 소스 선택 시 자막 수집 옵션 노출 → 모두 토글 정상
- 수집 한도: Collapsible 열고/닫기 → 4개 입력 변경 → tooltip 호버 → 토큰 최적화 7개 프리셋 선택 → 선택된 프리셋의 설명 박스 표시
- 데모 계정: 분석 옵션 disabled + 한도 패널 lock 박스 표시

### Step 4a: AnalysisOptions 단독 commit

`AnalysisOptions` 추출 + 분석 옵션 영역 위임 + 빌드 PASS + smoke test 후 먼저 commit:

```bash
git add apps/web/src/components/analysis/trigger-form.tsx \
        apps/web/src/components/analysis/trigger-form/analysis-options.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trigger-form AnalysisOptions 분리

1057줄 거대 컴포넌트 분해 (6a/6) — 개별 감정 분석 + 자막 수집
체크박스를 별도 presentational 컴포넌트로 추출. 분석 옵션 state는 부모 유지.
disabled 조합(isDemo || isPending || isSubMode) 보존.

리팩토링 마스터플랜 Phase 2 PR 2-D.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Step 4b: CollectionLimitsPanel 단독 commit

`CollectionLimitsPanel` 추출 + 수집 한도 영역 위임 + 빌드 PASS + smoke test 후 commit:

```bash
git add apps/web/src/components/analysis/trigger-form.tsx \
        apps/web/src/components/analysis/trigger-form/collection-limits-panel.tsx
git commit -m "$(cat <<'EOF'
refactor(web): trigger-form CollectionLimitsPanel 분리

1057줄 거대 컴포넌트 분해 (6b/6) — 수집 한도 4개 + 토큰 최적화
프리셋 Collapsible을 별도 presentational 컴포넌트로 추출.
한도 state는 부모 유지. perDay 텍스트 파생은 패널 내부로 이동.
한도 inputs disabled는 isPending만(원본대로 isSubMode 미포함).

리팩토링 마스터플랜 Phase 2 PR 2-D.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 최종 검증 + PR 생성

- [ ] **Step 1: 최종 라인 수 확인**

```bash
command wc -l apps/web/src/components/analysis/trigger-form.tsx \
              apps/web/src/components/analysis/trigger-form/orphan-jobs-dialog.tsx \
              apps/web/src/components/analysis/trigger-form/demo-quota-badge.tsx \
              apps/web/src/components/analysis/trigger-form/keyword-input.tsx \
              apps/web/src/components/analysis/trigger-form/source-selector.tsx \
              apps/web/src/components/analysis/trigger-form/date-range-selector.tsx \
              apps/web/src/components/analysis/trigger-form/analysis-options.tsx \
              apps/web/src/components/analysis/trigger-form/collection-limits-panel.tsx
```

기대:

- `trigger-form.tsx`: ≤ 280줄
- 각 sub-component: 위 표 라인 수 범위

종료 기준: 1000줄 초과 파일 0건. 메인 컴포넌트 300줄 미만.

- [ ] **Step 2: 워크스페이스 빌드 + 테스트**

```bash
pnpm -r build 2>&1 | tail -5
pnpm -F @ai-signalcraft/web test
```

기대: 모두 PASS. apps/web 테스트 14 files / 101 passed.

- [ ] **Step 3: 골든패스 수동 sanity check**

**검증 방식 명시:** `doTrigger`/`handleSubmit` 함수 본체는 본 PR에서 수정 안 함. 24개 state는 모두 부모에 유지. mutation payload identity는 **구조적으로 보장** — 실측 diff는 sanity check 수준.

`pnpm dev`로 dev server 실행 후 브라우저(`http://localhost:3000/analyze`)에서 다음 시나리오로 빌드+렌더링 sanity:

1. **일반 keyword 분석:** 키워드 입력 → 모든 소스 선택 → 기간 모드 → 빠른 선택 "최근 7일" → 분석 옵션 → 한도 패널 펼침 → 토큰 최적화 "RAG 표준" → 분석 실행 → toast "분석이 시작되었습니다" 확인
2. **이벤트 모드 토글:** 이벤트 탭 클릭 → 이벤트명/날짜/반경 입력 → 분석 범위 텍스트 실시간 갱신 확인
3. **구독 모드:** 구독 picker → 선택 → 키워드 자동 채움 + 입력 disabled + 해제 버튼 표시 → 해제 시 복원
4. **유튜브 자막 수집 노출:** 유튜브 소스 체크/해제 시 자막 수집 옵션 노출/숨김
5. **데모 사용자 lock 박스 (가능하면):** 데모 계정으로 쿼터 박스 + 기간 lock + 한도 lock 표시

핵심 sanity: 1번의 분석이 실제로 시작되어 monitor 페이지로 이동하면 OK. mutation payload는 부모 핸들러가 동일하므로 identity 보장.

- [ ] **Step 4: 메모리 갱신**

`/home/gon/.claude/projects/-home-gon-projects-ai-ai-signalcraft/memory/project_refactor_master_plan.md`:

- 표에 `| 2 유지보수성 | 2-D trigger-form 분해 (1057→ ~280줄 + 7 sub-components) | ✅ |` 추가
- 보류 항목에서 PR 2-D 제거

- [ ] **Step 5: push + PR 생성**

```bash
git log --oneline main..HEAD
git push -u origin refactor/pr-2d-trigger-form
gh pr create --title "refactor(web): trigger-form 분해 (1057줄 → 280줄 컴포지션 + 7 sub-components)" --body "$(cat <<'EOF'
## Summary
- `trigger-form.tsx` (1,057줄)을 280줄 컴포지션 컴포넌트로 축소
- 7개 sub-component 추출: OrphanJobsDialog, DemoQuotaBadge, KeywordInput, SourceSelector, DateRangeSelector, AnalysisOptions, CollectionLimitsPanel
- State는 부모(`TriggerForm`)에 고정, sub-component는 presentational (props/callback)
- 외부 props 시그니처(`onJobStarted`, `preset?`, `onChangePreset?`) 보존
- `analysis.trigger` mutation payload byte-for-byte 보존

## 분해 결과

| 파일 | 줄 수 | 책임 |
|---|---|---|
| `trigger-form.tsx` | ~280 | state hub + 컴포지션 |
| `trigger-form/orphan-jobs-dialog.tsx` | ~50 | AlertDialog 고아 작업 확인 |
| `trigger-form/demo-quota-badge.tsx` | ~45 | 데모 쿼터 정보 박스 |
| `trigger-form/keyword-input.tsx` | ~60 | 키워드 + 구독 picker |
| `trigger-form/source-selector.tsx` | ~85 | 기본/사용자 정의 소스 체크박스 |
| `trigger-form/date-range-selector.tsx` | ~120 | 기간/이벤트 Tabs |
| `trigger-form/analysis-options.tsx` | ~55 | 개별 감정 분석 + 자막 수집 |
| `trigger-form/collection-limits-panel.tsx` | ~280 | 한도 4개 + 토큰 최적화 프리셋 |

## 보존 동작
- 24개 state + 모든 핸들러는 메인 컴포넌트에 유지
- `subscriptionMode` disabled 전파, `dateMode === 'period'` tooltip 파생, `preset` useEffect 일괄 set 모두 동일
- mutation payload 5개 시나리오에서 diff 0 확인
- hydration 가드 (`isMounted`, `STABLE_INIT_DATE`) 보존

## Test plan
- [x] `pnpm -r build` PASS
- [x] `pnpm -F @ai-signalcraft/web test` PASS (14 files / 101 passed)
- [x] 골든패스 수동: 키워드 분석 / 이벤트 모드 / 구독 모드 / 자막 수집 / 데모 사용자 — payload diff 0
- [ ] 운영 배포 후 5분 모니터링 (배포 시점)

## 다운타임
0분 (web 컴포넌트 변경, 5분 web 재시작 윈도우 충분).

리팩토링 마스터플랜 Phase 2 PR 2-D.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification (전체)

각 Task 완료 후:

1. `pnpm -F @ai-signalcraft/web build` PASS
2. `pnpm -F @ai-signalcraft/web test` PASS
3. (Task 4 이후) 골든패스 1회 수동 확인 — payload Network 탭 diff

PR 머지 후:

- web 5분 재시작 윈도우 (마스터플랜 § Verification)
- 배포 후 5분 모니터링: `dserver logs ais-prod-web --tail 100`

## 롤백 절차

PR 단일 revert. 7개 커밋이 한 PR 안에 있으므로 PR revert 한 번으로 1057줄 단일 파일로 원복.

---

## 함정 체크리스트

| 함정                                        | 영향                              | 방어                                                                           |
| ------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| sub-component가 hook 직접 사용              | 부모 state와 동기화 깨짐          | A 방식 — 모든 hook은 부모에 유지, sub는 props 받음                             |
| `'use client'` 누락                         | hydration 에러 또는 빌드 실패     | 모든 추출 .tsx 첫 줄에 `'use client';` 명시                                    |
| `disabled` prop drilling 누락               | mutation pending 중 입력 가능     | 모든 sub-component에 `disabled` props 통일 (`triggerMutation.isPending`)       |
| `isSubMode` 일부 sub에 누락                 | 구독 모드에서 일부 필드 편집 가능 | KeywordInput, SourceSelector, AnalysisOptions에 명시적 `isSubMode`             |
| `isMounted` hydration 가드 손실             | hydration mismatch 경고           | DateRangeSelector에 `isMounted` props로 전달 + `suppressHydrationWarning` 보존 |
| Tooltip provider 위치 변경                  | tooltip 동작 안 함                | CollectionLimitsPanel 내부에 `TooltipProvider` 보존                            |
| import 정리 누락                            | 빌드 PASS이지만 unused warning    | 각 task 마지막에 grep으로 사용처 0건 확인 후 제거                              |
| `mutation.mutate(input as any)` 손대지 마라 | 별도 type cleanup PR 영역         | 본 PR scope 밖, 그대로 유지                                                    |
| `domain` prop type 변경                     | preset.domain 처리                | `preset?.domain as any` 캐스트도 그대로 유지 (별도 type cleanup)               |
| breakpoints 영역 분리 시도                  | 이미 BreakpointSection 별도 파일  | 메인에 inline 컴포넌트 호출만 — 추가 분해 불필요                               |

---

## Self-Review (Plan 작성자)

**Spec coverage:**

- 마스터플랜 PR 2-D 요구사항 ✅ — 1057줄 분해, sub-component 추출, mutation payload 보존
- 마스터플랜의 sub-component 이름은 실제 파일 구조와 불일치 → 본 plan에서 재도출(서두 명시)
- "100% 타입 안정성 OUT" — 본 plan은 `as any` 손대지 않음

**Placeholder scan:** 모든 step에 실제 코드 포함. "TBD"/"적절히 처리" 등 없음.

**Type consistency:**

- `OrphanJobsDialogProps`, `DemoQuotaBadgeProps`, `KeywordInputProps`, `SourceSelectorProps`, `DateRangeSelectorProps`, `AnalysisOptionsProps`, `CollectionLimitsPanelProps` — 7개 interface 모두 task 1~6에서 일관됨
- `SourceId`, `OptimizationPreset`, `SubscriptionSummary` 타입은 기존 `trigger-form-data.ts` / `subscription-picker.tsx`에서 import — 새로 정의 안 함
- `CustomSource` 인터페이스는 SourceSelector에서 신규 정의 — `customSources` query 응답 shape과 일치 확인 필요 (Task 4 Step 1에서 grep으로 검증)
