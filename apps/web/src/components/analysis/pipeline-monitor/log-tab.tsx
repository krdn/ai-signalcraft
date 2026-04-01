'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Info, AlertTriangle, XCircle } from 'lucide-react';
import { formatTime } from './utils';
import type { PipelineEvent } from './types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogTabProps {
  events: PipelineEvent[];
}

const LEVEL_CONFIG = {
  info: { icon: Info, color: 'text-blue-500', label: 'INFO' },
  warn: { icon: AlertTriangle, color: 'text-amber-500', label: 'WARN' },
  error: { icon: XCircle, color: 'text-red-500', label: 'ERROR' },
} as const;

export function LogTab({ events: incomingEvents }: LogTabProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Set<string>>(new Set(['info', 'warn', 'error']));

  // 이벤트 누적 (폴링 기반 중복 제거)
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

  // 필터 적용
  const filtered = useMemo(
    () => accumulated.filter((e) => filter.has(e.level)),
    [accumulated, filter],
  );

  // 최신 항목 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length]);

  const toggleFilter = (level: string) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size > 1) next.delete(level); // 최소 1개는 유지
      } else {
        next.add(level);
      }
      return next;
    });
  };

  // 레벨별 카운트
  const counts = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0 };
    for (const e of accumulated) {
      c[e.level]++;
    }
    return c;
  }, [accumulated]);

  return (
    <div className="space-y-2">
      {/* 필터 토글 */}
      <div className="flex items-center gap-2">
        {(Object.keys(LEVEL_CONFIG) as Array<keyof typeof LEVEL_CONFIG>).map((level) => {
          const cfg = LEVEL_CONFIG[level];
          const active = filter.has(level);
          return (
            <button
              key={level}
              onClick={() => toggleFilter(level)}
              className={`
                flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors
                ${active ? 'border-current opacity-100' : 'opacity-40 border-transparent'}
                ${cfg.color}
              `}
            >
              <cfg.icon className="h-3 w-3" />
              <span>{cfg.label}</span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5 h-3.5">
                {counts[level]}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* 로그 영역 */}
      <ScrollArea className="h-[240px] rounded-md border bg-muted/20" ref={scrollRef}>
        <div className="p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">이벤트가 없습니다.</p>
          ) : (
            filtered.map((event, i) => {
              const cfg = LEVEL_CONFIG[event.level];
              const Icon = cfg.icon;
              return (
                <div
                  key={`${event.timestamp}-${i}`}
                  className="flex items-start gap-2 text-xs py-0.5 hover:bg-muted/50 rounded px-1"
                >
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 pt-0.5">
                    {formatTime(event.timestamp)}
                  </span>
                  <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <span
                    className={`break-all ${event.level === 'error' ? 'text-red-600 dark:text-red-400' : ''}`}
                  >
                    {event.message}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
