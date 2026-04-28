'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { SubscriptionKpiCards } from '@/components/subscriptions/subscription-kpi-cards';
import { SubscriptionStatusBar } from '@/components/subscriptions/subscription-status-bar';
import { SubscriptionTrendChart } from '@/components/subscriptions/subscription-trend-chart';
import { SubscriptionTable } from '@/components/subscriptions/subscription-table';
import { SubscriptionAlerts } from '@/components/subscriptions/subscription-alerts';
import { SubscriptionList } from '@/components/subscriptions/subscription-list';

/**
 * SUBS-004: 영역별 스켈레톤 — 단일 spinner 대신 KPI/차트/테이블 모양에 맞는 박스를 표시해
 * CLS와 인지 응답성을 개선.
 */
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-100 p-4 shadow-sm border-t-2 border-t-slate-200"
        >
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

function StatusBarSkeleton() {
  return (
    <div
      className="flex items-center gap-4 rounded-lg border px-4 py-2.5"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="h-[240px] flex items-end gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${30 + ((i * 17) % 70)}%` }} />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border" aria-busy="true" aria-live="polite">
      <div className="p-3 border-b">
        <Skeleton className="h-7 w-48" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border-b last:border-b-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

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

  // 24h 내 runId만 breakdown 대상(테이블이 24h 기준이므로 범위 일치)
  const runIds24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const ids = new Set<string>();
    for (const r of runs) {
      if (new Date(r.time).getTime() >= cutoff) ids.add(r.runId);
    }
    return [...ids];
  }, [runs]);

  const breakdownQuery = useQuery({
    queryKey: ['run-item-breakdown', { runIds: runIds24h }],
    queryFn: () => trpcClient.subscriptions.runItemBreakdown.query({ runIds: runIds24h }),
    enabled: runIds24h.length > 0,
    refetchInterval: 60_000,
  });
  const breakdown = breakdownQuery.data ?? [];

  // SUBS-004: 단일 isLoading 분기로 본문 전체를 비우지 않고, 각 영역이 자체 스켈레톤을 노출.
  // subsQuery 에러는 페이지 레벨에서 표시 (runs/breakdown 실패는 영역 단위로 흡수).
  if (subsQuery.isError) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        {subsQuery.error instanceof Error ? subsQuery.error.message : '조회 실패'}
      </div>
    );
  }

  const isSubsLoading = subsQuery.isLoading;
  const isRunsLoading = runsQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">키워드 구독</h1>
        <p className="text-sm text-muted-foreground">
          키워드를 구독하면 수집 서비스가 지정 주기로 자동 수집합니다. 분석은 대시보드에서 축적된
          데이터로 실행합니다.
        </p>
      </div>

      {isSubsLoading || isRunsLoading ? (
        <KpiSkeleton />
      ) : (
        <SubscriptionKpiCards subscriptions={subscriptions} runs={runs} />
      )}

      {isSubsLoading ? (
        <StatusBarSkeleton />
      ) : (
        <SubscriptionStatusBar
          subscriptions={subscriptions}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      )}

      {isRunsLoading ? <ChartSkeleton /> : <SubscriptionTrendChart runs={runs} />}

      {isSubsLoading ? null : <SubscriptionAlerts subscriptions={subscriptions} />}

      {/* 데스크톱: 테이블 / 모바일: 기존 카드 리스트 */}
      <div className="hidden md:block">
        {isSubsLoading || isRunsLoading ? (
          <TableSkeleton />
        ) : (
          <SubscriptionTable
            subscriptions={subscriptions}
            runs={runs}
            breakdown={breakdown}
            statusFilter={statusFilter}
          />
        )}
      </div>
      <div className="md:hidden">{isSubsLoading ? <TableSkeleton /> : <SubscriptionList />}</div>
    </div>
  );
}
