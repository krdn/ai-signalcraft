'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SOURCE_LABEL_MAP, SOURCE_COLOR_MAP } from './subscription-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunRecord } from '@/server/trpc/routers/subscriptions';

interface SubscriptionTrendChartProps {
  runs: RunRecord[];
  title?: string;
  days?: number;
}

export function SubscriptionTrendChart({
  runs,
  title = '수집 트렌드',
  days = 7,
}: SubscriptionTrendChartProps) {
  const chartData = useMemo(() => {
    const now = Date.now();
    const dayMap = new Map<string, Record<string, number>>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000);
      const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      dayMap.set(key, { total: 0 });
    }

    for (const run of runs) {
      if (run.status !== 'completed') continue;
      const d = new Date(run.time);
      const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const entry = dayMap.get(key);
      if (!entry) continue;
      entry.total = (entry.total ?? 0) + (run.itemsCollected ?? 0);
      entry[run.source] = (entry[run.source] ?? 0) + (run.itemsCollected ?? 0);
    }

    return Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }, [runs, days]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const run of runs) set.add(run.source);
    return Array.from(set);
  }, [runs]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {title} ({days}일)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => SOURCE_LABEL_MAP[value] ?? value}
              />
              {sources.map((source) => (
                <Bar
                  key={source}
                  dataKey={source}
                  stackId="sources"
                  fill={SOURCE_COLOR_MAP[source] ?? '#94A3B8'}
                  radius={[2, 2, 0, 0]}
                  name={source}
                />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                stroke="#6366F1"
                strokeWidth={2}
                dot={false}
                name="합계"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
