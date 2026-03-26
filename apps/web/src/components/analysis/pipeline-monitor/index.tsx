'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usePipelineStatus } from '@/hooks/use-pipeline-status';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
// AlertDialogTrigger: Base UI 기반으로 asChild 미지원 — className 직접 적용
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  ChevronRight,
  LayoutDashboard,
  Download,
  Beaker,
  ScrollText,
  Square,
  Pause,
  Play,
  SkipForward,
  DollarSign,
  Ban,
} from 'lucide-react';

import { PipelineSteps } from './pipeline-steps';
import { OverviewTab } from './overview-tab';
import { CollectionTab } from './collection-tab';
import { AnalysisTab } from './analysis-tab';
import { LogTab } from './log-tab';
import { formatElapsed } from './utils';
import type { PipelineStatusData } from './types';

// 분석 모듈 한글 라벨
const MODULE_LABELS: Record<string, string> = {
  'sentiment-framing': '감정 프레이밍',
  'macro-view': '거시 분석',
  'segmentation': '세그멘테이션',
  'message-impact': '메시지 임팩트',
  'risk-map': '리스크 맵',
  'opportunity': '기회 발굴',
  'strategy': '전략 제안',
  'final-summary': '종합 요약',
  'approval-rating': '지지율 분석',
  'frame-war': '프레임 전쟁',
  'crisis-scenario': '위기 시나리오',
  'win-simulation': '승리 시뮬레이션',
};

interface PipelineMonitorProps {
  jobId: number | null;
  onComplete?: () => void;
  onRetry?: () => void;
}

export function PipelineMonitor({ jobId, onComplete, onRetry }: PipelineMonitorProps) {
  const { data, isLoading } = usePipelineStatus(jobId);

  // 완료 시 toast + 탭 전환
  // 리포트 생성 완료 + 분석 모듈 모두 완료(running/pending 없음) 시에만 전환
  const prevDoneRef = useRef(false);
  useEffect(() => {
    if (!data) return;

    const analysisAllDone = data.analysisModulesDetailed?.length > 0 &&
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
    tokenUsage: data.tokenUsage ?? { total: { input: 0, output: 0 }, byModule: [], estimatedCostUsd: 0 },
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
  const isInProgress = isRunning || isPaused || isAnalysisRunning || data.pipelineStages?.report?.status === 'running';

  return (
    <Card className="mx-auto max-w-3xl mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            파이프라인 진행 상태
          </CardTitle>
          <div className="flex items-center gap-2">
            {data.elapsedSeconds != null && isInProgress && (
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatElapsed(data.elapsedSeconds)}
              </span>
            )}
            <StatusBadge status={data.status} keyword={data.keyword} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 4단계 스텝 인디케이터 */}
        <PipelineSteps stages={data.pipelineStages} />

        {/* 전체 진행률 바 */}
        {isInProgress && !isPaused && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>전체 진행률</span>
              <span className="font-mono">{statusData.overallProgress}%</span>
            </div>
            <Progress value={statusData.overallProgress} className="h-2" />
          </div>
        )}

        {/* 일시정지 진행률 (애니메이션 없이) */}
        {isPaused && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-amber-600">
              <span>일시정지 중</span>
              <span className="font-mono">{statusData.overallProgress}%</span>
            </div>
            <Progress value={statusData.overallProgress} className="h-2 opacity-60" />
          </div>
        )}

        {/* 경과 시간 (완료/취소 상태) */}
        {data.elapsedSeconds != null && !isInProgress && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Clock className="h-3 w-3" />
            <span>총 소요시간: {formatElapsed(data.elapsedSeconds)}</span>
          </div>
        )}

        {/* 제어 버튼 영역 */}
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

        {/* 탭 영역 */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-8">
            <TabsTrigger value="overview" className="text-xs gap-1">
              <LayoutDashboard className="h-3 w-3" />
              개요
            </TabsTrigger>
            <TabsTrigger value="collection" className="text-xs gap-1">
              <Download className="h-3 w-3" />
              수집
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs gap-1">
              <Beaker className="h-3 w-3" />
              분석
            </TabsTrigger>
            <TabsTrigger value="log" className="text-xs gap-1">
              <ScrollText className="h-3 w-3" />
              로그
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3">
            <OverviewTab data={statusData} />
          </TabsContent>

          <TabsContent value="collection" className="mt-3">
            <CollectionTab data={statusData} />
          </TabsContent>

          <TabsContent value="analysis" className="mt-3">
            <AnalysisTab data={statusData} />
          </TabsContent>

          <TabsContent value="log" className="mt-3">
            <LogTab events={statusData.events} />
          </TabsContent>
        </Tabs>

        {/* 완료 상태 — 리포트 생성 + 모든 분석 모듈 완료 시에만 표시 */}
        {data.hasReport && !data.analysisModulesDetailed?.some(
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
              <span>파이프라인이 중지되었습니다. {data.hasReport ? '부분 결과를 확인할 수 있습니다.' : ''}</span>
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

// 상태 뱃지
function StatusBadge({ status, keyword }: { status: string; keyword: string }) {
  const variantMap: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
    failed: 'destructive',
    completed: 'default',
    cancelled: 'outline',
  };
  return (
    <Badge variant={variantMap[status] ?? 'secondary'}>
      {status === 'cancelled' && '중지됨 · '}
      {status === 'paused' && '일시정지 · '}
      {keyword}
    </Badge>
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
    mutationFn: (limitUsd: number | null) => trpcClient.pipeline.setCostLimit.mutate({ jobId, limitUsd }),
    onSuccess: (res) => { toast.success(res.message); setShowCostLimit(false); },
    onError: () => toast.error('비용 한도 설정에 실패했습니다'),
  });

  const isPending = cancelMutation.isPending || pauseMutation.isPending || resumeMutation.isPending;

  // 모든 분석 모듈 목록
  const ALL_MODULES = [
    'macro-view', 'segmentation', 'sentiment-framing', 'message-impact',
    'risk-map', 'opportunity', 'strategy', 'final-summary',
    'approval-rating', 'frame-war', 'crisis-scenario', 'win-simulation',
  ];

  const toggleSkip = (mod: string) => {
    setLocalSkipped(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);
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
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => resumeMutation.mutate()} disabled={isPending}>
            {resumeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            재개
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => pauseMutation.mutate()} disabled={isPending || status !== 'running'}>
            {pauseMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
            일시정지
          </Button>
        )}

        {/* 모듈 스킵 토글 */}
        <Button
          variant={showSkip ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => { setShowSkip(!showSkip); setShowCostLimit(false); }}
        >
          <SkipForward className="h-3 w-3" />
          모듈 스킵
        </Button>

        {/* 비용 한도 토글 */}
        <Button
          variant={showCostLimit ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => { setShowCostLimit(!showCostLimit); setShowSkip(false); }}
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
          <p className="text-xs text-muted-foreground">실행하지 않을 모듈을 선택하세요 (이미 완료된 모듈에는 영향 없음)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_MODULES.map(mod => (
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
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowSkip(false)}>
              닫기
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => { skipMutation.mutate(localSkipped); setShowSkip(false); }}
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
            설정한 금액을 초과하면 남은 분석 모듈이 자동으로 중단됩니다.
            현재 비용: <span className="font-mono font-medium text-foreground">${currentCost.toFixed(4)}</span>
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
                onClick={() => { costLimitMutation.mutate(null); setCostInput(''); }}
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
