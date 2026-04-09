'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Pause, Play, SkipForward, FastForward, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

interface Props {
  jobId: number;
  pausedAtStage: string;
  pausedAt: string;
}

const STAGE_LABELS: Record<string, string> = {
  collection: '수집',
  normalize: '정규화',
  'token-optimization': '토큰 최적화',
  'item-analysis': '개별 감정 분석',
  'analysis-stage1': 'AI 분석 Stage 1',
  'analysis-stage2': 'AI 분석 Stage 2',
  'analysis-stage4': 'AI 분석 Stage 4',
};

function formatRemaining(pausedAt: string): string {
  const start = new Date(pausedAt).getTime();
  const expireAt = start + 24 * 60 * 60 * 1000;
  const remaining = expireAt - Date.now();
  if (remaining <= 0) return '만료';
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function BreakpointControl({ jobId, pausedAtStage, pausedAt }: Props) {
  const [remaining, setRemaining] = useState(() => formatRemaining(pausedAt));

  useEffect(() => {
    const t = setInterval(() => setRemaining(formatRemaining(pausedAt)), 30_000);
    return () => clearInterval(t);
  }, [pausedAt]);

  const resume = useMutation({
    mutationFn: (mode: 'continue' | 'step-once') =>
      trpcClient.analysis.resume.mutate({ jobId, mode }),
    onSuccess: (data) => toast.success(data.message),
    onError: (e: Error) => toast.error(e.message),
  });

  const runToEnd = useMutation({
    mutationFn: () => trpcClient.analysis.runToEnd.mutate({ jobId }),
    onSuccess: (data) => toast.success(data.message),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => trpcClient.pipeline.cancel.mutate({ jobId }),
    onSuccess: () => toast.success('작업이 취소되었습니다'),
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = resume.isPending || runToEnd.isPending || cancel.isPending;
  const isExpiringSoon = remaining.startsWith('0h');
  const stageLabel = STAGE_LABELS[pausedAtStage] ?? pausedAtStage;

  return (
    <div className="my-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <Pause className="h-4 w-4" />
        정지됨: {stageLabel} 완료 — 결과 확인 후 다음 작업을 선택하세요
      </div>
      <div
        className={`mb-3 text-xs ${
          isExpiringSoon ? 'font-bold text-red-600' : 'text-amber-700 dark:text-amber-300'
        }`}
      >
        ⏱ 자동 취소까지 {remaining} 남음
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => resume.mutate('continue')} disabled={isPending}>
          <Play className="mr-1 h-3 w-3" />
          다음 단계 실행
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => resume.mutate('step-once')}
          disabled={isPending}
        >
          <SkipForward className="mr-1 h-3 w-3" />한 단계만 실행
        </Button>
        <Button size="sm" variant="outline" onClick={() => runToEnd.mutate()} disabled={isPending}>
          <FastForward className="mr-1 h-3 w-3" />
          끝까지 실행
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => cancel.mutate()}
          disabled={isPending}
        >
          <X className="mr-1 h-3 w-3" />
          취소
        </Button>
      </div>
    </div>
  );
}
