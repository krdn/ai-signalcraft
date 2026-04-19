'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SOURCE_LABEL_MAP } from './subscription-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunRecord } from '@/server/trpc/routers/subscriptions';

interface SourceRunStatsProps {
  runs: RunRecord[];
}

export function SourceRunStats({ runs }: SourceRunStatsProps) {
  const chartData = useMemo(() => {
    const now = Date.now();
    const h24Ago = now - 24 * 3600 * 1000;
    const recent = runs.filter((r) => new Date(r.time).getTime() >= h24Ago);

    const bySource = new Map<string, { completed: number; failed: number; blocked: number }>();
    for (const r of recent) {
      const entry = bySource.get(r.source) ?? { completed: 0, failed: 0, blocked: 0 };
      if (r.status === 'completed') entry.completed++;
      else if (r.status === 'failed') entry.failed++;
      else if (r.status === 'blocked') entry.blocked++;
      bySource.set(r.source, entry);
    }

    return Array.from(bySource.entries()).map(([source, data]) => ({
      source: SOURCE_LABEL_MAP[source] ?? source,
      ...data,
    }));
  }, [runs]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">소스별 실행 통계 (24시간)</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">데이터가 없습니다</p>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={50} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="completed"
                  stackId="a"
                  fill="#10B981"
                  name="완료"
                  radius={[0, 2, 2, 0]}
                />
                <Bar dataKey="failed" stackId="a" fill="#EF4444" name="실패" />
                <Bar
                  dataKey="blocked"
                  stackId="a"
                  fill="#F59E0B"
                  name="차단"
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
