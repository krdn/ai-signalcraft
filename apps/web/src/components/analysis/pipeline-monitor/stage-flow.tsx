'use client';

import { memo } from 'react';
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Download,
  Layers,
  Heart,
  Beaker,
  FileText,
  Ban,
  Zap,
  Bookmark,
} from 'lucide-react';
import { PulseRing } from './pulse-ring';
import { STAGE_HELP, PIPELINE_STEPS } from './constants';
import { computeSegments } from './timeline-bar';
import { formatElapsedCompact } from './utils';
import type { PipelineTimeline, StageStatus, PipelineStageDetails } from './types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StageFlowProps {
  stages: Record<string, { status: string }>;
  timeline: PipelineTimeline;
  elapsedSeconds: number;
  breakpoints?: string[];
  pausedAtStage?: string | null;
  isPaused?: boolean;
  onToggleBreakpoint?: (stageKey: string) => void;
  stageDetails?: PipelineStageDetails;
}

function buildStageCountLabel(stepKey: string, details: PipelineStageDetails): string | null {
  // 정규화 카드: sampling 결과(입력 건수) 표시
  if (stepKey === 'normalization') {
    const s = details.sampling;
    if (!s) return null;
    const arts = s.articles.totalInput;
    const cmts = s.comments.totalInput;
    if (arts === 0 && cmts === 0) return null;
    const parts: string[] = [];
    if (arts > 0) parts.push(`기사 ${arts.toLocaleString()}`);
    if (cmts > 0) parts.push(`댓글 ${cmts.toLocaleString()}`);
    return parts.join(' · ');
  }
  // 토큰 최적화 카드: normalization 처리 건수 표시
  if (stepKey === 'token-optimization') {
    const norm = details.normalization;
    if (!norm || norm.status === 'pending') return null;
    const arts = norm.articlesProcessed;
    const cmts = norm.commentsProcessed;
    if (arts === 0 && cmts === 0) return null;
    const parts: string[] = [];
    if (arts > 0) parts.push(`기사 ${arts.toLocaleString()}`);
    if (cmts > 0) parts.push(`댓글 ${cmts.toLocaleString()}`);
    return parts.join(' · ');
  }
  // AI 분석 카드: token-optimization 결과(최적화 후) 표시
  if (stepKey === 'analysis') {
    const t = details.tokenOptimization;
    if (!t || t.status === 'pending') return null;
    const arts = t.optimizedArticles;
    const cmts = t.optimizedComments;
    if (arts === 0 && cmts === 0) return null;
    const parts: string[] = [];
    if (arts > 0) parts.push(`기사 ${arts.toLocaleString()}`);
    if (cmts > 0) parts.push(`댓글 ${cmts.toLocaleString()}`);
    const pct = t.reductionPercent;
    return parts.join(' · ') + (pct ? ` (${pct}%↓)` : '');
  }
  return null;
}

const STAGE_ICONS: Record<string, typeof Download> = {
  collection: Download,
  normalization: Layers,
  'token-optimization': Zap,
  'item-analysis': Heart,
  analysis: Beaker,
  report: FileText,
};

function stageStatusIcon(status: StageStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'cancelled':
      return <Ban className="h-4 w-4 text-zinc-400" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground/50" />;
  }
}

function connectorClass(fromStatus: string, toStatus: string): string {
  if (fromStatus === 'completed' && toStatus === 'running') {
    return 'bg-gradient-to-r from-green-400 to-blue-400 animate-pulse h-0.5';
  }
  if (fromStatus === 'completed' && (toStatus === 'completed' || toStatus === 'failed')) {
    return 'bg-green-400/60 h-0.5';
  }
  if (fromStatus === 'cancelled' || toStatus === 'cancelled') {
    return 'bg-zinc-300/50 dark:bg-zinc-700/50 h-px';
  }
  return 'bg-muted-foreground/20 h-px border-t border-dashed border-muted-foreground/30';
}

/** UI 단계 키 → BP 키 매핑 (PIPELINE_STEPS와 BP enum의 차이 처리) */
function stageToBpKey(stepKey: string): string | null {
  if (stepKey === 'normalization') return 'normalize';
  if (stepKey === 'analysis') return 'analysis-stage1'; // 대표값 — stage2/4는 trigger-form에서 별도 설정
  if (stepKey === 'report') return null; // report는 BP 대상 아님
  return stepKey;
}

export const StageFlow = memo(function StageFlow({
  stages,
  timeline,
  elapsedSeconds,
  breakpoints,
  pausedAtStage,
  isPaused,
  onToggleBreakpoint,
  stageDetails,
}: StageFlowProps) {
  const segments = computeSegments(timeline, stages, elapsedSeconds);

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delay={300}>
        {PIPELINE_STEPS.map((step, idx) => {
          const status = (stages[step.key]?.status ?? 'pending') as StageStatus;
          const Icon = STAGE_ICONS[step.key] ?? Beaker;
          const seg = segments.find((s) => s.key === step.key);
          const help = STAGE_HELP[step.key];
          const isActive = status === 'running';
          const isCompleted = status === 'completed';

          const bpKey = stageToBpKey(step.key);
          const isBreakpoint = bpKey != null && (breakpoints?.includes(bpKey) ?? false);
          const isPausedHere = !!isPaused && bpKey != null && pausedAtStage === bpKey;
          const canToggle = bpKey != null && status === 'pending' && !!onToggleBreakpoint;

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              {/* 노드 */}
              <Tooltip>
                <TooltipTrigger className="w-full cursor-default block">
                  <div
                    onClick={() => {
                      if (canToggle && bpKey) onToggleBreakpoint!(bpKey);
                    }}
                    className={canToggle ? 'cursor-pointer' : ''}
                  >
                    <PulseRing active={isActive} color="bg-blue-400">
                      <div
                        className={`
                          relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-all w-full
                          ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 glow-blue' : ''}
                          ${isCompleted ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}
                          ${status === 'failed' ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : ''}
                          ${status === 'cancelled' ? 'border-zinc-400/50 bg-zinc-100/50 dark:bg-zinc-800/30 opacity-60' : ''}
                          ${status === 'pending' || status === 'skipped' ? 'border-border bg-muted/30' : ''}
                          ${isPausedHere ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-400 scale-105' : ''}
                        `}
                      >
                        {isBreakpoint && (
                          <Bookmark className="absolute top-1 right-1 h-3 w-3 fill-amber-500 text-amber-500" />
                        )}
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium truncate">{step.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {stageStatusIcon(status)}
                          {seg && seg.seconds > 0 && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {formatElapsedCompact(seg.seconds)}
                            </span>
                          )}
                        </div>
                        {stageDetails &&
                          (() => {
                            const label = buildStageCountLabel(step.key, stageDetails);
                            return label ? (
                              <span
                                className="text-[9px] text-muted-foreground/70 font-mono leading-tight text-center w-full truncate px-0.5"
                                title={label}
                              >
                                {label}
                              </span>
                            ) : null;
                          })()}
                      </div>
                    </PulseRing>
                  </div>
                </TooltipTrigger>
                {help && (
                  <TooltipContent side="top" className="max-w-[260px] text-xs">
                    <p className="font-semibold">{help.title}</p>
                    <p className="text-muted-foreground mt-1">{help.description}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              {/* 연결선 */}
              {idx < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`w-4 shrink-0 mx-0.5 ${connectorClass(
                    status,
                    stages[PIPELINE_STEPS[idx + 1].key]?.status ?? 'pending',
                  )}`}
                />
              )}
            </div>
          );
        })}
      </TooltipProvider>
    </div>
  );
});
