'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { trpcClient } from '@/lib/trpc';
import { SourceHealthCard } from '@/components/subscriptions/source-health-card';
import { ErrorTimelineChart } from '@/components/subscriptions/error-timeline-chart';
import { BlockingAlerts } from '@/components/subscriptions/blocking-alerts';
import { cn } from '@/lib/utils';

const ALL_SOURCES = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;

export default function HealthPage() {
  const healthQuery = useQuery({
    queryKey: ['source-health', { sinceHours: 24 }],
    queryFn: () => trpcClient.subscriptions.sourceHealth.query({ sinceHours: 24 }),
    refetchInterval: 60_000,
  });

  const timelineQuery = useQuery({
    queryKey: ['error-timeline', { days: 7 }],
    queryFn: () => trpcClient.subscriptions.errorTimeline.query({ days: 7 }),
    refetchInterval: 300_000,
  });

  const runs = healthQuery.data?.runs ?? [];
  const errors = healthQuery.data?.errors ?? [];
  const timelineEntries = timelineQuery.data?.entries ?? [];

  const totalRuns = runs.reduce((s, r) => s + r.total, 0);
  const totalCompleted = runs.reduce((s, r) => s + r.completed, 0);
  const score = totalRuns > 0 ? Math.round((totalCompleted / totalRuns) * 100) : 100;

  if (healthQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  if (healthQuery.isError) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        {healthQuery.error instanceof Error
          ? healthQuery.error.message
          : '시스템 건강 정보를 가져올 수 없습니다'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">시스템 건강</h1>
        <p className="text-sm text-muted-foreground">수집 인프라 전반의 건강 상태를 점검합니다.</p>
      </div>

      {/* 전체 건강 배너 */}
      <Card
        className={cn(
          'border-t-2',
          score >= 90
            ? 'border-t-emerald-500'
            : score >= 70
              ? 'border-t-amber-500'
              : 'border-t-red-500',
        )}
      >
        <CardContent className="p-6 flex items-center gap-6">
          <div
            className={cn(
              'flex items-center justify-center h-16 w-16 rounded-full text-2xl font-bold',
              score >= 90
                ? 'bg-emerald-100 text-emerald-700'
                : score >= 70
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700',
            )}
          >
            {score}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-semibold">
                {score >= 90 ? '시스템 건강' : score >= 70 ? '경고 있음' : '주의 필요'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              최근 24시간 기준 · 전체 실행 {totalRuns}회 · 성공 {totalCompleted}회
            </p>
          </div>
        </CardContent>
      </Card>

      <BlockingAlerts runs={runs} />

      {/* 소스별 건강 카드 */}
      <div>
        <h3 className="text-sm font-medium mb-2">소스별 건강 상태</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {ALL_SOURCES.map((source) => (
            <SourceHealthCard
              key={source}
              source={source}
              run={runs.find((r) => r.source === source)}
              errors={errors}
            />
          ))}
        </div>
      </div>

      <ErrorTimelineChart entries={timelineEntries} />
    </div>
  );
}
