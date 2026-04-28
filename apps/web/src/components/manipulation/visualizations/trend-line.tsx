'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface Props {
  data:
    | { kind: 'trend-line'; series: { ts: string; count: number; isChangePoint: boolean }[] }
    | unknown;
}

export function TrendLine({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'trend-line') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (trend-line)</span>;
  }
  const series = (data as { series: { ts: string; count: number; isChangePoint: boolean }[] })
    .series;
  if (!Array.isArray(series) || series.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  const changePoints = series.filter((s) => s.isChangePoint);
  return (
    <div data-testid="viz-trend-line" className="h-[160px] w-full">
      <ResponsiveContainer>
        <LineChart data={series}>
          <XAxis dataKey="ts" tick={{ fontSize: 10 }} hide />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#dc2626" dot={false} strokeWidth={2} />
          {changePoints.map((cp, i) => (
            <ReferenceDot key={i} x={cp.ts} y={cp.count} r={4} fill="#fbbf24" stroke="#f59e0b" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
