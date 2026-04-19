'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pause, Play, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { QueueOverviewData } from './types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  const [drainTarget, setDrainTarget] = useState<string | null>(null);
  const [expandedQueues, setExpandedQueues] = useState<Set<string>>(new Set());

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

  const drainMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.drainQueue.mutate({
        queueName: queueName as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 비우기 완료`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
      setDrainTarget(null);
    },
    onError: () => {
      toast.error('큐 비우기에 실패했습니다');
      setDrainTarget(null);
    },
  });

  const removeJobMutation = useMutation({
    mutationFn: ({ bullmqId, queue }: { bullmqId: string; queue: string }) =>
      trpcClient.admin.workerMgmt.removeJob.mutate({
        bullmqId,
        queue: queue as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: () => {
      toast.success('작업 제거 완료');
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('작업 제거에 실패했습니다'),
  });

  const toggleExpand = (queueName: string) => {
    setExpandedQueues((prev) => {
      const next = new Set(prev);
      if (next.has(queueName)) next.delete(queueName);
      else next.add(queueName);
      return next;
    });
  };

  const totalActive = data.workerHealth.reduce((sum, q) => sum + q.counts.active, 0);
  const totalWaiting = data.workerHealth.reduce((sum, q) => sum + q.counts.waiting, 0);
  const totalFailed = data.workerHealth.reduce((sum, q) => sum + q.counts.failed, 0);

  const getActiveJobs = (queueName: string) => {
    const queue = data.queueStatus.queues.find((q) => q.name === queueName);
    if (!queue) return [];
    return queue.jobs.filter((j) => j.state === 'active');
  };

  const formatElapsed = (processedOn: number | null) => {
    if (!processedOn) return '';
    const seconds = Math.floor((Date.now() - processedOn) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-3">
        {data.workerHealth.map((q) => {
          const activeJobs = getActiveJobs(q.queue);
          const isExpanded = expandedQueues.has(q.queue);

          return (
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

              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
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
                      <Pause className="mr-1 h-3 w-3" /> 정지
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-red-600 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => setDrainTarget(q.queue)}
                  disabled={q.counts.waiting === 0 && q.counts.delayed === 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {activeJobs.length > 0 && (
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(q.queue)}>
                  <CollapsibleTrigger className="mt-2 flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Active jobs ({activeJobs.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 space-y-1">
                    {activeJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{job.name}</span>
                          {job.dbJobId && (
                            <span className="ml-1 text-muted-foreground">#{job.dbJobId}</span>
                          )}
                          {job.processedOn && (
                            <span className="ml-1 text-muted-foreground">
                              {formatElapsed(job.processedOn)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                          onClick={() =>
                            removeJobMutation.mutate({ bullmqId: job.id, queue: q.queue })
                          }
                          disabled={removeJobMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
        <span>
          전체: active {totalActive} · waiting {totalWaiting} · failed {totalFailed}
        </span>
      </div>

      <AlertDialog open={!!drainTarget} onOpenChange={(open) => !open && setDrainTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>큐 비우기</AlertDialogTitle>
            <AlertDialogDescription>
              {drainTarget} 큐의 모든 대기/지연 작업을 제거합니다. 현재 실행 중인 작업은 영향받지
              않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => drainTarget && drainMutation.mutate(drainTarget)}
            >
              {drainMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3 w-3" />
              )}
              비우기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
