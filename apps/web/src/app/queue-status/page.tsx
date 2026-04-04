'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { trpcClient } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATE_COLORS: Record<string, string> = {
  active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'waiting-children': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delayed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export default function QueueStatusPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => trpcClient.pipeline.queueStatus.query(),
    refetchInterval: 3000,
  });

  const totalActive = data?.queues.reduce((sum, q) => sum + (q.counts.active ?? 0), 0) ?? 0;
  const totalWaiting =
    data?.queues.reduce(
      (sum, q) =>
        sum +
        (q.counts.waiting ?? 0) +
        (q.counts['waiting-children'] ?? 0) +
        (q.counts.delayed ?? 0),
      0,
    ) ?? 0;

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Worker 큐 상태</h1>
          {data && (
            <div className="flex gap-2">
              {totalActive > 0 && (
                <Badge
                  variant="outline"
                  className="bg-blue-500/10 text-blue-400 border-blue-500/30"
                >
                  Active {totalActive}
                </Badge>
              )}
              {totalWaiting > 0 && (
                <Badge
                  variant="outline"
                  className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                >
                  대기 {totalWaiting}
                </Badge>
              )}
              {totalActive === 0 && totalWaiting === 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  Idle
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">3초마다 자동 갱신</p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      ) : data ? (
        <div className="space-y-6">
          {data.queues.map((queue) => (
            <div key={queue.name} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-mono font-semibold">{queue.name}</h2>
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(queue.counts)
                    .filter(([, count]) => count > 0)
                    .map(([state, count]) => (
                      <Badge
                        key={state}
                        variant="outline"
                        className={`text-xs ${STATE_COLORS[state] ?? ''}`}
                      >
                        {state}: {count}
                      </Badge>
                    ))}
                  {Object.values(queue.counts).every((c) => c === 0) && (
                    <span className="text-xs text-muted-foreground">비어있음</span>
                  )}
                </div>
              </div>

              {queue.jobs.length > 0 ? (
                <div className="space-y-1">
                  {queue.jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 text-xs py-1.5 px-2 rounded-md hover:bg-muted/50"
                    >
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${STATE_COLORS[job.state] ?? ''}`}
                      >
                        {job.state}
                      </Badge>
                      <span className="font-mono">{job.name}</span>
                      {job.dbJobId != null && (
                        <span className="text-muted-foreground">job#{job.dbJobId}</span>
                      )}
                      {job.timestamp && (
                        <span className="text-muted-foreground ml-auto">
                          {new Date(job.timestamp).toLocaleTimeString('ko-KR')}
                        </span>
                      )}
                      {job.failedReason && (
                        <span
                          className="text-red-400 truncate max-w-[300px]"
                          title={job.failedReason}
                        >
                          {job.failedReason}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">작업 없음</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
