'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { trpcClient } from '@/lib/trpc';
import type { QueueStatus } from '@/server/trpc/routers/subscriptions';

/**
 * 모든 수집 큐 (collect-<source>)의 waiting/active/failed 합계를 한 줄로 표시.
 * 모니터 페이지 상단 헤더에 인라인 배치. 10초 polling.
 */
export function QueueStatsBar() {
  const { data } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => trpcClient.subscriptions.queueStatus.query(),
    refetchInterval: 10_000,
  });

  if (!data) return null;

  const totals = Object.values(data as QueueStatus).reduce(
    (acc, q) => ({
      workers: acc.workers + q.workerCount,
      waiting: acc.waiting + q.counts.waiting,
      active: acc.active + q.counts.active,
      delayed: acc.delayed + q.counts.delayed,
      failed: acc.failed + q.counts.failed,
    }),
    { workers: 0, waiting: 0, active: 0, delayed: 0, failed: 0 },
  );

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
      <span className="font-medium text-foreground">큐:</span>
      <span>workers {totals.workers}</span>
      <span>waiting {totals.waiting}</span>
      <span>active {totals.active}</span>
      <span>delayed {totals.delayed}</span>
      <span>
        failed{' '}
        <Badge variant={totals.failed > 0 ? 'destructive' : 'outline'} className="text-xs ml-0.5">
          {totals.failed}
        </Badge>
      </span>
    </div>
  );
}
