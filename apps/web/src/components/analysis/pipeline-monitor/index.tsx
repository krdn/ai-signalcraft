'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
// AlertDialogTrigger: Base UI 기반으로 asChild 미지원 — className 직접 적용
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Square,
  Pause,
  Play,
  SkipForward,
  DollarSign,
  Ban,
  Heart,
  Zap,
  Brain,
} from 'lucide-react';
import { PipelineHeader } from './pipeline-header';
import { LiveStatsBar } from './live-stats-bar';
import { StageFlow } from './stage-flow';
import { CollectionLanes } from './collection-lanes';
import { AnalysisModuleGrid } from './analysis-module-grid';
import { LiveEventFeed } from './live-event-feed';
import { MODULE_LABELS } from './constants';
import { PulseRing } from './pulse-ring';
import { AnimatedNumber } from './animated-number';
import type { PipelineStatusData, ItemAnalysisData } from './types';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trpcClient } from '@/lib/trpc';
import { usePipelineStatus } from '@/hooks/use-pipeline-status';

interface PipelineMonitorProps {
  jobId: number | null;
  onComplete?: () => void;
  onRetry?: () => void;
}

export function PipelineMonitor({ jobId, onComplete, onRetry }: PipelineMonitorProps) {
  const { data, isLoading } = usePipelineStatus(jobId);

  // 완료 시 toast + 결과 전환
  const prevDoneRef = useRef(false);
  useEffect(() => {
    if (!data) return;

    const analysisAllDone =
      data.analysisModulesDetailed?.length > 0 &&
      !data.analysisModulesDetailed.some(
        (m: { status: string }) => m.status === 'running' || m.status === 'pending',
      );
    const isFullyComplete = data.hasReport && analysisAllDone;
    const wasDone = prevDoneRef.current;
    prevDoneRef.current = !!isFullyComplete;

    if (!wasDone && isFullyComplete) {
      toast.success('분석이 완료되었습니다');
      onComplete?.();
    }
    if (data.status === 'cancelled' && !wasDone) {
      prevDoneRef.current = true;
      toast.info('파이프라인이 중지되었습니다');
    }
  }, [data?.status, data?.hasReport, data?.analysisModulesDetailed, onComplete]);

  if (!jobId) return null;

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-3xl mt-4">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const statusData: PipelineStatusData = {
    ...data,
    costLimitUsd: data.costLimitUsd ?? null,
    skippedModules: data.skippedModules ?? [],
    overallProgress: data.overallProgress ?? 0,
    tokenUsage: data.tokenUsage ?? {
      total: { input: 0, output: 0 },
      byModule: [],
      estimatedCostUsd: 0,
    },
    timeline: data.timeline ?? {
      jobCreatedAt: new Date().toISOString(),
      jobUpdatedAt: new Date().toISOString(),
      analysisStartedAt: null,
      analysisCompletedAt: null,
      reportCompletedAt: null,
    },
    analysisModulesDetailed: data.analysisModulesDetailed ?? [],
    events: data.events ?? [],
  };

  const hasFailed = data.status === 'failed';
  const isCancelled = data.status === 'cancelled';
  const isPaused = data.status === 'paused';
  const isRunning = data.status === 'running' || data.status === 'pending';
  const isAnalysisRunning = data.pipelineStages?.analysis?.status === 'running';
  const isInProgress =
    isRunning || isPaused || isAnalysisRunning || data.pipelineStages?.report?.status === 'running';

  // 수집 합계 (본문/댓글 분리)
  const sourceValues = Object.values(data.sourceDetails ?? {}) as Array<{
    articles?: number;
    comments?: number;
    videos?: number;
    posts?: number;
  }>;
  const totalArticles = sourceValues.reduce(
    (s, d) => s + (d.articles ?? 0) + (d.videos ?? 0) + (d.posts ?? 0),
    0,
  );
  const totalComments = sourceValues.reduce((s, d) => s + (d.comments ?? 0), 0);

  return (
    <Card className="mx-auto max-w-3xl mt-4">
      <CardContent className="pt-5 space-y-5">
        {/* 헤더: 키워드 + 상태 + 진행률 바 */}
        <PipelineHeader
          keyword={data.keyword}
          status={data.status}
          overallProgress={statusData.overallProgress}
          elapsedSeconds={data.elapsedSeconds ?? 0}
          isInProgress={isInProgress}
          isPaused={isPaused}
          jobId={jobId}
        />

        {/* 실시간 통계 5열 */}
        <LiveStatsBar
          totalArticles={totalArticles}
          totalComments={totalComments}
          completedModules={statusData.analysisModuleCount?.completed ?? 0}
          totalModules={statusData.analysisModuleCount?.total ?? 0}
          tokenUsage={statusData.tokenUsage}
          elapsedSeconds={data.elapsedSeconds ?? 0}
        />

        {/* 파이프라인 4단계 플로우 */}
        <StageFlow
          stages={data.pipelineStages ?? {}}
          timeline={statusData.timeline}
          elapsedSeconds={data.elapsedSeconds ?? 0}
        />

        {/* 제어 버튼 */}
        {isInProgress && jobId && (
          <PipelineControls
            jobId={jobId}
            status={data.status}
            isPaused={isPaused}
            skippedModules={statusData.skippedModules}
            costLimitUsd={statusData.costLimitUsd}
            currentCost={statusData.tokenUsage.estimatedCostUsd}
          />
        )}

        {/* 수집 현황 (수영 레인) */}
        <CollectionLanes
          sourceDetails={data.sourceDetails ?? {}}
          errorDetails={data.errorDetails}
          elapsedSeconds={data.elapsedSeconds ?? 0}
        />

        {/* 개별 감정 분석 진행 */}
        {data.itemAnalysis && data.itemAnalysis.status !== 'skipped' && (
          <ItemAnalysisProgress
            data={data.itemAnalysis}
            stageStatus={data.pipelineStages?.['item-analysis']?.status ?? 'pending'}
          />
        )}

        {/* 분석 모듈 DAG 그리드 */}
        <AnalysisModuleGrid
          modules={statusData.analysisModulesDetailed}
          moduleCount={statusData.analysisModuleCount ?? { total: 0, completed: 0 }}
          tokenUsage={statusData.tokenUsage}
          jobId={jobId}
          pipelineStatus={data.status}
        />

        {/* 라이브 이벤트 타임라인 */}
        <LiveEventFeed events={statusData.events} />

        {/* 완료 상태 — 리포트 생성 + 모든 분석 모듈 완료 시에만 표시 */}
        {data.hasReport &&
          !data.analysisModulesDetailed?.some(
            (m: { status: string }) => m.status === 'running' || m.status === 'pending',
          ) && (
            <div className="flex items-center justify-between rounded-md bg-green-50 dark:bg-green-950/30 border border-green-500/30 p-3">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>분석이 완료되었습니다. 결과를 확인하세요.</span>
              </div>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => onComplete?.()}>
                결과 보기
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}

        {/* 취소 상태 */}
        {isCancelled && (
          <div className="flex items-center justify-between rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 p-3">
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Ban className="h-4 w-4" />
              <span>
                파이프라인이 중지되었습니다.{' '}
                {data.hasReport ? '부분 결과를 확인할 수 있습니다.' : ''}
              </span>
            </div>
            {data.hasReport && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => onComplete?.()}>
                부분 결과 보기
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* 에러 상태 + 재시도 버튼 */}
        {hasFailed && (
          <div className="flex items-center justify-between rounded-md bg-destructive/10 p-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>수집 중 오류가 발생했습니다.</span>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                다시 시도
              </Button>
            )}
          </div>
        )}

        {/* partial_failure 상태 */}
        {data.status === 'partial_failure' && (
          <div className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 p-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span>일부 소스에서 수집이 실패했지만 분석은 계속 진행됩니다.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 파이프라인 제어 버튼 영역
function PipelineControls({
  jobId,
  status,
  isPaused,
  skippedModules,
  costLimitUsd,
  currentCost,
}: {
  jobId: number;
  status: string;
  isPaused: boolean;
  skippedModules: string[];
  costLimitUsd: number | null;
  currentCost: number;
}) {
  const [showSkip, setShowSkip] = useState(false);
  const [showCostLimit, setShowCostLimit] = useState(false);
  const [costInput, setCostInput] = useState(costLimitUsd?.toString() ?? '');
  const [localSkipped, setLocalSkipped] = useState<string[]>(skippedModules);

  const cancelMutation = useMutation({
    mutationFn: () => trpcClient.pipeline.cancel.mutate({ jobId }),
    onSuccess: (res) => toast[res.cancelled ? 'success' : 'info'](res.message),
    onError: () => toast.error('중지에 실패했습니다'),
  });

  const pauseMutation = useMutation({
    mutationFn: () => trpcClient.pipeline.pause.mutate({ jobId }),
    onSuccess: (res) => toast[res.paused ? 'success' : 'info'](res.message),
    onError: () => toast.error('일시정지에 실패했습니다'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => trpcClient.pipeline.resume.mutate({ jobId }),
    onSuccess: (res) => toast[res.resumed ? 'success' : 'info'](res.message),
    onError: () => toast.error('재개에 실패했습니다'),
  });

  const skipMutation = useMutation({
    mutationFn: (modules: string[]) => trpcClient.pipeline.skipModules.mutate({ jobId, modules }),
    onSuccess: (res) => toast.success(res.message),
    onError: () => toast.error('모듈 스킵 설정에 실패했습니다'),
  });

  const costLimitMutation = useMutation({
    mutationFn: (limitUsd: number | null) =>
      trpcClient.pipeline.setCostLimit.mutate({ jobId, limitUsd }),
    onSuccess: (res) => {
      toast.success(res.message);
      setShowCostLimit(false);
    },
    onError: () => toast.error('비용 한도 설정에 실패했습니다'),
  });

  const isPending = cancelMutation.isPending || pauseMutation.isPending || resumeMutation.isPending;

  // 모든 분석 모듈 목록
  const ALL_MODULES = [
    'macro-view',
    'segmentation',
    'sentiment-framing',
    'message-impact',
    'risk-map',
    'opportunity',
    'strategy',
    'final-summary',
    'approval-rating',
    'frame-war',
    'crisis-scenario',
    'win-simulation',
  ];

  const toggleSkip = (mod: string) => {
    setLocalSkipped((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  };

  return (
    <div className="space-y-3">
      {/* 메인 제어 버튼 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 중지 버튼 (확인 다이얼로그 포함) */}
        <AlertDialog>
          <AlertDialogTrigger
            className="inline-flex items-center justify-center gap-1 rounded-md bg-destructive px-2.5 text-xs font-medium text-destructive-foreground shadow-xs hover:bg-destructive/90 h-7 disabled:opacity-50 disabled:pointer-events-none"
            disabled={isPending}
          >
            <Square className="h-3 w-3" />
            중지
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>파이프라인을 중지하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                진행 중인 분석이 중단됩니다. 이미 완료된 결과는 보존됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                중지하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 일시정지/재개 */}
        {isPaused ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => resumeMutation.mutate()}
            disabled={isPending}
          >
            {resumeMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            재개
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => pauseMutation.mutate()}
            disabled={isPending || status !== 'running'}
          >
            {pauseMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Pause className="h-3 w-3" />
            )}
            일시정지
          </Button>
        )}

        {/* 모듈 스킵 토글 */}
        <Button
          variant={showSkip ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            setShowSkip(!showSkip);
            setShowCostLimit(false);
          }}
        >
          <SkipForward className="h-3 w-3" />
          모듈 스킵
        </Button>

        {/* 비용 한도 토글 */}
        <Button
          variant={showCostLimit ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            setShowCostLimit(!showCostLimit);
            setShowSkip(false);
          }}
        >
          <DollarSign className="h-3 w-3" />
          비용 한도
          {costLimitUsd != null && (
            <span className="text-[10px] opacity-70">(${costLimitUsd})</span>
          )}
        </Button>
      </div>

      {/* 모듈 스킵 패널 */}
      {showSkip && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            실행하지 않을 모듈을 선택하세요 (이미 완료된 모듈에는 영향 없음)
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_MODULES.map((mod) => (
              <button
                key={mod}
                onClick={() => toggleSkip(mod)}
                className={`text-left text-xs px-2 py-1.5 rounded-md border transition-colors ${
                  localSkipped.includes(mod)
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                    : 'hover:bg-muted/50'
                }`}
              >
                {localSkipped.includes(mod) && <SkipForward className="inline h-3 w-3 mr-1" />}
                {MODULE_LABELS[mod] ?? mod}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowSkip(false)}
            >
              닫기
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                skipMutation.mutate(localSkipped);
                setShowSkip(false);
              }}
              disabled={skipMutation.isPending}
            >
              {skipMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              적용 ({localSkipped.length}개 스킵)
            </Button>
          </div>
        </div>
      )}

      {/* 비용 한도 패널 */}
      {showCostLimit && (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            설정한 금액을 초과하면 남은 분석 모듈이 자동으로 중단됩니다. 현재 비용:{' '}
            <span className="font-mono font-medium text-foreground">${currentCost.toFixed(4)}</span>
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="예: 0.50"
                value={costInput}
                onChange={(e) => setCostInput(e.target.value)}
                className="pl-7 h-8 text-sm"
                autoComplete="off"
              />
            </div>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const val = parseFloat(costInput);
                costLimitMutation.mutate(isNaN(val) || val <= 0 ? null : val);
              }}
              disabled={costLimitMutation.isPending}
            >
              {costLimitMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              설정
            </Button>
            {costLimitUsd != null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  costLimitMutation.mutate(null);
                  setCostInput('');
                }}
                disabled={costLimitMutation.isPending}
              >
                해제
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- 개별 감정 분석 진행률 ---

const PHASE_LABELS: Record<string, { label: string; icon: typeof Heart }> = {
  lightweight: { label: '경량 분류 중', icon: Zap },
  'llm-reanalysis': { label: 'LLM 재분석 중', icon: Brain },
  completed: { label: '완료', icon: CheckCircle2 },
  pending: { label: '대기 중', icon: Heart },
};

function ItemAnalysisProgress({
  data,
  stageStatus,
}: {
  data: ItemAnalysisData;
  stageStatus: string;
}) {
  const isRunning = stageStatus === 'running';
  const isCompleted = stageStatus === 'completed';
  const isFailed = stageStatus === 'failed';

  const articlesPercent =
    data.articlesTotal > 0 ? Math.round((data.articlesAnalyzed / data.articlesTotal) * 100) : 0;
  const commentsPercent =
    data.commentsTotal > 0 ? Math.round((data.commentsAnalyzed / data.commentsTotal) * 100) : 0;

  const phaseInfo = PHASE_LABELS[data.phase] ?? PHASE_LABELS.pending;
  const PhaseIcon = phaseInfo.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-pink-500" />
          <h4 className="text-xs font-medium">개별 감정 분석</h4>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <PulseRing active={isRunning} color="bg-pink-400">
            <PhaseIcon
              className={`h-3 w-3 ${isRunning ? 'text-pink-500' : isCompleted ? 'text-green-500' : isFailed ? 'text-red-500' : 'text-muted-foreground'}`}
            />
          </PulseRing>
          <span className="font-medium">{phaseInfo.label}</span>
          {data.ambiguousCount > 0 && data.phase === 'llm-reanalysis' && (
            <span className="text-amber-600 dark:text-amber-400">({data.ambiguousCount}건)</span>
          )}
        </div>
      </div>

      {/* 기사 진행률 */}
      {data.articlesTotal > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">기사</span>
            <span className="font-mono">
              <AnimatedNumber value={data.articlesAnalyzed} /> / {data.articlesTotal}
            </span>
          </div>
          <Progress value={articlesPercent} className="h-1.5" />
        </div>
      )}

      {/* 댓글 진행률 */}
      {data.commentsTotal > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">댓글</span>
            <span className="font-mono">
              <AnimatedNumber value={data.commentsAnalyzed} /> / {data.commentsTotal}
            </span>
          </div>
          <Progress value={commentsPercent} className="h-1.5" />
        </div>
      )}

      {/* 완료 요약 */}
      {isCompleted && data.ambiguousCount > 0 && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Zap className="h-3 w-3 text-yellow-500" />
          <span>경량 {data.articlesAnalyzed + data.commentsAnalyzed - data.ambiguousCount}건</span>
          <span>·</span>
          <Brain className="h-3 w-3 text-violet-500" />
          <span>LLM {data.ambiguousCount}건</span>
        </div>
      )}
    </div>
  );
}
