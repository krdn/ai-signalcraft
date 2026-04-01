'use client';

import { memo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Clock, RefreshCw, FileText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { trpcClient } from '@/lib/trpc';
import { formatElapsedCompact } from './utils';

interface PipelineHeaderProps {
  keyword: string;
  status: string;
  overallProgress: number;
  elapsedSeconds: number;
  isInProgress: boolean;
  isPaused: boolean;
  jobId?: number | null;
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
  jobId,
}: PipelineHeaderProps) {
  const terminalStatuses = ['completed', 'failed', 'partial_failure', 'cancelled'];
  const canRetry = jobId != null && terminalStatuses.includes(status);

  const retryMutation = useMutation({
    mutationFn: () => trpcClient.analysis.retryAnalysis.mutate({ jobId: jobId! }),
    onSuccess: (res) => toast.success(`${res.retryModules.length}개 모듈 재실행 시작`),
    onError: () => toast.error('재실행에 실패했습니다'),
  });

  const reportMutation = useMutation({
    mutationFn: () => trpcClient.analysis.regenerateReport.mutate({ jobId: jobId! }),
    onSuccess: () => toast.success('리포트 재생성 시작'),
    onError: () => toast.error('리포트 재생성에 실패했습니다'),
  });

  return (
    <div className="space-y-3">
      {/* 상단: 키워드 + 상태 + 경과시간 + 재실행 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold tracking-tight">{keyword}</h3>
          <Badge variant={statusVariant(status)}>
            {statusLabel(status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {elapsedSeconds != null && (
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatElapsedCompact(elapsedSeconds)}
            </span>
          )}
          {canRetry && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground h-7">
                <RotateCcw className="h-3 w-3" />
                재실행
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  실패 모듈 재실행
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => reportMutation.mutate()}
                  disabled={reportMutation.isPending}
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  리포트 재생성
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
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
