'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const STATE_COLORS: Record<string, string> = {
  active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'waiting-children': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delayed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function QueueStatus() {
  const [open, setOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => trpcClient.pipeline.queueStatus.query(),
    refetchInterval: open ? 3000 : false,
    enabled: open,
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
    <div className="rounded-xl border border-dashed border-border bg-card text-card-foreground">
      <button
        type="button"
        className="w-full cursor-pointer py-2 px-4 hover:bg-muted/50 transition-colors rounded-xl flex items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Worker 큐 상태</span>
          {open && data && (
            <>
              {totalActive > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30"
                >
                  Active {totalActive}
                </Badge>
              )}
              {totalWaiting > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                >
                  대기 {totalWaiting}
                </Badge>
              )}
              {totalActive === 0 && totalWaiting === 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Idle
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {open && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                refetch();
              }}
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">로딩 중...</p>
          ) : data ? (
            <div className="space-y-3">
              {data.queues.map((queue) => (
                <div key={queue.name} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium">{queue.name}</span>
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(queue.counts)
                        .filter(([, count]) => count > 0)
                        .map(([state, count]) => (
                          <Badge
                            key={state}
                            variant="outline"
                            className={`text-[10px] px-1 py-0 ${STATE_COLORS[state] ?? ''}`}
                          >
                            {state}: {count}
                          </Badge>
                        ))}
                      {Object.values(queue.counts).every((c) => c === 0) && (
                        <span className="text-[10px] text-muted-foreground">비어있음</span>
                      )}
                    </div>
                  </div>
                  {queue.jobs.length > 0 && (
                    <div className="ml-4 space-y-0.5">
                      {queue.jobs.slice(0, 10).map((job) => (
                        <div key={job.id} className="flex items-center gap-2 text-[11px]">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 ${STATE_COLORS[job.state] ?? ''}`}
                          >
                            {job.state}
                          </Badge>
                          <span className="font-mono text-muted-foreground">{job.name}</span>
                          {job.dbJobId && (
                            <span className="text-muted-foreground">job#{job.dbJobId}</span>
                          )}
                          {job.failedReason && (
                            <span
                              className="text-red-400 truncate max-w-[200px]"
                              title={job.failedReason}
                            >
                              {job.failedReason}
                            </span>
                          )}
                        </div>
                      ))}
                      {queue.jobs.length > 10 && (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          +{queue.jobs.length - 10}개 더...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
