'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ErrorTimelineEntry } from '@/server/trpc/routers/subscriptions';

interface ErrorTimelineChartProps {
  entries: ErrorTimelineEntry[];
}

const ERROR_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  blocked: { label: '차단', color: '#F59E0B' },
  rate_limit: { label: 'Rate Limit', color: '#EF4444' },
  parse: { label: '파싱', color: '#8B5CF6' },
  timeout: { label: '타임아웃', color: '#6B7280' },
  other: { label: '기타', color: '#1F2937' },
};

export function ErrorTimelineChart({ entries }: ErrorTimelineChartProps) {
  const chartData = useMemo(() => {
    const dayMap = new Map<string, Record<string, number>>();

    for (const entry of entries) {
      const dateKey = entry.date.slice(5);
      const existing = dayMap.get(dateKey) ?? {};
      existing[entry.errorType] = (existing[entry.errorType] ?? 0) + entry.count;
      dayMap.set(dateKey, existing);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));
  }, [entries]);

  const errorTypes = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) set.add(entry.errorType);
    return Array.from(set);
  }, [entries]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">오류 타임라인</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">기간 내 오류가 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">오류 타임라인 (7일)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => ERROR_TYPE_CONFIG[value]?.label ?? value}
              />
              {errorTypes.map((type) => (
                <Area
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stackId="1"
                  stroke={ERROR_TYPE_CONFIG[type]?.color ?? '#6B7280'}
                  fill={ERROR_TYPE_CONFIG[type]?.color ?? '#6B7280'}
                  fillOpacity={0.5}
                  name={type}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
