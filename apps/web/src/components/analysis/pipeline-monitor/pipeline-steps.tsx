'use client';

import {
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  Download,
  Beaker,
  FileText,
  Settings,
  XCircle,
  Info,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { STAGE_HELP, PIPELINE_STEPS } from './constants';
import type { StageStatus } from './types';

// 스텝 아이콘 매핑
const STEP_ICONS = {
  collection: Download,
  normalization: Settings,
  analysis: Beaker,
  report: FileText,
} as const;

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

interface PipelineStepsProps {
  stages: Record<string, { status: string }>;
}

export function PipelineSteps({ stages }: PipelineStepsProps) {
  return (
    <div className="flex items-center justify-between gap-1">
      {PIPELINE_STEPS.map((step, idx) => {
        const status = (stages[step.key]?.status ?? 'pending') as StageStatus;
        const isActive = status === 'running';
        const isCompleted = status === 'completed';
        const isFailed = status === 'failed' || status === 'skipped';
        const Icon = STEP_ICONS[step.key as keyof typeof STEP_ICONS];
        const help = STAGE_HELP[step.key];

        return (
          <div key={step.key} className="flex items-center gap-1">
            {/* 스텝 카드 */}
            <div
              className={`
                relative flex flex-col items-center gap-1 rounded-lg border px-3 py-2 min-w-[72px] transition-colors
                ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 shadow-sm' : ''}
                ${isCompleted ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/30' : ''}
                ${isFailed ? 'border-red-500/50 bg-red-50/50 dark:bg-red-950/30' : ''}
                ${status === 'pending' ? 'border-border bg-muted/30' : ''}
              `}
            >
              {/* 도움말 버튼 */}
              {help && (
                <Popover>
                  <PopoverTrigger
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 hover:bg-accent transition-colors"
                    aria-label={`${step.label} 도움말`}
                  >
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </PopoverTrigger>
                  <PopoverContent className="w-72 text-sm" side="top">
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-1.5">
                        <Icon className="h-4 w-4" />
                        {help.title}
                      </h4>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {help.description}
                      </p>
                      <ul className="space-y-1">
                        {help.details.map((detail, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <span className="text-muted-foreground/60 shrink-0">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              <div className="flex items-center gap-1.5">
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-blue-500'
                    : isCompleted ? 'text-green-500'
                    : isFailed ? 'text-red-500'
                    : 'text-muted-foreground'
                  }`}
                />
                <StepStatusIcon status={status} />
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                {step.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {statusLabel(status)}
              </span>
            </div>

            {/* 화살표 연결선 */}
            {idx < PIPELINE_STEPS.length - 1 && (
              <ArrowRight
                className={`h-4 w-4 shrink-0 ${isCompleted ? 'text-green-400' : 'text-muted-foreground/40'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
