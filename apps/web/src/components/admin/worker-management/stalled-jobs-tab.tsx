'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

interface StalledJobsTabProps {
  stalledJobs: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    elapsedSeconds: number;
  }>;
  onRefresh: () => void;
}

export function StalledJobsTab({ stalledJobs, onRefresh }: StalledJobsTabProps) {
  const qc = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (jobs: Array<{ bullmqId: string; queue: string }>) =>
      trpcClient.admin.workerMgmt.removeStalledJobs.mutate({
        jobs: jobs.map((j) => ({
          bullmqId: j.bullmqId,
          queue: j.queue as 'collectors' | 'pipeline' | 'analysis',
        })),
      }),
    onSuccess: (res) => {
      toast.success(`${res.removed}개 stalled 작업 정리 완료`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('정리에 실패했습니다'),
  });

  const formatElapsed = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  };

  if (stalledJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Info className="mb-2 h-8 w-8" />
        <p className="text-sm">중단 의심 작업이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          {stalledJobs.length}개 중단 의심 작업
        </span>
        <Button
          variant="destructive"
          size="sm"
          className="text-xs"
          onClick={() =>
            removeMutation.mutate(
              stalledJobs.map((j) => ({ bullmqId: j.bullmqId, queue: j.queue })),
            )
          }
          disabled={removeMutation.isPending}
        >
          {removeMutation.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3 w-3" />
          )}
          전체 정리
        </Button>
      </div>

      <div className="space-y-2">
        {stalledJobs.map((job) => (
          <div
            key={`${job.queue}-${job.bullmqId}`}
            className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">{job.name}</div>
              <div className="text-xs text-muted-foreground">
                {job.queue} · {job.dbJobId ? `Job #${job.dbJobId}` : 'N/A'} ·{' '}
                {formatElapsed(job.elapsedSeconds)} 경과
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-red-500/30 text-red-600 hover:bg-red-500/10"
              onClick={() => removeMutation.mutate([{ bullmqId: job.bullmqId, queue: job.queue }])}
              disabled={removeMutation.isPending}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              제거
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        10분 이상 응답 없는 active job을 표시합니다. lock 만료 후 자동 실패 처리되지만, 즉시 정리할
        수도 있습니다.
      </div>
    </div>
  );
}
