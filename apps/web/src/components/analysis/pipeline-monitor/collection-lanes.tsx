'use client';

import { memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  ChevronDown,
  Info,
  Ban,
  Recycle,
} from 'lucide-react';
import { AnimatedNumber } from './animated-number';
import { ItemDetailsSection } from './collection-tab';
import { SOURCE_HELP } from './constants';
import { calcRate } from './utils';
import type { SourceDetail, ReuseSummary } from './types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollectionLanesProps {
  sourceDetails: Record<string, SourceDetail>;
  errorDetails: unknown;
  elapsedSeconds: number;
  reuseSummary?: ReuseSummary | null;
}

function sourceIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    case 'cancelled':
      return <Ban className="h-3.5 w-3.5 text-zinc-400 shrink-0" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />;
  }
}

function progressBarClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500 dark:bg-green-600';
    case 'running':
      return 'bg-blue-500 dark:bg-blue-600';
    case 'failed':
      return 'bg-red-400 dark:bg-red-600';
    case 'cancelled':
      return 'bg-zinc-400 dark:bg-zinc-600';
    default:
      return 'bg-muted-foreground/20';
  }
}

export const CollectionLanes = memo(function CollectionLanes({
  sourceDetails,
  errorDetails,
  elapsedSeconds,
  reuseSummary,
}: CollectionLanesProps) {
  const sources = Object.entries(sourceDetails);
  const errors = errorDetails as Record<string, string> | null;
  const totalReused = (reuseSummary?.articles ?? 0) + (reuseSummary?.videos ?? 0);
  const bySource = reuseSummary?.bySource ?? {};

  if (sources.length === 0) {
    return <div className="text-sm text-muted-foreground py-2 text-center">수집 대기 중...</div>;
  }

  // 전체 최대 건수 (비율 바 기준)
  const maxCount = Math.max(...sources.map(([, d]) => d.count), 1);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">데이터 수집</h4>

      <AnimatePresence mode="popLayout">
        {sources.map(([key, detail]) => {
          const help = SOURCE_HELP[key];
          const isRunning = detail.status === 'running';
          const hasDetails =
            (detail.articleDetails?.length ?? 0) > 0 || (detail.videoDetails?.length ?? 0) > 0;
          const error = errors?.[key];
          const barPercent = Math.max((detail.count / maxCount) * 100, 3);
          const sourceReused = bySource[key] ?? 0;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Collapsible>
                {/* 메인 레인 */}
                <div
                  className={`rounded-md border p-2.5 space-y-1.5 ${
                    detail.status === 'failed'
                      ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {sourceIcon(detail.status)}

                    <span className="text-xs font-medium w-20 shrink-0 truncate">
                      {detail.label}
                    </span>

                    {/* 도움말 */}
                    {help && (
                      <TooltipProvider delay={300}>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <Info className="h-3 w-3 text-muted-foreground/40" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            <p>{help.description}</p>
                            <p className="text-muted-foreground mt-1">방법: {help.method}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* 진행 바 */}
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressBarClass(detail.status)}`}
                        style={{ width: `${barPercent}%` }}
                      />
                      {isRunning && (
                        <div className="absolute inset-0 animate-shimmer rounded-full" />
                      )}
                    </div>

                    {/* 재사용 뱃지 */}
                    {sourceReused > 0 && (
                      <TooltipProvider delay={300}>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium shrink-0">
                              <Recycle className="h-2.5 w-2.5" />
                              {sourceReused}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[200px]">
                            이전 수집에서 본문 {sourceReused}건 재사용 (TTL 내 동일 콘텐츠). 연결된
                            댓글도 자동 포함됩니다.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* 건수: 본문/댓글 분리 */}
                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono">
                      {isRunning && elapsedSeconds > 0 && detail.count > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {calcRate(detail.count, elapsedSeconds)}
                        </span>
                      )}
                      {/* 본문 (기사/영상/게시글) */}
                      {(detail.articles > 0 || detail.videos > 0 || detail.posts > 0) && (
                        <span className="text-xs font-medium">
                          <AnimatedNumber
                            value={detail.articles + detail.videos + detail.posts}
                            className="tabular-nums"
                          />
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            {detail.articles > 0 ? '기사' : detail.videos > 0 ? '영상' : '글'}
                          </span>
                        </span>
                      )}
                      {/* 댓글 */}
                      {detail.comments > 0 && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs font-medium">
                            <AnimatedNumber value={detail.comments} className="tabular-nums" />
                            <span className="text-[10px] text-muted-foreground ml-0.5">댓글</span>
                          </span>
                        </>
                      )}
                      {detail.count === 0 && (
                        <span className="text-muted-foreground text-[10px]">
                          {detail.status === 'cancelled' ? '중지됨' : '대기'}
                        </span>
                      )}
                      {detail.status === 'cancelled' && detail.count > 0 && (
                        <span className="text-zinc-400 text-[10px]">중지됨</span>
                      )}
                    </div>

                    {/* 상세 토글 */}
                    {hasDetails && (
                      <CollapsibleTrigger className="hover:bg-muted/50 rounded p-0.5 transition-colors">
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                      </CollapsibleTrigger>
                    )}
                  </div>

                  {/* 에러 메시지 */}
                  {detail.status === 'failed' && error && (
                    <p
                      className="text-[10px] text-red-600 dark:text-red-400 ml-6 truncate"
                      title={error}
                    >
                      {error}
                    </p>
                  )}

                  {/* 상세: 기사/영상별 댓글 수집 */}
                  <CollapsibleContent>
                    <div className="ml-6 pt-1 space-y-1">
                      {detail.articleDetails && detail.articleDetails.length > 0 && (
                        <ItemDetailsSection items={detail.articleDetails} label="기사" />
                      )}
                      {detail.videoDetails && detail.videoDetails.length > 0 && (
                        <ItemDetailsSection items={detail.videoDetails} label="영상" />
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 합계 */}
      {(() => {
        const totalArts = sources.reduce((s, [, d]) => s + d.articles + d.videos + d.posts, 0);
        const totalCmts = sources.reduce((s, [, d]) => s + d.comments, 0);
        return (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
            <span>
              {sources.filter(([, s]) => s.status === 'completed').length}/{sources.length} 소스
              완료
            </span>
            <span className="font-mono">
              본문 <AnimatedNumber value={totalArts} className="font-mono font-medium" />건
              {totalReused > 0 && (
                <span className="text-amber-600 dark:text-amber-400"> (재사용 {totalReused})</span>
              )}
              {totalCmts > 0 && (
                <>
                  {' '}
                  · 댓글 <AnimatedNumber value={totalCmts} className="font-mono font-medium" />건
                  {(reuseSummary?.comments ?? 0) > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {' '}
                      (재사용 {reuseSummary?.comments})
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        );
      })()}
    </div>
  );
});
