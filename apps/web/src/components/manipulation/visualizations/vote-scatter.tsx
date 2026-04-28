'use client';

import { ScatterChart, Scatter, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data:
    | { kind: 'vote-scatter'; points: { length: number; likes: number; isOutlier: boolean }[] }
    | unknown;
}

export function VoteScatter({ data }: Props) {
  if (!data || typeof data !== 'object' || (data as { kind?: string }).kind !== 'vote-scatter') {
    return <span className="text-xs text-muted-foreground">시각화 데이터 오류 (vote-scatter)</span>;
  }
  const points = (data as { points: { length: number; likes: number; isOutlier: boolean }[] })
    .points;
  if (!Array.isArray(points) || points.length === 0) {
    return <span className="text-xs text-muted-foreground">데이터 없음</span>;
  }
  return (
    <div data-testid="viz-vote-scatter" className="h-[180px] w-full">
      <ResponsiveContainer>
        <ScatterChart>
          <XAxis dataKey="length" name="댓글 길이" tick={{ fontSize: 10 }} />
          <YAxis dataKey="likes" name="좋아요" tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={points}>
            {points.map((p, i) => (
              <Cell key={i} fill={p.isOutlier ? '#dc2626' : '#94a3b8'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
