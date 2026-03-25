'use client';

import { useEffect } from 'react';
import { usePipelineStatus } from '@/hooks/use-pipeline-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';

import { PipelineSteps } from './pipeline-steps';
import { OverviewTab } from './overview-tab';
import { CollectionTab } from './collection-tab';
import { AnalysisTab } from './analysis-tab';
import { LogTab } from './log-tab';
import { formatElapsed } from './utils';
import type { PipelineStatusData } from './types';

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
      <Card className="mx-auto max-w-3xl mt-4">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // 확장 필드가 없는 경우 기본값 (하위 호환)
  const statusData: PipelineStatusData = {
    ...data,
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
  const isRunning = data.status === 'running' || data.status === 'pending';

  return (
    <Card className="mx-auto max-w-3xl mt-4">
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

      <CardContent className="space-y-4">
        {/* 4단계 스텝 인디케이터 (항상 표시) */}
        <PipelineSteps stages={data.pipelineStages} />

        {/* 전체 진행률 바 */}
        {isRunning && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>전체 진행률</span>
              <span className="font-mono">{statusData.overallProgress}%</span>
            </div>
            <Progress value={statusData.overallProgress} className="h-2" />
          </div>
        )}

        {/* 경과 시간 (완료 상태) */}
        {data.elapsedSeconds != null && !isRunning && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Clock className="h-3 w-3" />
            <span>총 소요시간: {formatElapsed(data.elapsedSeconds)}</span>
          </div>
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
