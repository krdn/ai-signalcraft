'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Info, AlertTriangle, XCircle } from 'lucide-react';
import { formatTime } from './utils';
import type { PipelineEvent } from './types';

interface LiveEventFeedProps {
  events: PipelineEvent[];
}

const LEVEL_CONFIG = {
  info: { icon: Info, color: 'text-blue-500', dotColor: 'bg-blue-500' },
  warn: { icon: AlertTriangle, color: 'text-amber-500', dotColor: 'bg-amber-500' },
  error: { icon: XCircle, color: 'text-red-500', dotColor: 'bg-red-500' },
} as const;

const DEFAULT_SHOW = 10;

export const LiveEventFeed = memo(function LiveEventFeed({
  events: incomingEvents,
}: LiveEventFeedProps) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<Set<string>>(new Set(['info', 'warn', 'error']));

  // 이벤트 누적 + 중복 제거
  const [accumulated, setAccumulated] = useState<PipelineEvent[]>([]);
  useEffect(() => {
    if (!incomingEvents || incomingEvents.length === 0) return;
    setAccumulated((prev) => {
      const existing = new Set(prev.map((e) => `${e.timestamp}:${e.message}`));
      const newEvents = incomingEvents.filter((e) => !existing.has(`${e.timestamp}:${e.message}`));
      if (newEvents.length === 0) return prev;
      return [...prev, ...newEvents];
    });
  }, [incomingEvents]);

  // 필터 + 역순
  const filtered = useMemo(() => {
    const f = accumulated.filter((e) => filter.has(e.level));
    return [...f].reverse();
  }, [accumulated, filter]);

  const displayEvents = showAll ? filtered : filtered.slice(0, DEFAULT_SHOW);
  const hiddenCount = filtered.length - DEFAULT_SHOW;

  // 레벨별 카운트
  const counts = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0 };
    for (const e of accumulated) c[e.level]++;
    return c;
  }, [accumulated]);

  const toggleFilter = (level: string) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size > 1) next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* 헤더 + 필터 */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground">이벤트 로그</h4>
        <div className="flex items-center gap-1.5">
          {(Object.keys(LEVEL_CONFIG) as Array<keyof typeof LEVEL_CONFIG>).map((level) => {
            const cfg = LEVEL_CONFIG[level];
            const active = filter.has(level);
            return (
              <button
                key={level}
                onClick={() => toggleFilter(level)}
                className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full border transition-colors
                  ${active ? 'border-current opacity-100' : 'opacity-30 border-transparent'}
                  ${cfg.color}`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
                {counts[level]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 타임라인 */}
      <div className="relative">
        {/* 수직선 */}
        {displayEvents.length > 0 && (
          <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
        )}

        <AnimatePresence mode="popLayout">
          {displayEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">이벤트가 없습니다.</p>
          ) : (
            displayEvents.map((event, _i) => {
              const cfg = LEVEL_CONFIG[event.level];
              return (
                <motion.div
                  key={`${event.timestamp}-${event.message}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5 py-1 pl-0 text-xs relative"
                >
                  {/* 도트 */}
                  <span
                    className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 border-2 border-background ${cfg.dotColor}`}
                  />

                  {/* 시간 */}
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5 w-16">
                    {formatTime(event.timestamp)}
                  </span>

                  {/* 메시지 */}
                  <span
                    className={`break-all ${event.level === 'error' ? 'text-red-600 dark:text-red-400' : ''}`}
                  >
                    {event.message}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* 더 보기 */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAll ? '접기' : `더 보기 (${hiddenCount}건)`}
        </button>
      )}
    </div>
  );
});
