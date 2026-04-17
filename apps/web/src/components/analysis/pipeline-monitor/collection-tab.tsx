'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Info,
  CheckCircle2,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { SOURCE_HELP } from './constants';
import { calcRate } from './utils';
import type { PipelineStatusData, SourceDetail, ItemDetail } from './types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface CollectionTabProps {
  data: PipelineStatusData;
}

function sourceStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge
          variant="default"
          className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] px-1.5"
        >
          완료
        </Badge>
      );
    case 'running':
      return (
        <Badge
          variant="secondary"
          className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5"
        >
          수집 중
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5">
          실패
        </Badge>
      );
    case 'skipped':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5">
          건너뜀
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5">
          대기
        </Badge>
      );
  }
}

function itemStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />;
    case 'running':
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />;
    default:
      return <Clock className="h-3 w-3 text-muted-foreground/50 shrink-0" />;
  }
}

/** 기사/영상별 댓글 수집 상세 리스트 */
export function ItemDetailsSection({
  items,
  label,
}: {
  items: ItemDetail[];
  label: string; // "기사" 또는 "영상"
}) {
  // 10건 이상이면 기본 접힘
  const [expanded, setExpanded] = useState(items.length < 10);

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const totalComments = items.reduce((sum, i) => sum + i.comments, 0);

  return (
    <div className="space-y-1.5">
      {/* 접기/펼치기 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <MessageSquare className="h-3 w-3" />
        <span>{label}별 댓글 수집 현황</span>
        <span className="ml-auto font-mono">
          {completedCount}/{items.length}건 완료 · 댓글 {totalComments.toLocaleString()}건
        </span>
      </button>

      {/* 상세 리스트 */}
      {expanded && (
        <div className="ml-4 space-y-0.5 max-h-[200px] overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 text-[11px] py-0.5 px-1.5 rounded ${
                item.status === 'running' ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
              }`}
            >
              {itemStatusIcon(item.status)}
              <span className="truncate flex-1 min-w-0">{item.title}</span>
              <span
                className={`font-mono shrink-0 ${
                  item.status === 'running'
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-muted-foreground'
                }`}
              >
                {item.comments > 0
                  ? `${item.comments}건`
                  : item.status === 'pending'
                    ? '대기'
                    : '-'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollectionTab({ data }: CollectionTabProps) {
  const sources = Object.entries(data.sourceDetails);
  const errorDetails = data.errorDetails as Record<string, string> | null;

  // TTL 기반 재사용 요약 (progress._reuse 에 flows.ts 가 기록)
  const reuseSummary = (data.progress as Record<string, unknown> | null)?._reuse as
    | { articles: number; videos: number; forceRefetch?: boolean; evaluatedAt?: string }
    | undefined;
  const totalReused = (reuseSummary?.articles ?? 0) + (reuseSummary?.videos ?? 0);

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">수집 데이터가 없습니다.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* 재사용 배지 — 이전 수집 결과를 재활용한 경우 표시 */}
      {totalReused > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 px-3 py-2">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <span className="font-medium">TTL 재사용</span>
            <span className="ml-1">
              이전 수집 결과를 재활용했습니다 — 기사 {reuseSummary?.articles ?? 0}건, 영상{' '}
              {reuseSummary?.videos ?? 0}건{reuseSummary?.forceRefetch ? ' (forceRefetch=on)' : ''}
            </span>
          </div>
        </div>
      )}

      {/* 소스별 카드 */}
      <div className="space-y-2">
        {sources.map(([key, detail]: [string, SourceDetail]) => {
          const error = errorDetails?.[key];
          const help = SOURCE_HELP[key];
          const isRunning = detail.status === 'running';
          const isFailed = detail.status === 'failed';
          const hasArticleDetails = detail.articleDetails && detail.articleDetails.length > 0;
          const hasVideoDetails = detail.videoDetails && detail.videoDetails.length > 0;

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
              {isRunning && <Progress value={null} className="h-1 animate-pulse" />}

              {/* 기사별 댓글 수집 현황 */}
              {hasArticleDetails && (
                <ItemDetailsSection items={detail.articleDetails!} label="기사" />
              )}

              {/* 영상별 댓글 수집 현황 */}
              {hasVideoDetails && <ItemDetailsSection items={detail.videoDetails!} label="영상" />}

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
