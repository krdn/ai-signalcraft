'use client';

import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from 'recharts';
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
import { Skeleton } from '@/components/ui/skeleton';

interface ScoreHistogramProps {
  data:
    | Array<{
        bin: number;
        binStart: number;
        binEnd: number;
        positive: number;
        negative: number;
        neutral: number;
      }>
    | undefined;
  isLoading: boolean;
}

const chartConfig = {
  positive: { label: '긍정', color: 'hsl(142 71% 45%)' },
  negative: { label: '부정', color: 'hsl(0 84% 60%)' },
  neutral: { label: '중립', color: 'hsl(240 5% 64%)' },
} satisfies ChartConfig;

// sentiment-classifier.ts의 isAmbiguous 기준
const AMBIGUOUS_START = 0.4;
const AMBIGUOUS_END = 0.65;

export function ScoreHistogram({ data, isLoading }: ScoreHistogramProps) {
  const hasData = data && data.some((b) => b.positive + b.negative + b.neutral > 0);

  const chartData = (data ?? []).map((b) => ({
    ...b,
    label: `${(b.binStart * 100).toFixed(0)}`,
    center: (b.binStart + b.binEnd) / 2,
  }));

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">확신도 분포</CardTitle>
          <CardHelp {...EXPLORE_HELP.histogram} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
            데이터 없음
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fontFamily: 'Geist Mono, monospace' }}
                label={{
                  value: '확신도 (%)',
                  position: 'insideBottom',
                  offset: -3,
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: 'Geist Mono, monospace' }}
                allowDuplicatedCategory={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceArea
                x1={`${(AMBIGUOUS_START * 100).toFixed(0)}`}
                x2={`${(AMBIGUOUS_END * 100).toFixed(0)}`}
                fill="hsl(48 96% 53%)"
                fillOpacity={0.15}
                label={{
                  value: 'Ambiguous',
                  position: 'insideTop',
                  fontSize: 9,
                  fill: 'hsl(48 96% 30%)',
                }}
              />
              <Bar dataKey="positive" stackId="s" fill="var(--color-positive)" fillOpacity={0.85} />
              <Bar dataKey="neutral" stackId="s" fill="var(--color-neutral)" fillOpacity={0.85} />
              <Bar dataKey="negative" stackId="s" fill="var(--color-negative)" fillOpacity={0.85} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
