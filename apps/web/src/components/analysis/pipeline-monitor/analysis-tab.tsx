'use client';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  CheckCircle2,
  Loader2,
  Clock,
  XCircle,
} from 'lucide-react';
import { MODULE_HELP, STAGE_LABELS } from './constants';
import { formatTokens, formatElapsed } from './utils';
import { CostSummary } from './cost-summary';
import type { PipelineStatusData, AnalysisModuleDetailed, ModuleStatus } from './types';

interface AnalysisTabProps {
  data: PipelineStatusData;
}

function moduleStatusIcon(status: ModuleStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
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

function ModuleCard({ mod }: { mod: AnalysisModuleDetailed }) {
  const help = MODULE_HELP[mod.module];
  const totalTokens = mod.usage ? mod.usage.input + mod.usage.output : 0;

  const card = (
    <div
      className={`flex flex-col gap-1 rounded-md border px-2.5 py-2 text-xs transition-colors cursor-default ${moduleCardClass(mod.status)}`}
    >
      <div className="flex items-center gap-2">
        {moduleStatusIcon(mod.status)}
        <span className="font-medium truncate">{mod.label}</span>
      </div>
      {/* 토큰 + 소요시간 */}
      {(totalTokens > 0 || mod.durationSeconds) && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground ml-6">
          {totalTokens > 0 && (
            <span className="font-mono">{formatTokens(totalTokens)}</span>
          )}
          {mod.durationSeconds != null && (
            <span className="font-mono">{formatElapsed(mod.durationSeconds)}</span>
          )}
        </div>
      )}
      {/* 에러 메시지 */}
      {mod.status === 'failed' && mod.errorMessage && (
        <p className="text-[10px] text-red-600 dark:text-red-400 truncate ml-6" title={mod.errorMessage}>
          {mod.errorMessage}
        </p>
      )}
    </div>
  );

  // 도움말이 있으면 HoverCard로 감싸기
  if (!help) return card;

  return (
    <HoverCard>
      <HoverCardTrigger className="cursor-default">{card}</HoverCardTrigger>
      <HoverCardContent className="w-72 text-xs" side="top">
        <div className="space-y-1.5">
          <h4 className="font-semibold">{mod.label}</h4>
          <p className="text-muted-foreground leading-relaxed">{help.description}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t">
            <Badge variant="outline" className="text-[10px] px-1.5">{help.stageLabel}</Badge>
            <span>{help.provider} / {help.model}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function AnalysisTab({ data }: AnalysisTabProps) {
  const modules = data.analysisModulesDetailed;

  if (modules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        분석이 아직 시작되지 않았습니다.
      </p>
    );
  }

  // Stage별 그룹핑
  const stages = new Map<number, AnalysisModuleDetailed[]>();
  for (const mod of modules) {
    const stage = mod.stage || 0;
    if (!stages.has(stage)) stages.set(stage, []);
    stages.get(stage)!.push(mod);
  }

  const progressPercent = data.analysisModuleCount.total > 0
    ? Math.round((data.analysisModuleCount.completed / data.analysisModuleCount.total) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* 전체 진행률 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">분석 진행률</span>
          <span className="font-mono text-muted-foreground">
            {data.analysisModuleCount.completed}/{data.analysisModuleCount.total} 완료 ({progressPercent}%)
          </span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      {/* Stage별 모듈 그리드 */}
      {Array.from(stages.entries())
        .sort(([a], [b]) => a - b)
        .map(([stageNum, mods]) => {
          const stageInfo = STAGE_LABELS[stageNum];
          return (
            <div key={stageNum} className="space-y-2">
              {stageInfo && (
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    {stageInfo.label}
                  </h4>
                  <span className="text-[10px] text-muted-foreground/60">
                    {stageInfo.description}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {mods.map((mod) => (
                  <ModuleCard key={mod.module} mod={mod} />
                ))}
              </div>
            </div>
          );
        })}

      {/* 비용 요약 */}
      <CostSummary tokenUsage={data.tokenUsage} />
    </div>
  );
}
