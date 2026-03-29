'use client';

import { memo } from 'react';
import { Database, Beaker, Coins, Timer } from 'lucide-react';
import { AnimatedNumber } from './animated-number';
import { formatCostCompact, formatElapsedCompact, formatTokens } from './utils';
import type { TokenUsage } from './types';

interface LiveStatsBarProps {
  totalCollected: number;
  completedModules: number;
  totalModules: number;
  tokenUsage: TokenUsage;
  elapsedSeconds: number;
}

export const LiveStatsBar = memo(function LiveStatsBar({
  totalCollected,
  completedModules,
  totalModules,
  tokenUsage,
  elapsedSeconds,
}: LiveStatsBarProps) {
  const totalTokens = tokenUsage.total.input + tokenUsage.total.output;

  return (
    <div className="grid grid-cols-4 gap-2">
      {/* 수집 건수 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2.5">
        <Database className="h-4 w-4 text-blue-500" />
        <AnimatedNumber
          value={totalCollected}
          className="text-lg font-bold tabular-nums"
        />
        <span className="text-[10px] text-muted-foreground">수집 건수</span>
      </div>

      {/* 분석 모듈 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2.5">
        <Beaker className="h-4 w-4 text-violet-500" />
        <div className="text-lg font-bold tabular-nums">
          <AnimatedNumber value={completedModules} />
          <span className="text-sm text-muted-foreground">/{totalModules}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">분석 모듈</span>
      </div>

      {/* 토큰/비용 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2.5">
        <Coins className="h-4 w-4 text-amber-500" />
        <AnimatedNumber
          value={totalTokens}
          format={(n) => formatTokens(n)}
          className="text-lg font-bold tabular-nums"
        />
        <span className="text-[10px] text-muted-foreground">
          토큰 ({formatCostCompact(tokenUsage.estimatedCostUsd)})
        </span>
      </div>

      {/* 경과시간 */}
      <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card p-2.5">
        <Timer className="h-4 w-4 text-emerald-500" />
        <span className="text-lg font-bold tabular-nums">
          {formatElapsedCompact(elapsedSeconds)}
        </span>
        <span className="text-[10px] text-muted-foreground">경과시간</span>
      </div>
    </div>
  );
});
