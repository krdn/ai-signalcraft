'use client';

import { trpcClient } from '@/lib/trpc';

// tRPC 응답 shape 직접 추론 — schema drift 시 컴파일 에러로 조기 발견
type DemoQuotaInfo = NonNullable<Awaited<ReturnType<typeof trpcClient.demoAuth.getQuota.query>>>;

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
