'use client';

import { useMemo } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface SentimentChartProps {
  data: { positive: number; negative: number; neutral: number } | null;
}

const chartConfig = {
  positive: {
    label: '긍정',
    color: 'hsl(142 71% 45%)', // chart-1
  },
  negative: {
    label: '부정',
    color: 'hsl(0 84% 60%)', // chart-2
  },
  neutral: {
    label: '중립',
    color: 'hsl(240 5% 64%)', // chart-3
  },
} satisfies ChartConfig;

const COLORS = [
  'hsl(142 71% 45%)', // 긍정 - green
  'hsl(0 84% 60%)', // 부정 - red
  'hsl(240 5% 64%)', // 중립 - gray
];

export function SentimentChart({ data }: SentimentChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'positive', value: data.positive, fill: COLORS[0] },
      { name: 'negative', value: data.negative, fill: COLORS[1] },
      { name: 'neutral', value: data.neutral, fill: COLORS[2] },
    ];
  }, [data]);

  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">감성 비율</CardTitle>
          <CardHelp {...DASHBOARD_HELP.sentiment} />
        </div>
      </CardHeader>
      <CardContent>
        {!data || (data.positive === 0 && data.negative === 0 && data.neutral === 0) ? (
          <div
            className="flex items-center justify-center h-[200px] text-muted-foreground"
            role="status"
          >
            데이터 없음
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
