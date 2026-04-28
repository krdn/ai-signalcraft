'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
  data:
    | { kind: 'temporal-bars'; bars: { hour: number; current: number; baseline: number }[] }
    | unknown;
}

export function TemporalBars({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'temporal-bars') {
    return (
      <span className="text-xs text-muted-foreground">시각화 데이터 오류 (temporal-bars)</span>
    );
  }
  const bars = (data as { bars: { hour: number; current: number; baseline: number }[] }).bars;
  if (!Array.isArray(bars) || bars.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  return (
    <div data-testid="viz-temporal-bars" className="h-[180px] w-full">
      <ResponsiveContainer>
        <BarChart data={bars}>
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="baseline" fill="#94a3b8" name="기준치" />
          <Bar dataKey="current" fill="#dc2626" name="현재" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
