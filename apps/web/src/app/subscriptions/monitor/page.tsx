'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { trpcClient } from '@/lib/trpc';
import { LiveRunFeed } from '@/components/subscriptions/live-run-feed';
import { UpcomingRuns } from '@/components/subscriptions/upcoming-runs';
import { RecentRunsLog } from '@/components/subscriptions/recent-runs-log';
import { SourceRunStats } from '@/components/subscriptions/source-run-stats';

export default function MonitorPage() {
  const subsQuery = useQuery({
    queryKey: ['subscriptions', 'all'],
    queryFn: () => trpcClient.subscriptions.list.query(),
    refetchInterval: 30_000,
  });

  const runsQuery = useQuery({
    queryKey: ['subscription-runs-monitor', { sinceHours: 24 }],
    queryFn: () => trpcClient.subscriptions.runs.query({ sinceHours: 24, limit: 500 }),
    refetchInterval: 5_000,
  });

  const subscriptions = subsQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  const subscriptionMap = new Map(subscriptions.map((s) => [s.id, s.keyword]));

  const runIds = [...new Set(runs.map((r) => r.runId))];
  const breakdownQuery = useQuery({
    queryKey: ['run-item-breakdown-monitor', { runIds }],
    queryFn: () => trpcClient.subscriptions.runItemBreakdown.query({ runIds }),
    enabled: runIds.length > 0,
    refetchInterval: 15_000,
  });
  const breakdown = breakdownQuery.data;

  const running = runs.filter((r) => r.status === 'running').length;
  const now = Date.now();
  const h1Ago = now - 3600 * 1000;
  const runs1h = runs.filter((r) => new Date(r.time).getTime() >= h1Ago);
  const completed1h = runs1h.filter((r) => r.status === 'completed').length;
  const failed1h = runs1h.filter((r) => r.status === 'failed' || r.status === 'blocked').length;

  const isHealthy = failed1h === 0;

  if (subsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">수집 모니터링</h1>
        <p className="text-sm text-muted-foreground">실시간 수집 작업 상태를 확인합니다.</p>
      </div>

      {/* 실시간 상태 헤더 */}
      <div className="flex items-center gap-4 rounded-lg border px-4 py-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
          <span className="text-sm font-medium">{isHealthy ? '시스템 정상' : '경고 있음'}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            실행 중{' '}
            <Badge variant={running > 0 ? 'default' : 'outline'} className="text-xs ml-0.5">
              {running}
            </Badge>
          </span>
          <span>
            완료(1h){' '}
            <Badge variant="outline" className="text-xs ml-0.5">
              {completed1h}
            </Badge>
          </span>
          <span>
            실패(1h){' '}
            <Badge variant={failed1h > 0 ? 'destructive' : 'outline'} className="text-xs ml-0.5">
              {failed1h}
            </Badge>
          </span>
        </div>
        {running > 0 && (
          <span className="relative flex h-2 w-2 ml-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LiveRunFeed runs={runs} subscriptionMap={subscriptionMap} />
        <UpcomingRuns subscriptions={subscriptions} />
      </div>

      <RecentRunsLog runs={runs} subscriptionMap={subscriptionMap} breakdown={breakdown} />

      <SourceRunStats runs={runs} />
    </div>
  );
}
