'use client';

import { AlertCircle, Database, Beaker, Coins } from 'lucide-react';
import { TimelineBar } from './timeline-bar';
import { formatTokens, formatCostUsd } from './utils';
import type { PipelineStatusData, SourceDetail } from './types';
import { Card, CardContent } from '@/components/ui/card';

interface OverviewTabProps {
  data: PipelineStatusData;
}

export function OverviewTab({ data }: OverviewTabProps) {
  // 수집 건수 합계
  const totalCollected = Object.values(data.sourceDetails).reduce(
    (sum, s: SourceDetail) => sum + s.count,
    0,
  );

  // 에러 소스/모듈 수
  const failedSources = Object.values(data.sourceDetails).filter(
    (s: SourceDetail) => s.status === 'failed',
  ).length;
  const failedModules = data.analysisModulesDetailed.filter((m) => m.status === 'failed').length;
  const hasErrors = failedSources > 0 || failedModules > 0;

  return (
    <div className="space-y-4">
      {/* 타임라인 바 */}
      <TimelineBar
        timeline={data.timeline}
        stages={data.pipelineStages}
        elapsedSeconds={data.elapsedSeconds}
      />

      {/* 통계 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        {/* 수집 건수 */}
        <Card className="border-muted">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <Database className="h-4 w-4 text-blue-500" />
            <span className="text-lg font-bold font-mono">{totalCollected.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">수집 건수</span>
          </CardContent>
        </Card>

        {/* 분석 완료율 */}
        <Card className="border-muted">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <Beaker className="h-4 w-4 text-violet-500" />
            <span className="text-lg font-bold font-mono">
              {data.analysisModuleCount.completed}/{data.analysisModuleCount.total}
            </span>
            <span className="text-[10px] text-muted-foreground">분석 모듈</span>
          </CardContent>
        </Card>

        {/* 토큰/비용 */}
        <Card className="border-muted">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-lg font-bold font-mono">
              {formatTokens(data.tokenUsage.total.input + data.tokenUsage.total.output)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              토큰 ({formatCostUsd(data.tokenUsage.estimatedCostUsd)})
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 에러 요약 배너 */}
      {hasErrors && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">
            {failedSources > 0 && `수집 실패 ${failedSources}건`}
            {failedSources > 0 && failedModules > 0 && ' / '}
            {failedModules > 0 && `분석 실패 ${failedModules}건`}
            {' — 수집/분석 탭에서 상세 확인'}
          </span>
        </div>
      )}
    </div>
  );
}
