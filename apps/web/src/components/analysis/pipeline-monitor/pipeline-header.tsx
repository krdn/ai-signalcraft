'use client';

import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';
import { formatElapsedCompact } from './utils';

interface PipelineHeaderProps {
  keyword: string;
  status: string;
  overallProgress: number;
  elapsedSeconds: number;
  isInProgress: boolean;
  isPaused: boolean;
}

function statusVariant(status: string): 'destructive' | 'default' | 'secondary' | 'outline' {
  if (status === 'failed') return 'destructive';
  if (status === 'completed') return 'default';
  if (status === 'cancelled') return 'outline';
  return 'secondary';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running': return '진행 중';
    case 'completed': return '완료';
    case 'failed': return '실패';
    case 'cancelled': return '중지됨';
    case 'paused': return '일시정지';
    case 'partial_failure': return '부분 실패';
    default: return status;
  }
}

export const PipelineHeader = memo(function PipelineHeader({
  keyword,
  status,
  overallProgress,
  elapsedSeconds,
  isInProgress,
  isPaused,
}: PipelineHeaderProps) {
  return (
    <div className="space-y-3">
      {/* 상단: 키워드 + 상태 + 경과시간 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{keyword}</h3>
          <Badge variant={statusVariant(status)}>
            {statusLabel(status)}
          </Badge>
        </div>
        {elapsedSeconds != null && (
          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatElapsedCompact(elapsedSeconds)}
          </span>
        )}
      </div>

      {/* 진행률 바 + shimmer */}
      {(isInProgress || isPaused) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{isPaused ? '일시정지 중' : '전체 진행률'}</span>
            <span className="font-mono">{overallProgress}%</span>
          </div>
          <div className="relative">
            <Progress
              value={overallProgress}
              className={`h-2 ${isPaused ? 'opacity-60' : ''}`}
            />
            {isInProgress && !isPaused && (
              <div
                className="absolute inset-0 h-2 rounded-full animate-shimmer"
                style={{ borderRadius: 'inherit' }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
});
