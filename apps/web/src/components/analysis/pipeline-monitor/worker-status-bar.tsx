'use client';

import { memo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  Clock,
  Cog,
  Inbox,
  Loader2,
  Pause,
  Settings2,
  Skull,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { WorkerQueueStatus, StalledJobInfo } from './types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { WorkerManagementModal } from '@/components/admin/worker-management-modal';
import { trpcClient } from '@/lib/trpc';

const QUEUE_LABELS: Record<string, string> = {
  collectors: '수집',
  pipeline: '파이프라인',
  analysis: '분석',
};

const HEALTH_CONFIG: Record<
  string,
  { color: string; bg: string; icon: typeof Activity; label: string; ring?: string }
> = {
  healthy: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    icon: Activity,
    label: '정상',
    ring: 'ring-green-500/20',
  },
  idle: {
    color: 'text-zinc-500 dark:text-zinc-400',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    icon: Clock,
    label: '대기',
  },
  stuck: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: AlertTriangle,
    label: '적체',
    ring: 'ring-amber-500/30',
  },
  warn: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: AlertTriangle,
    label: '경고',
    ring: 'ring-amber-500/20',
  },
  down: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    icon: CircleSlash,
    label: '중단',
    ring: 'ring-red-500/30',
  },
};

function HealthDot({ health }: { health: string }) {
  const dotColor: Record<string, string> = {
    healthy: 'bg-green-500',
    idle: 'bg-zinc-400',
    stuck: 'bg-amber-500',
    warn: 'bg-amber-500',
    down: 'bg-red-500',
  };
  const isActive = health === 'healthy';

  return (
    <span className="relative flex h-2 w-2">
      {isActive && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor[health] ?? 'bg-zinc-400'} opacity-50`}
        />
      )}
      <span
        className={`relative inline-flex h-2 w-2 rounded-full ${dotColor[health] ?? 'bg-zinc-400'}`}
      />
    </span>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}시간 ${m}분`;
}

interface WorkerStatusBarProps {
  workerStatus: WorkerQueueStatus[];
  jobId?: number | null;
}

export const WorkerStatusBar = memo(function WorkerStatusBar({
  workerStatus,
  jobId,
}: WorkerStatusBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [mgmtOpen, setMgmtOpen] = useState(false);

  const anyDown = workerStatus.some((q) => q.health === 'down');
  const anyStuck = workerStatus.some((q) => q.health === 'stuck');
  const _anyPaused = workerStatus.some((q) => q.isPaused);
  const totalActive = workerStatus.reduce((s, q) => s + q.counts.active, 0);
  const totalWaiting = workerStatus.reduce((s, q) => s + q.counts.waiting, 0);
  const totalFailed = workerStatus.reduce((s, q) => s + q.counts.failed, 0);
  const allStalledJobs = workerStatus.flatMap((q) => q.stalledJobs);
  const hasStalledJobs = allStalledJobs.length > 0;
  const hasIssues = anyDown || anyStuck || hasStalledJobs || totalFailed > 0;

  return (
    <div
      className={`rounded-lg border text-xs transition-colors ${
        anyDown
          ? 'border-red-500/30 bg-red-500/5'
          : hasStalledJobs || anyStuck
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-border bg-card/50'
      }`}
    >
      {/* 메인 바 */}
      <div className="flex items-center gap-3 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cog className={`h-3.5 w-3.5 ${hasIssues ? 'animate-spin' : ''}`} />
          <span className="font-medium">워커</span>
        </div>

        {/* 큐별 상태 칩 */}
        <TooltipProvider delay={200}>
          <div className="flex items-center gap-1.5">
            {workerStatus.map((q) => {
              const cfg = HEALTH_CONFIG[q.health] ?? HEALTH_CONFIG.idle;
              const label = QUEUE_LABELS[q.queue] ?? q.queue;
              const hasStalledInQueue = q.stalledJobs.length > 0;

              return (
                <Tooltip key={q.queue}>
                  <TooltipTrigger
                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 cursor-default ${cfg.bg} ${cfg.ring ? `ring-1 ${cfg.ring}` : ''}`}
                  >
                    <HealthDot health={q.health} />
                    <span className={`font-medium ${cfg.color}`}>{label}</span>
                    <span className="text-muted-foreground tabular-nums">({q.workerCount})</span>
                    {hasStalledInQueue && <Skull className="h-3 w-3 text-amber-500" />}
                    {q.isPaused && <Pause className="h-3 w-3 text-amber-500" />}
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs max-w-[280px]">
                    <div className="space-y-1.5">
                      <div className="font-semibold">
                        {label} 큐 — {cfg.label}
                        {q.isPaused && ' (일시정지)'}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                        <span>워커</span>
                        <span className="text-right tabular-nums">{q.workerCount}개</span>
                        <span>처리 중</span>
                        <span className="text-right tabular-nums">{q.counts.active}건</span>
                        <span>대기 중</span>
                        <span className="text-right tabular-nums">{q.counts.waiting}건</span>
                        {q.counts.delayed > 0 && (
                          <>
                            <span>지연</span>
                            <span className="text-right tabular-nums">{q.counts.delayed}건</span>
                          </>
                        )}
                        {q.counts.failed > 0 && (
                          <>
                            <span className="text-red-500">실패</span>
                            <span className="text-right tabular-nums text-red-500">
                              {q.counts.failed}건
                            </span>
                          </>
                        )}
                      </div>
                      {hasStalledInQueue && (
                        <div className="border-t border-border pt-1 text-amber-600 dark:text-amber-400">
                          <Skull className="inline h-3 w-3 mr-1" />
                          {q.stalledJobs.length}개 작업 중단 의심 (10분+ 무응답)
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* 우측: 요약 수치 + 펼치기 버튼 */}
        <div className="ml-auto flex items-center gap-2 text-muted-foreground">
          {totalActive > 0 && (
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3 text-green-500" />
              <span className="tabular-nums">{totalActive}</span>
            </span>
          )}
          {totalWaiting > 0 && (
            <span className="flex items-center gap-1">
              <Inbox className="h-3 w-3 text-blue-500" />
              <span className="tabular-nums">{totalWaiting}</span>
            </span>
          )}
          {totalFailed > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span className="tabular-nums">{totalFailed}</span>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setMgmtOpen(true)}
          >
            <Settings2 className="h-3 w-3" />
            관리
          </Button>
          {hasIssues && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-muted/50 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 확장 패널 */}
      {expanded && hasIssues && (
        <WorkerDetailPanel workerStatus={workerStatus} stalledJobs={allStalledJobs} jobId={jobId} />
      )}

      <WorkerManagementModal
        open={mgmtOpen}
        onOpenChange={setMgmtOpen}
        defaultTab={allStalledJobs.length > 0 ? 'stalled' : 'queue-status'}
        focusJobId={jobId}
      />
    </div>
  );
});

function WorkerDetailPanel({
  workerStatus,
  stalledJobs,
  jobId,
}: {
  workerStatus: WorkerQueueStatus[];
  stalledJobs: StalledJobInfo[];
  jobId?: number | null;
}) {
  const forceCleanupMutation = useMutation({
    mutationFn: () => trpcClient.pipeline.forceCleanupJob.mutate({ jobId: jobId as number }),
    onSuccess: (res) => {
      toast.success(`${res.cleaned}개 고아 작업 정리 완료`);
    },
    onError: () => toast.error('정리에 실패했습니다'),
  });

  const totalFailed = workerStatus.reduce((s, q) => s + q.counts.failed, 0);
  const anyDown = workerStatus.some((q) => q.health === 'down');

  return (
    <div className="border-t border-border px-3 py-2 space-y-2">
      {/* Stalled jobs */}
      {stalledJobs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <Skull className="h-3.5 w-3.5" />
            중단 의심 작업 ({stalledJobs.length}건)
          </div>
          <div className="space-y-1">
            {stalledJobs.map((sj) => (
              <div
                key={`${sj.queue}-${sj.bullmqId}`}
                className="flex items-center justify-between rounded-md bg-amber-500/5 border border-amber-500/20 px-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {QUEUE_LABELS[sj.queue] ?? sj.queue}
                  </span>
                  <span className="font-medium">{sj.name}</span>
                  {sj.dbJobId && <span className="text-muted-foreground">Job #{sj.dbJobId}</span>}
                </div>
                <span className="text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                  {formatElapsed(sj.elapsedSeconds)}
                </span>
              </div>
            ))}
          </div>
          {jobId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              onClick={() => forceCleanupMutation.mutate()}
              disabled={forceCleanupMutation.isPending}
            >
              {forceCleanupMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              현재 Job 고아 작업 강제 정리
            </Button>
          )}
        </div>
      )}

      {/* 큐별 failed 요약 */}
      {totalFailed > 0 && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="h-3.5 w-3.5" />
          <span>
            실패 큐:{' '}
            {workerStatus
              .filter((q) => q.counts.failed > 0)
              .map((q) => `${QUEUE_LABELS[q.queue] ?? q.queue} ${q.counts.failed}건`)
              .join(', ')}
          </span>
        </div>
      )}

      {/* 워커 다운 경고 */}
      {anyDown && (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-red-600 dark:text-red-400">
          <CircleSlash className="h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-medium">워커 프로세스 다운 감지</span>
            <span className="text-muted-foreground ml-1">
              —{' '}
              {workerStatus
                .filter((q) => q.health === 'down')
                .map((q) => QUEUE_LABELS[q.queue] ?? q.queue)
                .join(', ')}{' '}
              큐에 워커 없음
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
