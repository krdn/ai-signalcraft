'use client';

import { useEffect } from 'react';
import { usePipelineStatus } from '@/hooks/use-pipeline-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  Download,
  Beaker,
  FileText,
  Settings,
  ChevronRight,
  XCircle,
} from 'lucide-react';

// --- 타입 정의 ---

type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
type ModuleStatus = 'pending' | 'running' | 'completed' | 'failed';

interface SourceDetail {
  status: string;
  count: number;
  label: string;
}

interface AnalysisModule {
  module: string;
  status: ModuleStatus;
  label: string;
}

// --- 유틸리티 ---

/** 초를 "X분 Y초" 형식으로 포맷 */
function formatElapsed(seconds: number): string {
  if (seconds < 0) return '0초';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}초`;
  return `${min}분 ${sec}초`;
}

// --- 4단계 스텝 인디케이터 ---

const PIPELINE_STEPS = [
  { key: 'collection', label: '수집', icon: Download },
  { key: 'normalization', label: '정규화', icon: Settings },
  { key: 'analysis', label: '분석', icon: Beaker },
  { key: 'report', label: '리포트', icon: FileText },
] as const;

function StepStatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'running':
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    case 'failed':
    case 'skipped':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function statusLabel(status: StageStatus): string {
  switch (status) {
    case 'completed': return '완료';
    case 'running': return '진행 중';
    case 'failed': return '실패';
    case 'skipped': return '건너뜀';
    default: return '대기';
  }
}

function PipelineSteps({
  stages,
}: {
  stages: Record<string, { status: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-1">
      {PIPELINE_STEPS.map((step, idx) => {
        const status = (stages[step.key]?.status ?? 'pending') as StageStatus;
        const isActive = status === 'running';
        const isCompleted = status === 'completed';
        const isFailed = status === 'failed' || status === 'skipped';
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center gap-1">
            {/* 스텝 카드 */}
            <div
              className={`
                flex flex-col items-center gap-1 rounded-lg border px-3 py-2 min-w-[72px] transition-colors
                ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 shadow-sm' : ''}
                ${isCompleted ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/30' : ''}
                ${isFailed ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/30' : ''}
                ${status === 'pending' ? 'border-border bg-muted/30' : ''}
              `}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-blue-500' : isCompleted ? 'text-green-500' : isFailed ? 'text-red-500' : 'text-muted-foreground'}`} />
                <StepStatusIcon status={status} />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                {step.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {statusLabel(status)}
              </span>
            </div>

            {/* 화살표 연결선 (마지막 스텝 제외) */}
            {idx < PIPELINE_STEPS.length - 1 && (
              <ArrowRight className={`h-4 w-4 shrink-0 ${isCompleted ? 'text-green-400' : 'text-muted-foreground/40'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- 소스별 수집 상세 ---

function sourceStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] px-1.5">완료</Badge>;
    case 'running':
      return <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5">수집 중</Badge>;
    case 'failed':
      return <Badge variant="destructive" className="text-[10px] px-1.5">실패</Badge>;
    case 'skipped':
      return <Badge variant="outline" className="text-[10px] px-1.5">건너뜀</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5">대기</Badge>;
  }
}

function CollectionDetails({
  sourceDetails,
  errorDetails,
}: {
  sourceDetails: Record<string, SourceDetail>;
  errorDetails?: Record<string, string> | null;
}) {
  const sources = Object.entries(sourceDetails);
  if (sources.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Download className="h-4 w-4" />
        <span>수집 상세</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map(([key, detail]) => {
          const error = errorDetails?.[key];
          return error ? (
            <TooltipProvider key={key} delay={300}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm w-full">
                    <div className="flex items-center gap-2">
                      {sourceStatusBadge(detail.status)}
                      <span className="font-medium">{detail.label}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">
                      {detail.count}건
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{error}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {sourceStatusBadge(detail.status)}
                <span className="font-medium">{detail.label}</span>
              </div>
              <span className="font-mono text-muted-foreground">
                {detail.count}건
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- 12개 분석 모듈 카드 그리드 ---

function moduleStatusIcon(status: ModuleStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function moduleCardClass(status: ModuleStatus): string {
  switch (status) {
    case 'completed':
      return 'border-green-500/50 bg-green-50 dark:bg-green-950/30';
    case 'running':
      return 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 animate-pulse';
    case 'failed':
      return 'border-red-500/50 bg-red-50 dark:bg-red-950/30';
    default:
      return 'border-border bg-muted/30 text-muted-foreground';
  }
}

function AnalysisModuleGrid({
  modules,
  moduleCount,
}: {
  modules: AnalysisModule[];
  moduleCount: { total: number; completed: number };
}) {
  if (modules.length === 0) return null;

  const progressPercent = moduleCount.total > 0
    ? Math.round((moduleCount.completed / moduleCount.total) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {/* 헤더 + 진행률 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium text-muted-foreground">
            <Beaker className="h-4 w-4" />
            <span>분석 모듈</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {moduleCount.completed}/{moduleCount.total} 완료
          </span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* 4열 그리드 (반응형: 2열→3열→4열) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {modules.map((mod) => (
          <div
            key={mod.module}
            className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium transition-colors ${moduleCardClass(mod.status)}`}
          >
            {moduleStatusIcon(mod.status)}
            <span className="truncate">{mod.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 메인 컴포넌트 ---

interface PipelineMonitorProps {
  jobId: number | null;
  onComplete?: () => void;
  onRetry?: () => void;
}

export function PipelineMonitor({ jobId, onComplete, onRetry }: PipelineMonitorProps) {
  const { data, isLoading } = usePipelineStatus(jobId);

  // 완료 시 toast + 탭 전환
  useEffect(() => {
    if (data?.status === 'completed' || data?.hasReport) {
      toast.success('분석이 완료되었습니다');
      onComplete?.();
    }
  }, [data?.status, data?.hasReport, onComplete]);

  if (!jobId) return null;

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-2xl mt-4">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const pipelineStages = data.pipelineStages;
  const hasFailed = data.status === 'failed';
  const isRunning = data.status === 'running' || data.status === 'pending';
  const collectionActive = pipelineStages.collection.status === 'running' || pipelineStages.collection.status === 'completed';
  const analysisActive = pipelineStages.analysis.status === 'running' || pipelineStages.analysis.status === 'completed';

  return (
    <Card className="mx-auto max-w-2xl mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            파이프라인 진행 상태
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* 경과 시간 */}
            {data.elapsedSeconds != null && isRunning && (
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatElapsed(data.elapsedSeconds)}
              </span>
            )}
            <Badge
              variant={hasFailed ? 'destructive' : data.status === 'completed' ? 'default' : 'secondary'}
            >
              {data.keyword}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* 4단계 스텝 인디케이터 */}
        <PipelineSteps stages={pipelineStages} />

        {/* 경과 시간 (완료 상태) */}
        {data.elapsedSeconds != null && !isRunning && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Clock className="h-3 w-3" />
            <span>총 소요시간: {formatElapsed(data.elapsedSeconds)}</span>
          </div>
        )}

        {/* 소스별 수집 상세 (수집 단계가 시작되었을 때만) */}
        {collectionActive && data.sourceDetails && Object.keys(data.sourceDetails).length > 0 && (
          <CollectionDetails
            sourceDetails={data.sourceDetails}
            errorDetails={data.errorDetails as Record<string, string> | null}
          />
        )}

        {/* 분석 모듈 카드 그리드 (분석 단계가 시작되었을 때만) */}
        {analysisActive && data.analysisModules && data.analysisModules.length > 0 && (
          <AnalysisModuleGrid
            modules={data.analysisModules}
            moduleCount={data.analysisModuleCount}
          />
        )}

        {/* 완료 상태 */}
        {data.status === 'completed' && data.hasReport && (
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

        {/* 에러 상태 + 재시도 버튼 */}
        {hasFailed && (
          <div className="flex items-center justify-between rounded-md bg-destructive/10 p-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>수집 중 오류가 발생했습니다. 일부 소스에서 데이터를 가져오지 못했습니다.</span>
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
