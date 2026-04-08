'use client';

import { useMemo } from 'react';
import { EXPLORE_HELP, SENTIMENT_COLORS } from './explore-help';
import { CardHelp } from '@/components/dashboard/card-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CalendarHeatmapProps {
  data:
    | Array<{ date: string; positive: number; negative: number; neutral: number; total: number }>
    | undefined;
  isLoading: boolean;
}

type DayCell = {
  date: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  dominant: 'positive' | 'negative' | 'neutral';
};

// 7행(요일) × N열(주) — GitHub contribution style
export function CalendarHeatmap({ data, isLoading }: CalendarHeatmapProps) {
  const { weeks, maxTotal } = useMemo(() => buildCalendar(data ?? []), [data]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">일자별 인텐시티</CardTitle>
          <CardHelp {...EXPLORE_HELP.calendar} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : weeks.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            데이터 없음
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <svg
                width={weeks.length * 16 + 20}
                height={7 * 16 + 20}
                className="text-muted-foreground"
              >
                {/* 요일 라벨 */}
                {['월', '수', '금'].map((label, i) => (
                  <text
                    key={label}
                    x={0}
                    y={18 + (i * 2 + 1) * 16 - 4}
                    fontSize={9}
                    fill="currentColor"
                  >
                    {label}
                  </text>
                ))}
                {weeks.map((week, wi) =>
                  week.map((cell, di) => {
                    if (!cell) return null;
                    const baseColor = SENTIMENT_COLORS[cell.dominant];
                    const intensity = maxTotal > 0 ? 0.15 + (cell.total / maxTotal) * 0.85 : 0.15;
                    const tooltipText = `${cell.date}\n전체 ${cell.total}건 · 긍 ${cell.positive} / 부 ${cell.negative} / 중 ${cell.neutral}`;
                    return (
                      <rect
                        key={`${wi}-${di}`}
                        x={20 + wi * 16}
                        y={18 + di * 16}
                        width={12}
                        height={12}
                        rx={2}
                        fill={baseColor}
                        fillOpacity={intensity}
                        stroke="currentColor"
                        strokeOpacity={0.1}
                        className="cursor-pointer transition-opacity hover:stroke-opacity-50"
                      >
                        <title>{tooltipText}</title>
                      </rect>
                    );
                  }),
                )}
              </svg>
            </div>
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span>지배 감정:</span>
              <LegendSwatch color={SENTIMENT_COLORS.positive} label="긍정" />
              <LegendSwatch color={SENTIMENT_COLORS.negative} label="부정" />
              <LegendSwatch color={SENTIMENT_COLORS.neutral} label="중립" />
              <span className="ml-auto">명도 = 건수 비례</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/** 입력 시계열을 7×N 주 그리드로 변환 */
function buildCalendar(
  rows: Array<{
    date: string;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }>,
): { weeks: Array<Array<DayCell | null>>; maxTotal: number } {
  if (rows.length === 0) return { weeks: [], maxTotal: 0 };

  const byDate = new Map<string, DayCell>();
  let maxTotal = 0;
  for (const r of rows) {
    const dominant: 'positive' | 'negative' | 'neutral' =
      r.positive >= r.negative && r.positive >= r.neutral
        ? 'positive'
        : r.negative >= r.neutral
          ? 'negative'
          : 'neutral';
    byDate.set(r.date, { ...r, dominant });
    if (r.total > maxTotal) maxTotal = r.total;
  }

  const sorted = [...rows].map((r) => r.date).sort();
  const firstStr = sorted[0]!;
  const lastStr = sorted[sorted.length - 1]!;
  const first = new Date(firstStr + 'T00:00:00');
  const last = new Date(lastStr + 'T00:00:00');

  // 월요일 시작 주 계산 (JS getDay: 0=일)
  const toMondayOffset = (d: Date) => (d.getDay() + 6) % 7;
  const startOfWeek = new Date(first);
  startOfWeek.setDate(first.getDate() - toMondayOffset(first));
  const endOfWeek = new Date(last);
  endOfWeek.setDate(last.getDate() + (6 - toMondayOffset(last)));

  const weeks: Array<Array<DayCell | null>> = [];
  const cursor = new Date(startOfWeek);
  while (cursor <= endOfWeek) {
    const week: Array<DayCell | null> = [];
    for (let i = 0; i < 7; i++) {
      const iso = cursor.toISOString().slice(0, 10);
      if (cursor >= first && cursor <= last) {
        week.push(byDate.get(iso) ?? null);
      } else {
        week.push(null);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, maxTotal };
}
