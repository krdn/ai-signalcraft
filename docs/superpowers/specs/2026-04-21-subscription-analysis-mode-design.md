# 구독 기반 분석 실행 모드 설계

**날짜**: 2026-04-21
**상태**: 승인됨

## 배경

현재 "구독에서 선택" 기능은 구독의 키워드만 분석 폼에 주입한다. 소스, 한도, 분석 옵션은 사용자가 다시 설정해야 하며, 전량 재수집도 선택 가능하여 구독 데이터를 무시하게 된다.

구독으로 이미 수집된 데이터를 기반으로 분석을 실행할 때는 기간만 선택하면 되도록 간소화한다.

## 요구사항

### 구독 모드에서 편집 가능/불가능 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 프리셋 | 편집 가능 | 일반 모드와 동일하게 선택 |
| 키워드 | 읽기전용 | 구독에서 가져옴 |
| 소스 | 읽기전용 | 구독에서 가져옴 |
| 기간 | 편집 가능 | 항상 편집 가능 |
| 분석 옵션 (개별기사/댓글, 유튜브 자막) | 읽기전용 | 구독 설정 사용 |
| 수집 한도 & 토큰 최적화 | 편집 가능 | 기본값은 구독 설정 |
| 전량 재수집 | 숨김 | 선택 불가 |
| 브레이크포인트 | 편집 가능 | 기존과 동일 |

## 설계

### 접근 방식: 상태 플래그 기반 (방식 A)

기존 `TriggerForm`에 `subscriptionMode` 상태를 추가하고, 조건부 렌더링으로 구독 모드를 구현한다.

### 1. SubscriptionPicker 콜백 변경

**현재**: `(keyword: string) => void`
**변경**: `(subscription: SubscriptionSummary) => void`

```typescript
interface SubscriptionSummary {
  id: string;
  keyword: string;
  sources: string[];
  limits: { maxPerRun: number; commentsPerItem?: number };
  options: { collectTranscript?: boolean; includeComments?: boolean };
  domain?: string;
}
```

구독 목록은 기존처럼 `trpcClient.subscriptions.list.query({ status: 'active' })`로 조회한다.

### 2. TriggerForm 상태 추가

```typescript
type SubscriptionMode = {
  isActive: boolean;
  subscription: SubscriptionSummary | null;
};

const [subscriptionMode, setSubscriptionMode] = useState<SubscriptionMode>({
  isActive: false,
  subscription: null,
});
```

구독 선택 시:
1. `subscriptionMode` 설정
2. 폼 값 주입: keyword, sources, limits, options
3. 읽기전용 필드는 `disabled` 속성으로 제어

구독 모드 해제:
- 선택된 구독 옆 X 버튼으로 일반 모드 복귀
- 복귀 시 폼 값 초기화 (빈 폼으로 되돌림)

### 3. 조건부 렌더링 규칙

```
subscriptionMode.isActive === true일 때:

키워드 필드:
  - disabled
  - 값: subscription.keyword
  - 옆에 구독 이름 배지 + X 버튼 (모드 해제용)

소스 선택:
  - disabled
  - 값: subscription.sources

분석 옵션:
  - disabled
  - 개별기사/댓글: subscription.options.includeComments 반영
  - 유튜브 자막: subscription.options.collectTranscript 반영

전량 재수집:
  - hidden (렌더링하지 않음)

수집 한도 & 토큰 최적화:
  - 편집 가능
  - 기본값: subscription.limits

기간:
  - 편집 가능 (항상)

브레이크포인트:
  - 편집 가능 (항상)
```

### 4. 백엔드: trigger 뮤테이션 확장

`analysis.ts`의 `trigger` 뮤테이션에 `subscriptionId` 필드를 추가한다.

```typescript
// schema에 추가
subscriptionId: z.string().optional(),
```

구독 모드일 때:
- `forceRefetch`는 항상 `false`로 강제 (백엔드에서 보장)
- 재사용(reuse) 로직이 기존 구독 데이터를 우선 활용

### 5. UI 플로우

```
[프리셋 선택] → [상세 설정 폼]
                    ↓
              "구독에서 선택" 클릭
                    ↓
              구독 목록 Popover
                    ↓
              구독 선택 → 구독 모드 진입
                    ↓
              키워드/소스/옵션: 읽기전용 배지 표시
              기간/한도/프리셋: 편집 가능
              전량재수집: 숨김
                    ↓
              [실행] → 백엔드에 subscriptionId 전달
```

## 구현 범위

### 수정 파일

1. `apps/web/src/components/analysis/subscription-picker.tsx` — 콜백 시그니처 변경
2. `apps/web/src/components/analysis/trigger-form.tsx` — subscriptionMode 상태, 조건부 렌더링
3. `apps/web/src/server/trpc/routers/analysis.ts` — trigger 스키마에 subscriptionId 추가, forceRefetch 강제

### 새 파일

없음.

## 테스트 시나리오

1. 구독에서 선택 → 키워드가 읽기전용으로 표시되는지
2. 구독에서 선택 → 소스가 비활성화되어 구독 소스가 체크되어 있는지
3. 구독에서 선택 → 전량 재수집 체크박스가 숨겨지는지
4. 구독에서 선택 → 기간 편집 가능한지
5. 구독에서 선택 → 수집 한도 편집 가능, 기본값이 구독 설정인지
6. X 버튼 → 일반 모드로 복귀, 폼 초기화
7. 백엔드 — subscriptionId 전달 시 forceRefetch=false 강제
