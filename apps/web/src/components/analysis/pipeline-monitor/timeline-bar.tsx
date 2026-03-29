'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PIPELINE_STEPS } from './constants';
import { formatElapsed } from './utils';
import type { PipelineTimeline, StageStatus } from './types';

interface TimelineBarProps {
  timeline: PipelineTimeline;
  stages: Record<string, { status: string }>;
  elapsedSeconds: number;
}

// 단계별 색상
const STAGE_COLORS: Record<string, { bg: string; active: string }> = {
  collection: {
    bg: 'bg-blue-500 dark:bg-blue-600',
    active: 'bg-blue-400 dark:bg-blue-500 animate-pulse',
  },
  normalization: {
    bg: 'bg-cyan-500 dark:bg-cyan-600',
    active: 'bg-cyan-400 dark:bg-cyan-500 animate-pulse',
  },
  analysis: {
    bg: 'bg-violet-500 dark:bg-violet-600',
    active: 'bg-violet-400 dark:bg-violet-500 animate-pulse',
  },
  report: {
    bg: 'bg-emerald-500 dark:bg-emerald-600',
    active: 'bg-emerald-400 dark:bg-emerald-500 animate-pulse',
  },
};

/** 타임라인에서 각 단계의 상대적 소요시간을 계산 */
export function computeSegments(
  timeline: PipelineTimeline,
  stages: Record<string, { status: string }>,
  elapsedSeconds: number,
) {
  const jobStart = new Date(timeline.jobCreatedAt).getTime();
  const totalMs = Math.max(elapsedSeconds * 1000, 1);

  // 수집: jobCreated ~ jobUpdated (or analysisStarted)
  const collectionEnd = timeline.analysisStartedAt
    ? new Date(timeline.analysisStartedAt).getTime()
    : new Date(timeline.jobUpdatedAt).getTime();
  const collectionMs = Math.max(collectionEnd - jobStart, 0);

  // 정규화: 수집과 거의 동시 (BullMQ Flow에서 자동) — 수집의 10% 추정
  const normMs = Math.round(collectionMs * 0.1);

  // 분석: analysisStarted ~ analysisCompleted
  const analysisStart = timeline.analysisStartedAt
    ? new Date(timeline.analysisStartedAt).getTime()
    : collectionEnd;
  const analysisEnd = timeline.analysisCompletedAt
    ? new Date(timeline.analysisCompletedAt).getTime()
    : timeline.reportCompletedAt
      ? new Date(timeline.reportCompletedAt).getTime()
      : jobStart + totalMs;
  const analysisMs = Math.max(analysisEnd - analysisStart, 0);

  // 리포트: analysisCompleted ~ reportCompleted
  const reportStart = timeline.analysisCompletedAt
    ? new Date(timeline.analysisCompletedAt).getTime()
    : analysisEnd;
  const reportEnd = timeline.reportCompletedAt
    ? new Date(timeline.reportCompletedAt).getTime()
    : jobStart + totalMs;
  const reportMs = Math.max(reportEnd - reportStart, 0);

  const segments = [
    { key: 'collection', ms: collectionMs - normMs },
    { key: 'normalization', ms: normMs },
    { key: 'analysis', ms: analysisMs },
    { key: 'report', ms: reportMs },
  ];

  // 전체 합계 기준 퍼센트 계산
  const totalSegmentMs = segments.reduce((sum, s) => sum + s.ms, 0) || 1;
  return segments.map(s => ({
    ...s,
    percent: Math.max(Math.round((s.ms / totalSegmentMs) * 100), 2), // 최소 2% 보장
    seconds: Math.round(s.ms / 1000),
  }));
}

export function TimelineBar({ timeline, stages, elapsedSeconds }: TimelineBarProps) {
  const segments = computeSegments(timeline, stages, elapsedSeconds);
  // 퍼센트 합계를 100%로 정규화
  const totalPercent = segments.reduce((sum, s) => sum + s.percent, 0);
  const normalized = segments.map(s => ({
    ...s,
    percent: Math.round((s.percent / totalPercent) * 100),
  }));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>타임라인</span>
        <span className="ml-auto font-mono">{formatElapsed(elapsedSeconds)}</span>
      </div>
      <div className="flex h-6 w-full rounded-md overflow-hidden bg-muted/50 border">
        <TooltipProvider delay={200}>
          {normalized.map((seg) => {
            const status = (stages[seg.key]?.status ?? 'pending') as StageStatus;
            const stepLabel = PIPELINE_STEPS.find(s => s.key === seg.key)?.label ?? seg.key;
            const colors = STAGE_COLORS[seg.key];
            const isActive = status === 'running';
            const isCompleted = status === 'completed';
            const isSkipped = status === 'skipped' || status === 'failed';
            const isPending = status === 'pending';

            return (
              <Tooltip key={seg.key}>
                <TooltipTrigger
                  className={`
                    flex items-center justify-center text-[10px] font-medium text-white transition-all cursor-default
                    ${isActive ? colors.active : ''}
                    ${isCompleted ? colors.bg : ''}
                    ${isSkipped ? 'bg-red-400/60 dark:bg-red-800/60' : ''}
                    ${isPending ? 'bg-muted-foreground/20' : ''}
                  `}
                  style={{ width: `${seg.percent}%` }}
                >
                  {seg.percent > 10 && (
                    <span className={isPending ? 'text-muted-foreground' : ''}>{stepLabel}</span>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{stepLabel}</p>
                  <p className="text-muted-foreground">
                    {formatElapsed(seg.seconds)} ({seg.percent}%)
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
}
