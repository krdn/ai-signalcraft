'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { EXPLORE_HELP } from './explore-help';
import { CardHelp } from '@/components/dashboard/card-help';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface StreamChartProps {
  data:
    | Array<{ date: string; positive: number; negative: number; neutral: number; total: number }>
    | undefined;
  isLoading: boolean;
}

const chartConfig = {
  positive: { label: '긍정', color: 'hsl(142 71% 45%)' },
  negative: { label: '부정', color: 'hsl(0 84% 60%)' },
  neutral: { label: '중립', color: 'hsl(240 5% 64%)' },
} satisfies ChartConfig;

export function StreamChart({ data, isLoading }: StreamChartProps) {
  const [mode, setMode] = useState<'percent' | 'absolute'>('percent');

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">감성 스트림</CardTitle>
            <CardHelp {...EXPLORE_HELP.stream} />
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={mode === 'percent' ? 'default' : 'outline'}
              onClick={() => setMode('percent')}
              className="h-7 text-xs px-2"
            >
              100%
            </Button>
            <Button
              size="sm"
              variant={mode === 'absolute' ? 'default' : 'outline'}
              onClick={() => setMode('absolute')}
              className="h-7 text-xs px-2"
            >
              절대량
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
            데이터 없음
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              stackOffset={mode === 'percent' ? 'expand' : 'none'}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                tickFormatter={(v: number) =>
                  mode === 'percent' ? `${Math.round(v * 100)}%` : `${v}`
                }
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="positive"
                stackId="1"
                stroke="var(--color-positive)"
                fill="var(--color-positive)"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="neutral"
                stackId="1"
                stroke="var(--color-neutral)"
                fill="var(--color-neutral)"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="negative"
                stackId="1"
                stroke="var(--color-negative)"
                fill="var(--color-negative)"
                fillOpacity={0.6}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
