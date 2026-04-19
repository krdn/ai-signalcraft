'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, RotateCcw, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

interface FailedJobsTabProps {
  failedJobs: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    failedReason: string | null;
    timestamp: number | null;
    finishedOn: number | null;
  }>;
  onRefresh: () => void;
}

const QUEUE_FILTERS = ['all', 'collectors', 'pipeline', 'analysis'] as const;

export function FailedJobsTab({ failedJobs, onRefresh }: FailedJobsTabProps) {
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const qc = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: ({ bullmqId, queue }: { bullmqId: string; queue: string }) =>
      trpcClient.admin.workerMgmt.retryFailedJob.mutate({
        bullmqId,
        queue: queue as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: () => {
      toast.success('재시도 완료');
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('재시도에 실패했습니다'),
  });

  const removeMutation = useMutation({
    mutationFn: (jobs: Array<{ bullmqId: string; queue: string }>) =>
      trpcClient.admin.workerMgmt.removeFailedJobs.mutate({
        jobs: jobs.map((j) => ({
          bullmqId: j.bullmqId,
          queue: j.queue as 'collectors' | 'pipeline' | 'analysis',
        })),
      }),
    onSuccess: (res) => {
      toast.success(`${res.removed}개 작업 삭제 완료`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  });

  const filtered =
    queueFilter === 'all' ? failedJobs : failedJobs.filter((j) => j.queue === queueFilter);

  const queueCounts = failedJobs.reduce(
    (acc, j) => {
      acc[j.queue] = (acc[j.queue] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const formatTime = (ts: number | null) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return `${Math.floor(diff / 3600)}시간 전`;
  };

  if (failedJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Info className="mb-2 h-8 w-8" />
        <p className="text-sm">실패한 작업이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">큐:</span>
          {QUEUE_FILTERS.map((f) => {
            const count = f === 'all' ? failedJobs.length : (queueCounts[f] ?? 0);
            if (f !== 'all' && count === 0) return null;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setQueueFilter(f)}
                className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                  queueFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all' ? '전체' : f} ({count})
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() =>
            removeMutation.mutate(filtered.map((j) => ({ bullmqId: j.bullmqId, queue: j.queue })))
          }
          disabled={removeMutation.isPending}
        >
          {removeMutation.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3 w-3" />
          )}
          전체 삭제
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((job) => (
          <div
            key={`${job.queue}-${job.bullmqId}`}
            className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3"
          >
            <div className="mr-3 min-w-0 flex-1">
              <div className="text-sm font-medium">{job.name}</div>
              <div className="text-xs text-muted-foreground">
                {job.queue} · {formatTime(job.finishedOn || job.timestamp)}
              </div>
              {job.failedReason && (
                <div className="mt-1 truncate text-xs text-red-500">{job.failedReason}</div>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => retryMutation.mutate({ bullmqId: job.bullmqId, queue: job.queue })}
                disabled={retryMutation.isPending}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                재시도
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  removeMutation.mutate([{ bullmqId: job.bullmqId, queue: job.queue }])
                }
                disabled={removeMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
