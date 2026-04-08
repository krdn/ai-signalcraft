'use client';

import { useMemo } from 'react';
import { EXPLORE_HELP, SENTIMENT_COLORS } from './explore-help';
import { CardHelp } from '@/components/dashboard/card-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SOURCE_LABELS } from '@/components/dashboard/collected-data-shared';

interface SourceSentimentMatrixProps {
  data: Array<{ source: string; sentiment: string; count: number }> | undefined;
  isLoading: boolean;
  onSelectSource?: (source: string) => void;
}

const SENTIMENT_ORDER = ['positive', 'negative', 'neutral'] as const;
const SENTIMENT_LABEL: Record<string, string> = {
  positive: '긍정',
  negative: '부정',
  neutral: '중립',
};

export function SourceSentimentMatrix({
  data,
  isLoading,
  onSelectSource,
}: SourceSentimentMatrixProps) {
  const rows = useMemo(() => {
    if (!data) return [];
    const bySource = new Map<string, { positive: number; negative: number; neutral: number }>();
    for (const r of data) {
      const entry = bySource.get(r.source) ?? { positive: 0, negative: 0, neutral: 0 };
      if (r.sentiment === 'positive') entry.positive += r.count;
      else if (r.sentiment === 'negative') entry.negative += r.count;
      else entry.neutral += r.count;
      bySource.set(r.source, entry);
    }
    return Array.from(bySource.entries())
      .map(([source, c]) => {
        const total = c.positive + c.negative + c.neutral;
        return { source, ...c, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">소스 × 감정</CardTitle>
          <CardHelp {...EXPLORE_HELP.matrix} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
            데이터 없음
          </div>
        ) : (
          <div className="space-y-1">
            {/* 헤더 */}
            <div className="grid grid-cols-[100px_1fr_1fr_1fr_60px] gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1">
              <span>소스</span>
              <span className="text-center">긍정</span>
              <span className="text-center">부정</span>
              <span className="text-center">중립</span>
              <span className="text-right">합계</span>
            </div>
            {rows.map((row) => (
              <button
                key={row.source}
                type="button"
                onClick={() => onSelectSource?.(row.source)}
                className="w-full grid grid-cols-[100px_1fr_1fr_1fr_60px] gap-2 items-center hover:bg-muted/40 rounded-md px-1 py-1 text-xs transition-colors"
                aria-label={`${SOURCE_LABELS[row.source] ?? row.source} 필터`}
              >
                <span className="text-left font-medium truncate">
                  {SOURCE_LABELS[row.source] ?? row.source}
                </span>
                {SENTIMENT_ORDER.map((s) => {
                  const count = row[s];
                  const ratio = row.total > 0 ? count / row.total : 0;
                  return (
                    <div key={s} className="relative h-6 rounded overflow-hidden bg-muted/30">
                      <div
                        className="absolute inset-y-0 left-0 transition-all"
                        style={{
                          width: `${ratio * 100}%`,
                          background: SENTIMENT_COLORS[s],
                          opacity: 0.35 + ratio * 0.55,
                        }}
                        aria-label={`${SENTIMENT_LABEL[s]} ${Math.round(ratio * 100)}%`}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-medium text-foreground/80">
                        {Math.round(ratio * 100)}% ({count})
                      </span>
                    </div>
                  );
                })}
                <span className="text-right font-mono text-muted-foreground tabular-nums">
                  {row.total}
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
