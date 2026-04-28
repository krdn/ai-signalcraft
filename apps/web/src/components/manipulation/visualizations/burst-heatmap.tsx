'use client';

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data:
    | { kind: 'burst-heatmap'; buckets: { ts: string; count: number; zScore: number }[] }
    | unknown;
}

function colorForZ(z: number): string {
  if (z >= 3) return '#dc2626';
  if (z >= 2) return '#f97316';
  if (z >= 1) return '#eab308';
  return '#94a3b8';
}

export function BurstHeatmap({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'burst-heatmap') {
    return (
      <span className="text-xs text-muted-foreground">시각화 데이터 오류 (burst-heatmap)</span>
    );
  }
  const buckets = (data as { buckets: { ts: string; count: number; zScore: number }[] }).buckets;
  if (!Array.isArray(buckets) || buckets.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  return (
    <div data-testid="viz-burst-heatmap" className="h-[160px] w-full">
      <ResponsiveContainer>
        <BarChart data={buckets}>
          <XAxis dataKey="ts" tick={{ fontSize: 10 }} hide />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v, _n, p) => [
              `${v} (z=${(p?.payload as { zScore?: number })?.zScore?.toFixed(2)})`,
              '댓글 수',
            ]}
          />
          <Bar dataKey="count">
            {buckets.map((b, i) => (
              <Cell key={i} fill={colorForZ(b.zScore)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
