'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { SubscriptionKpiCards } from '@/components/subscriptions/subscription-kpi-cards';
import { SubscriptionStatusBar } from '@/components/subscriptions/subscription-status-bar';
import { SubscriptionTrendChart } from '@/components/subscriptions/subscription-trend-chart';
import { SubscriptionTable } from '@/components/subscriptions/subscription-table';
import { SubscriptionAlerts } from '@/components/subscriptions/subscription-alerts';
import { SubscriptionList } from '@/components/subscriptions/subscription-list';

export default function SubscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState('all');

  const subsQuery = useQuery({
    queryKey: ['subscriptions', 'all'],
    queryFn: () => trpcClient.subscriptions.list.query(),
    refetchInterval: 30_000,
  });

  const runsQuery = useQuery({
    queryKey: ['subscription-runs', { sinceHours: 168 }],
    queryFn: () => trpcClient.subscriptions.runs.query({ sinceHours: 168, limit: 500 }),
    refetchInterval: 60_000,
  });

  const subscriptions = subsQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  if (subsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  if (subsQuery.isError) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        {subsQuery.error instanceof Error ? subsQuery.error.message : '조회 실패'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">키워드 구독</h1>
        <p className="text-sm text-muted-foreground">
          키워드를 구독하면 수집 서비스가 지정 주기로 자동 수집합니다. 분석은 대시보드에서 축적된
          데이터로 실행합니다.
        </p>
      </div>

      <SubscriptionKpiCards subscriptions={subscriptions} runs={runs} />

      <SubscriptionStatusBar
        subscriptions={subscriptions}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <SubscriptionTrendChart runs={runs} />

      <SubscriptionAlerts subscriptions={subscriptions} />

      {/* 데스크톱: 테이블 / 모바일: 기존 카드 리스트 */}
      <div className="hidden md:block">
        <SubscriptionTable subscriptions={subscriptions} runs={runs} statusFilter={statusFilter} />
      </div>
      <div className="md:hidden">
        <SubscriptionList />
      </div>
    </div>
  );
}
