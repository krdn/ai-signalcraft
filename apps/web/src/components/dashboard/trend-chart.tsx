'use client';

import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
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

interface TrendDataPoint {
  date: string;
  mentions: number;
  positive: number;
  negative: number;
  neutral: number;
}

interface EventMarker {
  date: string;
  label: string;
}

interface TrendChartProps {
  data: TrendDataPoint[] | null;
  events?: EventMarker[] | null;
}

const chartConfig = {
  mentions: {
    label: '전체 언급',
    color: 'hsl(217 91% 60%)', // chart-4 blue
  },
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

export function TrendChart({ data, events }: TrendChartProps) {
  // prefers-reduced-motion 시 애니메이션 비활성화
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">시계열 트렌드</CardTitle>
          <CardHelp {...DASHBOARD_HELP.trend} />
        </div>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div
            className="flex items-center justify-center h-[200px] text-muted-foreground"
            role="status"
          >
            데이터 없음
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: string) => {
                  // MM-DD 형식으로 축약
                  const parts = value.split('-');
                  return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : value;
                }}
              />
              <YAxis tick={{ fontSize: 12, fontFamily: 'Geist Mono, monospace' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="mentions"
                stroke="var(--color-mentions)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!prefersReducedMotion}
              />
              <Line
                type="monotone"
                dataKey="positive"
                stroke="var(--color-positive)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={!prefersReducedMotion}
              />
              <Line
                type="monotone"
                dataKey="negative"
                stroke="var(--color-negative)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={!prefersReducedMotion}
              />
              <Line
                type="monotone"
                dataKey="neutral"
                stroke="var(--color-neutral)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={!prefersReducedMotion}
              />
              {events?.map((evt, idx) => (
                <ReferenceLine
                  key={`${evt.date}-${idx}`}
                  x={evt.date}
                  stroke="hsl(280 70% 55%)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: evt.label,
                    position: 'top',
                    fontSize: 10,
                    fill: 'hsl(280 70% 55%)',
                  }}
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
