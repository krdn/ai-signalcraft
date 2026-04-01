'use client';

import { memo } from 'react';
import { FileText, MessageSquare, Beaker, Coins, Timer } from 'lucide-react';
import { AnimatedNumber } from './animated-number';
import { formatCostCompact, formatElapsedCompact, formatTokens } from './utils';
import type { TokenUsage } from './types';

interface LiveStatsBarProps {
  totalArticles: number;
  totalComments: number;
  completedModules: number;
  totalModules: number;
  tokenUsage: TokenUsage;
  elapsedSeconds: number;
}

export const LiveStatsBar = memo(function LiveStatsBar({
  totalArticles,
  totalComments,
  completedModules,
  totalModules,
  tokenUsage,
  elapsedSeconds,
}: LiveStatsBarProps) {
  const totalTokens = tokenUsage.total.input + tokenUsage.total.output;

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {/* 본문 (기사/영상/게시글) */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2">
        <FileText className="h-3.5 w-3.5 text-blue-500" />
        <AnimatedNumber value={totalArticles} className="text-base font-bold tabular-nums" />
        <span className="text-[9px] text-muted-foreground">본문</span>
      </div>

      {/* 댓글 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2">
        <MessageSquare className="h-3.5 w-3.5 text-cyan-500" />
        <AnimatedNumber value={totalComments} className="text-base font-bold tabular-nums" />
        <span className="text-[9px] text-muted-foreground">댓글</span>
      </div>

      {/* 분석 모듈 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2">
        <Beaker className="h-3.5 w-3.5 text-violet-500" />
        <div className="text-base font-bold tabular-nums">
          <AnimatedNumber value={completedModules} />
          <span className="text-xs text-muted-foreground">/{totalModules}</span>
        </div>
        <span className="text-[9px] text-muted-foreground">분석</span>
      </div>

      {/* 토큰/비용 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2">
        <Coins className="h-3.5 w-3.5 text-amber-500" />
        <AnimatedNumber
          value={totalTokens}
          format={(n) => formatTokens(n)}
          className="text-base font-bold tabular-nums"
        />
        <span className="text-[9px] text-muted-foreground">
          {formatCostCompact(tokenUsage.estimatedCostUsd)}
        </span>
      </div>

      {/* 경과시간 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2">
        <Timer className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-base font-bold tabular-nums">
          {formatElapsedCompact(elapsedSeconds)}
        </span>
        <span className="text-[9px] text-muted-foreground">경과</span>
      </div>
    </div>
  );
});
