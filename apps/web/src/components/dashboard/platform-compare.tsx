'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface PlatformData {
  platform: string;
  positive: number;
  negative: number;
  neutral: number;
}

interface PlatformCompareProps {
  data: PlatformData[] | null;
}

const chartConfig = {
  positive: {
    label: '긍정',
    color: 'hsl(142 71% 45%)', // chart-1 green
  },
  negative: {
    label: '부정',
    color: 'hsl(0 84% 60%)', // chart-2 red
  },
  neutral: {
    label: '중립',
    color: 'hsl(240 5% 64%)', // chart-3 gray
  },
} satisfies ChartConfig;

export function PlatformCompare({ data }: PlatformCompareProps) {
  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">소스별 감성 비교</CardTitle>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground" role="status">
            데이터 없음
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="platform"
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12, fontFamily: 'Geist Mono, monospace' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="positive" stackId="a" fill="var(--color-positive)" />
              <Bar dataKey="negative" stackId="a" fill="var(--color-negative)" />
              <Bar dataKey="neutral" stackId="a" fill="var(--color-neutral)" radius={[4, 4, 0, 0]} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
