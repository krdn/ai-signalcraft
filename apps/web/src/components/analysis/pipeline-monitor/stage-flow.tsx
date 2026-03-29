'use client';

import { memo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Download,
  Layers,
  Beaker,
  FileText,
} from 'lucide-react';
import { PulseRing } from './pulse-ring';
import { STAGE_HELP, PIPELINE_STEPS } from './constants';
import { computeSegments } from './timeline-bar';
import { formatElapsedCompact } from './utils';
import type { PipelineTimeline, StageStatus } from './types';

interface StageFlowProps {
  stages: Record<string, { status: string }>;
  timeline: PipelineTimeline;
  elapsedSeconds: number;
}

const STAGE_ICONS: Record<string, typeof Download> = {
  collection: Download,
  normalization: Layers,
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
  return 'bg-muted-foreground/20 h-px border-t border-dashed border-muted-foreground/30';
}

export const StageFlow = memo(function StageFlow({
  stages,
  timeline,
  elapsedSeconds,
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

          return (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              {/* 노드 */}
              <Tooltip>
                <TooltipTrigger className="w-full cursor-default">
                  <div>
                    <PulseRing active={isActive} color="bg-blue-400">
                      <div
                        className={`
                          flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-all w-full
                          ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 glow-blue' : ''}
                          ${isCompleted ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}
                          ${status === 'failed' ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : ''}
                          ${status === 'pending' || status === 'skipped' ? 'border-border bg-muted/30' : ''}
                        `}
                      >
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
                <div className={`w-4 shrink-0 mx-0.5 ${connectorClass(
                  status,
                  stages[PIPELINE_STEPS[idx + 1].key]?.status ?? 'pending',
                )}`} />
              )}
            </div>
          );
        })}
      </TooltipProvider>
    </div>
  );
});
