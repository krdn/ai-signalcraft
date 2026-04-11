'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Wrench,
  RefreshCw,
  Loader2,
  Database,
  Cpu,
  AlertTriangle,
  Info,
  RotateCcw,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { MODULE_LABELS } from './pipeline-monitor/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trpcClient } from '@/lib/trpc';

// ─── 파이프라인 흐름 시각화 ───────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    key: 'collection',
    label: '수집',
    desc: 'Playwright / YouTube API',
    color: 'bg-blue-500',
  },
  {
    key: 'normalize',
    label: '정규화',
    desc: 'DB 저장 · 중복제거',
    color: 'bg-violet-500',
  },
  {
    key: 'analysis',
    label: 'AI 분석',
    desc: 'BullMQ → 워커 → Claude/GPT',
    color: 'bg-amber-500',
  },
  {
    key: 'report',
    label: '리포트',
    desc: 'Markdown 생성',
    color: 'bg-green-500',
  },
] as const;

function PipelineFlowDiagram({ currentStage }: { currentStage: string | null }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PIPELINE_STAGES.map((stage, i) => {
        const isActive = currentStage === stage.key;
        const isDone = PIPELINE_STAGES.findIndex((s) => s.key === currentStage) > i;
        return (
          <div key={stage.key} className="flex items-center gap-1">
            <div
              className={`flex flex-col items-center px-3 py-1.5 rounded-md border text-xs transition-all ${
                isActive
                  ? `${stage.color} text-white border-transparent font-semibold shadow-md`
                  : isDone
                    ? 'bg-muted/60 text-muted-foreground border-border line-through'
                    : 'bg-background text-muted-foreground border-border/60'
              }`}
            >
              <span className="font-medium">{stage.label}</span>
              <span className="text-[10px] opacity-70 mt-0.5">{stage.desc}</span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BullMQ 동작 원리 설명 ─────────────────────────────────────────────────

function BullMQExplainer() {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
      <div className="font-semibold text-sm flex items-center gap-1.5">
        <Cpu className="h-4 w-4 text-amber-500" />
        BullMQ 처리 원리
      </div>
      <div className="grid grid-cols-1 gap-1.5 text-muted-foreground">
        <div className="flex items-start gap-2">
          <span className="shrink-0 mt-0.5 text-[10px] font-mono bg-muted px-1 rounded">wait</span>
          <span>큐에 추가됨. 워커가 여유 있을 때 꺼내감</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 mt-0.5 text-[10px] font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1 rounded">
            active
          </span>
          <span>워커가 처리 중. lock(10분) 내 갱신 필요</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 mt-0.5 text-[10px] font-mono bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-1 rounded">
            stalled
          </span>
          <span>
            워커가 lock 갱신 실패 → 5분 후 stall 체크에서 감지. maxStalledCount(2) 초과 시 failed
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="shrink-0 mt-0.5 text-[10px] font-mono bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1 rounded">
            completed
          </span>
          <span>정상 완료. 1시간 후 자동 삭제</span>
        </div>
      </div>
      <div className="border-t pt-2 text-muted-foreground">
        <span className="font-medium text-foreground">주요 원인:</span> 워커 프로세스 종료 / AI API
        타임아웃 / lock 갱신 실패 → DB는 running, BullMQ는 없음 (고아 상태)
      </div>
    </div>
  );
}

// ─── 문제 배지 ──────────────────────────────────────────────────────────────

const ISSUE_ICON = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: CheckCircle2,
};
const ISSUE_CLASS = {
  error: 'text-destructive bg-destructive/10 border-destructive/30',
  warning:
    'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-500/30',
  info: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-500/30',
};

function IssueCard({
  issue,
}: {
  issue: { type: string; message: string; severity: 'error' | 'warning' | 'info' };
}) {
  const Icon = ISSUE_ICON[issue.severity];
  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-2.5 text-xs ${ISSUE_CLASS[issue.severity]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span>{issue.message}</span>
    </div>
  );
}

// ─── 모듈 상태 행 ──────────────────────────────────────────────────────────

const MODULE_STATUS_CLASS: Record<string, string> = {
  completed: 'text-green-600 dark:text-green-400',
  running: 'text-amber-600 dark:text-amber-400',
  pending: 'text-muted-foreground',
  failed: 'text-destructive',
};

// ─── 메인 모달 내용 ────────────────────────────────────────────────────────

function DiagnosticContent({ jobId }: { jobId: number }) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['job-diagnostic', jobId],
    queryFn: () => trpcClient.pipeline.jobDiagnostic.query({ jobId }),
    refetchInterval: false,
    staleTime: 0,
  });

  const retryMutation = useMutation({
    mutationFn: () =>
      trpcClient.analysis.retryAnalysis.mutate({
        jobId,
        retryModules:
          data?.dbModules
            .filter(
              (m) => m.status === 'running' || m.status === 'failed' || m.status === 'pending',
            )
            .map((m) => m.module) ?? [],
      }),
    onSuccess: () => {
      toast.success('재실행 큐에 추가됐습니다');
      queryClient.invalidateQueries({ queryKey: ['job-diagnostic', jobId] });
    },
    onError: () => toast.error('재실행 실패'),
  });

  const cleanupMutation = useMutation({
    mutationFn: () => trpcClient.pipeline.forceCleanupJob.mutate({ jobId }),
    onSuccess: (res) => {
      toast.success(`고아 job ${res.cleaned}개 제거됨`);
      refetch();
    },
    onError: () => toast.error('정리 실패'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.dbJob) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        job 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const { dbJob, dbModules, bullmqJobs, issues } = data;
  const hasErrors = issues.some((i) => i.severity === 'error');
  const hasWarnings = issues.some((i) => i.severity === 'warning');

  // 현재 파이프라인 단계 계산 (BullMQ 큐 이름 기준)
  const activeQueues = bullmqJobs.filter((j) => j.state === 'active').map((j) => j.queue);
  const pipelineStageKey = activeQueues.includes('collectors')
    ? 'collection'
    : activeQueues.includes('pipeline')
      ? 'normalize'
      : activeQueues.includes('analysis')
        ? 'analysis'
        : dbJob.status === 'running'
          ? 'analysis'
          : null;

  // 재실행 가능한 모듈
  const retriableModules = dbModules.filter(
    (m) => m.status === 'running' || m.status === 'failed' || m.status === 'pending',
  );
  const hasOrphanedRunning =
    dbModules.some((m) => m.status === 'running') && !bullmqJobs.some((j) => j.state === 'active');

  return (
    <div className="space-y-4 text-sm">
      {/* 파이프라인 흐름 */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          파이프라인 흐름
        </div>
        <PipelineFlowDiagram currentStage={pipelineStageKey} />
      </div>

      {/* BullMQ 설명 */}
      <BullMQExplainer />

      {/* 감지된 문제 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            진단 결과
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            새로고침
          </Button>
        </div>
        {issues.map((issue, i) => (
          <IssueCard key={i} issue={issue} />
        ))}
      </div>

      {/* DB 상태 vs BullMQ 상태 비교 */}
      <div className="grid grid-cols-2 gap-3">
        {/* DB 모듈 상태 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Database className="h-3 w-3" />
            DB 모듈 상태
          </div>
          <div className="rounded-md border divide-y">
            {dbModules.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">분석 결과 없음</div>
            ) : (
              dbModules.map((m) => (
                <div key={m.module} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs">{MODULE_LABELS[m.module] ?? m.module}</span>
                  <span
                    className={`text-[11px] font-medium ${MODULE_STATUS_CLASS[m.status] ?? ''}`}
                  >
                    {m.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* BullMQ 큐 상태 */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Cpu className="h-3 w-3" />
            BullMQ 큐 상태
          </div>
          <div className="rounded-md border divide-y">
            {bullmqJobs.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">큐에 job 없음</div>
            ) : (
              bullmqJobs.map((j) => (
                <div key={j.id} className="px-3 py-1.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">{j.queue}</span>
                    <Badge
                      variant={
                        j.state === 'active'
                          ? 'secondary'
                          : j.state === 'failed'
                            ? 'destructive'
                            : 'outline'
                      }
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {j.isStalled ? '⚠ stalled' : j.state}
                    </Badge>
                  </div>
                  {j.elapsedMs != null && (
                    <div className="text-[10px] text-muted-foreground">
                      경과: {Math.round(j.elapsedMs / 1000)}초
                    </div>
                  )}
                  {j.failedReason && (
                    <div className="text-[10px] text-destructive truncate">{j.failedReason}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DB job 기본 정보 */}
      <div className="rounded-md border p-3 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Job ID</span>
          <span className="font-mono font-medium">#{dbJob.id}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">키워드</span>
          <span className="font-medium">{dbJob.keyword}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">상태</span>
          <Badge variant="outline" className="text-[11px] h-4 px-1.5">
            {dbJob.status}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">도메인</span>
          <span>{dbJob.domain}</span>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2 pt-1 border-t">
        {/* 고아 active job 강제 제거 */}
        {(hasErrors || bullmqJobs.some((j) => j.state === 'active')) && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
          >
            {cleanupMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            고아 job 정리
          </Button>
        )}

        {/* 실패/stuck 모듈 재실행 */}
        {retriableModules.length > 0 && (
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending || (hasOrphanedRunning && !cleanupMutation.isSuccess)}
          >
            {retryMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            {retriableModules.length}개 모듈 재실행
          </Button>
        )}

        {hasOrphanedRunning && !cleanupMutation.isSuccess && (
          <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            고아 job 정리 후 재실행 권장
          </div>
        )}

        {!hasErrors && !hasWarnings && retriableModules.length === 0 && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" />
            조치 불필요
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 외부 노출 컴포넌트 ────────────────────────────────────────────────────

interface JobDiagnosticModalProps {
  jobId: number;
  keyword: string;
}

export function JobDiagnosticModal({ jobId, keyword }: JobDiagnosticModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
        title="진단 / 상태 확인"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
      >
        <Wrench className="h-3 w-3" />
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Job #{jobId} 진단
              <span className="text-muted-foreground font-normal text-sm">— {keyword}</span>
            </DialogTitle>
          </DialogHeader>
          {open && <DiagnosticContent jobId={jobId} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
