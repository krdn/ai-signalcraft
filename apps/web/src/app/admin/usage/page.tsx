'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpcClient } from '@/lib/trpc';

type Period = '7d' | '30d' | '90d';

function getDateRange(period: Period) {
  const end = new Date();
  const start = new Date();
  if (period === '7d') start.setDate(start.getDate() - 7);
  else if (period === '30d') start.setDate(start.getDate() - 30);
  else start.setDate(start.getDate() - 90);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export default function AdminUsagePage() {
  const [period, setPeriod] = useState<Period>('30d');
  const range = useMemo(() => getDateRange(period), [period]);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin', 'usage', 'summary', period],
    queryFn: () => trpcClient.admin.usage.summary.query(range),
  });

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: ['admin', 'usage', 'trend', period],
    queryFn: () => trpcClient.admin.usage.trend.query(range),
  });

  const { data: byModule } = useQuery({
    queryKey: ['admin', 'usage', 'byModule', period],
    queryFn: () => trpcClient.admin.usage.byModule.query(range),
  });

  const totalCost = summary?.reduce((sum, r) => sum + r.estimatedCostUsd, 0) ?? 0;
  const totalTokens = summary?.reduce((sum, r) => sum + r.totalTokens, 0) ?? 0;
  const totalAnalyses = summary?.reduce((sum, r) => sum + r.analysisCount, 0) ?? 0;

  // 모듈별 집계 (모델 구분 없이)
  const moduleData = useMemo(() => {
    if (!byModule) return [];
    const map = new Map<string, number>();
    for (const row of byModule) {
      map.set(row.module, (map.get(row.module) ?? 0) + row.estimatedCostUsd);
    }
    return Array.from(map.entries())
      .map(([module, cost]) => ({ module, cost: Math.round(cost * 100) / 100 }))
      .sort((a, b) => b.cost - a.cost);
  }, [byModule]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">비용/사용량</h1>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? '7일' : p === '30d' ? '30일' : '90일'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">총 비용 (추정)</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">${Math.round(totalCost * 100) / 100}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">총 토큰</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {totalTokens > 1_000_000
                  ? `${(totalTokens / 1_000_000).toFixed(1)}M`
                  : `${(totalTokens / 1_000).toFixed(0)}K`}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">분석 실행 횟수</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{totalAnalyses}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 일별 비용 추이 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">일별 비용 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : trend && trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                  }
                />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(3)}`, '비용']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('ko-KR')}
                />
                <Line
                  type="monotone"
                  dataKey="estimatedCostUsd"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      {/* 모듈별 비용 분포 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">모듈별 비용</CardTitle>
        </CardHeader>
        <CardContent>
          {moduleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moduleData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <YAxis dataKey="module" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(3)}`, '비용']} />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      {/* 프로바이더/모델별 상세 */}
      {summary && summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">프로바이더/모델별 상세</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">프로바이더/모델별 사용량 상세</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-left py-2 px-2">
                      프로바이더
                    </th>
                    <th scope="col" className="text-left py-2 px-2">
                      모델
                    </th>
                    <th scope="col" className="text-right py-2 px-2">
                      입력 토큰
                    </th>
                    <th scope="col" className="text-right py-2 px-2">
                      출력 토큰
                    </th>
                    <th scope="col" className="text-right py-2 px-2">
                      비용
                    </th>
                    <th scope="col" className="text-right py-2 px-2">
                      횟수
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-2">{row.provider}</td>
                      <td className="py-2 px-2 font-mono text-xs">{row.model}</td>
                      <td className="py-2 px-2 text-right">{row.inputTokens.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right">{row.outputTokens.toLocaleString()}</td>
                      <td className="py-2 px-2 text-right font-medium">
                        ${row.estimatedCostUsd.toFixed(4)}
                      </td>
                      <td className="py-2 px-2 text-right">{row.analysisCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
