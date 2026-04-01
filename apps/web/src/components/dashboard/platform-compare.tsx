'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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

// 소스별 한국어 레이블 매핑
const SOURCE_LABELS: Record<string, string> = {
  naver: '네이버 뉴스',
  youtube: '유튜브',
  dcinside: 'DC갤러리',
  fmkorea: '에펨코리아',
  clien: '클리앙',
};

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
  // 소스 ID를 한국어 레이블로 변환 (커뮤니티 소스 자동 반영)
  const chartData = useMemo(() => {
    if (!data) return null;
    return data.map((item) => ({
      ...item,
      platform: SOURCE_LABELS[item.platform] ?? item.platform,
    }));
  }, [data]);
  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">소스별 감성 비교</CardTitle>
          <CardHelp {...DASHBOARD_HELP.platform} />
        </div>
      </CardHeader>
      <CardContent>
        {!chartData || chartData.length === 0 ? (
          <div
            className="flex items-center justify-center h-[200px] text-muted-foreground"
            role="status"
          >
            데이터 없음
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="platform" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12, fontFamily: 'Geist Mono, monospace' }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="positive" stackId="a" fill="var(--color-positive)" />
              <Bar dataKey="negative" stackId="a" fill="var(--color-negative)" />
              <Bar
                dataKey="neutral"
                stackId="a"
                fill="var(--color-neutral)"
                radius={[4, 4, 0, 0]}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
