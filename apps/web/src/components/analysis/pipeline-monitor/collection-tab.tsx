'use client';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, Info } from 'lucide-react';
import { SOURCE_HELP } from './constants';
import { calcRate } from './utils';
import type { PipelineStatusData, SourceDetail } from './types';

interface CollectionTabProps {
  data: PipelineStatusData;
}

function sourceStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] px-1.5">
          완료
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5">
          수집 중
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive" className="text-[10px] px-1.5">실패</Badge>;
    case 'skipped':
      return <Badge variant="outline" className="text-[10px] px-1.5">건너뜀</Badge>;
    default:
      return <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5">대기</Badge>;
  }
}

export function CollectionTab({ data }: CollectionTabProps) {
  const sources = Object.entries(data.sourceDetails);
  const errorDetails = data.errorDetails as Record<string, string> | null;

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        수집 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 소스별 카드 */}
      <div className="space-y-2">
        {sources.map(([key, detail]: [string, SourceDetail]) => {
          const error = errorDetails?.[key];
          const help = SOURCE_HELP[key];
          const isRunning = detail.status === 'running';
          const isFailed = detail.status === 'failed';

          return (
            <div
              key={key}
              className={`rounded-md border p-3 space-y-2 ${
                isFailed ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20' : ''
              }`}
            >
              {/* 헤더 행 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sourceStatusBadge(detail.status)}
                  <span className="text-sm font-medium">{detail.label}</span>
                  {/* 소스 도움말 */}
                  {help && (
                    <TooltipProvider delay={300}>
                      <Tooltip>
                        <TooltipTrigger className="cursor-help">
                          <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          <p>{help.description}</p>
                          <p className="text-muted-foreground mt-1">방법: {help.method}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {/* 수집 속도 */}
                  {isRunning && data.elapsedSeconds > 0 && detail.count > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {calcRate(detail.count, data.elapsedSeconds)}
                    </span>
                  )}
                  <span className="font-mono text-muted-foreground">
                    {detail.count.toLocaleString()}건
                  </span>
                </div>
              </div>

              {/* 진행 중 프로그레스 바 */}
              {isRunning && (
                <Progress value={null} className="h-1 animate-pulse" />
              )}

              {/* 에러 상세 (인라인) */}
              {isFailed && error && (
                <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span className="break-all">{error}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 수집 합계 */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
        <span>
          {sources.filter(([, s]) => s.status === 'completed').length}/{sources.length} 소스 완료
        </span>
        <span className="font-mono">
          총 {sources.reduce((sum, [, s]) => sum + s.count, 0).toLocaleString()}건
        </span>
      </div>
    </div>
  );
}
