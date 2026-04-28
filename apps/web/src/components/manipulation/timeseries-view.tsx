'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { trpcClient } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';

interface TimeseriesViewProps {
  subscriptionId: number;
}

export function TimeseriesView({ subscriptionId }: TimeseriesViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['manipulation', 'list-by-sub', subscriptionId],
    queryFn: () =>
      trpcClient.manipulation.listRunsBySubscription.query({ subscriptionId, limit: 30 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="p-4 text-sm text-red-600">{(error as Error).message}</p>;
  }

  if (!data || data.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        이 구독의 manipulation 분석 이력이 없습니다.
      </p>
    );
  }

  // 차트용 데이터 — 시간 오름차순 (tRPC가 Date → string 직렬화)
  const chartData = [...data].reverse().map((r) => ({
    ts: String(r.startedAt),
    score: r.manipulationScore ?? 0,
    jobId: r.jobId,
  }));

  return (
    <div className="space-y-4 p-4">
      <div className="h-[220px] w-full">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey="ts" tick={{ fontSize: 10 }} hide />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <ReferenceLine y={50} stroke="#fbbf24" strokeDasharray="4 2" />
            <Line type="monotone" dataKey="score" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded border text-sm">
        <table className="w-full">
          <thead className="bg-muted text-xs">
            <tr>
              <th className="p-2 text-left">시간</th>
              <th className="p-2 text-left">jobId</th>
              <th className="p-2 text-right">점수</th>
              <th className="p-2 text-right">신뢰도</th>
              <th className="p-2 text-left">상태</th>
              <th className="p-2 text-right">상세</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const ts = new Date(String(r.startedAt)).toLocaleString('ko-KR');
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{ts}</td>
                  <td className="p-2">{r.jobId}</td>
                  <td className="p-2 text-right">
                    {r.manipulationScore != null ? r.manipulationScore.toFixed(1) : '—'}
                  </td>
                  <td className="p-2 text-right">
                    {r.confidenceFactor != null ? r.confidenceFactor.toFixed(2) : '—'}
                  </td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2 text-right">
                    <Link href={`/showcase/${r.jobId}`} className="text-blue-600 hover:underline">
                      상세 보기 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
