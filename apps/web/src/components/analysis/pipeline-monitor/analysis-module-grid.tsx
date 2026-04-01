'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Loader2, XCircle, Clock, ChevronDown, RefreshCw } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PulseRing } from './pulse-ring';
import { CostSummary } from './cost-summary';
import { MODULE_HELP, STAGE_LABELS } from './constants';
import { formatTokens, formatElapsedCompact } from './utils';
import type { AnalysisModuleDetailed, ModuleStatus, TokenUsage } from './types';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AnalysisModuleGridProps {
  modules: AnalysisModuleDetailed[];
  moduleCount: { total: number; completed: number };
  tokenUsage: TokenUsage;
  jobId?: number | null;
  pipelineStatus?: string;
}

// 프로바이더 타입 → 표시명
const PROVIDER_DISPLAY: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  ollama: 'Ollama',
  deepseek: 'DeepSeek',
  xai: 'xAI',
  openrouter: 'OpenRouter',
  custom: 'Custom',
};

function moduleStatusIcon(status: ModuleStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />;
  }
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'border-green-500/50 bg-green-50/80 dark:bg-green-950/30',
  running: 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40',
  failed: 'border-red-500/50 bg-red-50/80 dark:bg-red-950/30',
  pending: 'border-border bg-muted/30 text-muted-foreground',
};

function ModuleCard({
  mod,
  modelSetting,
  jobId,
  canRetry,
}: {
  mod: AnalysisModuleDetailed;
  modelSetting?: { provider: string; model: string };
  jobId?: number | null;
  canRetry?: boolean;
}) {
  const retryMutation = useMutation({
    mutationFn: () => trpcClient.analysis.retryModule.mutate({ jobId: jobId!, module: mod.module }),
    onSuccess: () => toast.success(`${mod.label} 재실행 시작`),
    onError: () => toast.error('재실행에 실패했습니다'),
  });
  const help = MODULE_HELP[mod.module];
  const totalTokens = mod.usage ? mod.usage.input + mod.usage.output : 0;
  const isActive = mod.status === 'running';
  const displayProvider = mod.usage?.provider ?? modelSetting?.provider ?? help?.provider ?? '';
  const displayModel = mod.usage?.model ?? modelSetting?.model ?? help?.model ?? '';

  const card = (
    <PulseRing active={isActive}>
      <motion.div
        animate={{
          borderColor: isActive ? 'var(--color-blue-500)' : undefined,
        }}
        transition={{ duration: 0.3 }}
        className={`flex flex-col gap-0.5 rounded-md border px-2 py-1.5 text-xs transition-colors cursor-default ${STATUS_STYLES[mod.status] ?? STATUS_STYLES.pending}`}
      >
        <div className="flex items-center gap-1.5">
          {moduleStatusIcon(mod.status)}
          <span className="font-medium truncate text-[11px]">{mod.label}</span>
        </div>
        {/* 모델명 표시 */}
        {(displayProvider || displayModel) && mod.status !== 'pending' && (
          <div className="text-[9px] text-muted-foreground/70 ml-5 font-mono truncate">
            {PROVIDER_DISPLAY[displayProvider] ?? displayProvider}
            {displayModel ? ` · ${displayModel}` : ''}
          </div>
        )}
        {(totalTokens > 0 || mod.durationSeconds) && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ml-5">
            {totalTokens > 0 && <span className="font-mono">{formatTokens(totalTokens)}</span>}
            {mod.durationSeconds != null && (
              <span className="font-mono">{formatElapsedCompact(mod.durationSeconds)}</span>
            )}
          </div>
        )}
        {mod.status === 'failed' && (
          <div className="flex items-center gap-1 ml-5">
            {mod.errorMessage && (
              <p
                className="text-[10px] text-red-600 dark:text-red-400 truncate flex-1"
                title={mod.errorMessage}
              >
                {mod.errorMessage}
              </p>
            )}
            {canRetry && jobId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                title="재실행"
                onClick={(e) => {
                  e.stopPropagation();
                  retryMutation.mutate();
                }}
                disabled={retryMutation.isPending}
              >
                {retryMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 text-red-500 hover:text-red-600" />
                )}
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </PulseRing>
  );

  if (!help) return card;

  return (
    <HoverCard>
      <HoverCardTrigger className="cursor-default">{card}</HoverCardTrigger>
      <HoverCardContent className="w-72 text-xs" side="top">
        <div className="space-y-1.5">
          <h4 className="font-semibold">{mod.label}</h4>
          <p className="text-muted-foreground leading-relaxed">{help.description}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 border-t">
            <Badge variant="outline" className="text-[10px] px-1.5">
              {help.stageLabel}
            </Badge>
            <span>
              {PROVIDER_DISPLAY[displayProvider] ?? displayProvider} / {displayModel}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export const AnalysisModuleGrid = memo(function AnalysisModuleGrid({
  modules,
  moduleCount,
  tokenUsage,
  jobId,
  pipelineStatus,
}: AnalysisModuleGridProps) {
  const terminalStatuses = ['completed', 'failed', 'partial_failure', 'cancelled'];
  const canRetry = jobId != null && terminalStatuses.includes(pipelineStatus ?? '');
  // DB에서 모듈별 모델 설정
  const { data: modelSettings } = useQuery({
    queryKey: [['settings', 'list']],
    queryFn: () => trpcClient.settings.list.query(),
  });
  const settingsMap = new Map(
    (modelSettings ?? []).map((s) => [s.moduleName, { provider: s.provider, model: s.model }]),
  );

  if (modules.length === 0) {
    return null;
  }

  // Stage별 그룹핑
  const stages = new Map<number, AnalysisModuleDetailed[]>();
  for (const mod of modules) {
    const stage = mod.stage || 0;
    if (!stages.has(stage)) stages.set(stage, []);
    stages.get(stage)!.push(mod);
  }

  const progressPercent =
    moduleCount.total > 0 ? Math.round((moduleCount.completed / moduleCount.total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground">AI 분석</h4>
        <span className="text-[10px] font-mono text-muted-foreground">
          {moduleCount.completed}/{moduleCount.total} ({progressPercent}%)
        </span>
      </div>

      <Progress value={progressPercent} className="h-1" />

      {/* Stage별 모듈 그리드 + 연결선 */}
      {Array.from(stages.entries())
        .sort(([a], [b]) => a - b)
        .map(([stageNum, mods], idx, _arr) => {
          const stageInfo = STAGE_LABELS[stageNum];
          return (
            <div key={stageNum}>
              {/* Stage 간 연결선 */}
              {idx > 0 && (
                <div className="flex justify-center py-1">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              )}

              {stageInfo && (
                <div className="flex items-center gap-2 mb-1.5">
                  <h5 className="text-[11px] font-medium text-muted-foreground">
                    {stageInfo.label}
                  </h5>
                  <span className="text-[10px] text-muted-foreground/60">
                    {stageInfo.description}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {mods.map((mod) => (
                  <ModuleCard
                    key={mod.module}
                    mod={mod}
                    modelSetting={settingsMap.get(mod.module)}
                    jobId={jobId}
                    canRetry={canRetry}
                  />
                ))}
              </div>
            </div>
          );
        })}

      {/* 비용 요약 (접힘) */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className="h-3 w-3 transition-transform [[data-state=open]_&]:rotate-180" />
          <span>비용 상세</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2">
            <CostSummary tokenUsage={tokenUsage} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});
