'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pause, Play } from 'lucide-react';
import type { QueueOverviewData } from './types';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

const HEALTH_COLOR: Record<string, string> = {
  healthy: 'text-green-600',
  idle: 'text-muted-foreground',
  stuck: 'text-amber-600',
  warn: 'text-amber-600',
  down: 'text-red-600',
};

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-green-500',
  idle: 'bg-zinc-400',
  stuck: 'bg-amber-500',
  warn: 'bg-amber-500',
  down: 'bg-red-500',
};

interface QueueStatusTabProps {
  data: QueueOverviewData;
  onRefresh: () => void;
}

export function QueueStatusTab({ data, onRefresh }: QueueStatusTabProps) {
  const qc = useQueryClient();

  const pauseMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.pauseQueue.mutate({
        queueName: queueName as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 일시정지됨`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('큐 일시정지에 실패했습니다'),
  });

  const resumeMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.resumeQueue.mutate({
        queueName: queueName as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 재개됨`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('큐 재개에 실패했습니다'),
  });

  const totalActive = data.workerHealth.reduce((sum, q) => sum + q.counts.active, 0);
  const totalWaiting = data.workerHealth.reduce((sum, q) => sum + q.counts.waiting, 0);
  const totalFailed = data.workerHealth.reduce((sum, q) => sum + q.counts.failed, 0);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-3">
        {data.workerHealth.map((q) => (
          <div
            key={q.queue}
            className={`rounded-lg border p-4 ${
              q.health === 'down' || q.health === 'warn' ? 'border-amber-500/30' : 'border-border'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[q.health]}`} />
                <span className="text-sm font-medium">{q.queue}</span>
              </div>
              <span className={`text-xs ${HEALTH_COLOR[q.health]}`}>{q.health}</span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className="font-medium">{q.counts.active}</div>
                <div className="text-muted-foreground">active</div>
              </div>
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className="font-medium">{q.counts.waiting}</div>
                <div className="text-muted-foreground">waiting</div>
              </div>
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className="font-medium">{q.counts.delayed}</div>
                <div className="text-muted-foreground">delayed</div>
              </div>
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className={`font-medium ${q.counts.failed > 0 ? 'text-red-500' : ''}`}>
                  {q.counts.failed}
                </div>
                <div className="text-muted-foreground">failed</div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() =>
                q.isPaused ? resumeMutation.mutate(q.queue) : pauseMutation.mutate(q.queue)
              }
              disabled={pauseMutation.isPending || resumeMutation.isPending}
            >
              {q.isPaused ? (
                <>
                  <Play className="mr-1 h-3 w-3" /> 재개
                </>
              ) : (
                <>
                  <Pause className="mr-1 h-3 w-3" /> 일시정지
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-between rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
        <span>
          전체: active {totalActive} · waiting {totalWaiting} · failed {totalFailed}
        </span>
      </div>
    </div>
  );
}
