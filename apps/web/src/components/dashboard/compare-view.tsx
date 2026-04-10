'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface CompareViewProps {
  baseJobId: number;
  compareJobId: number;
}

// 모듈 결과 파싱 유틸
function parseModule(results: Array<{ module: string; result: unknown }>, name: string) {
  return results.find((r) => r.module === name)?.result as Record<string, unknown> | undefined;
}

// 변화량 표시 컴포넌트
function DeltaIndicator({
  before,
  after,
  suffix = '',
}: {
  before: number;
  after: number;
  suffix?: string;
}) {
  const delta = after - before;
  const sign = delta > 0 ? '+' : '';
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color =
    delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-mono ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {sign}
      {delta.toFixed(1)}
      {suffix}
    </span>
  );
}

export function CompareView({ baseJobId, compareJobId }: CompareViewProps) {
  const { data: baseResults, isLoading: baseLoading } = useQuery({
    queryKey: ['analysis', 'getResults', baseJobId],
    queryFn: () => trpcClient.analysis.getResults.query({ jobId: baseJobId }),
  });
  const { data: compareResults, isLoading: compareLoading } = useQuery({
    queryKey: ['analysis', 'getResults', compareJobId],
    queryFn: () => trpcClient.analysis.getResults.query({ jobId: compareJobId }),
  });

  if (baseLoading || compareLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const base = (baseResults ?? []) as Array<{ module: string; result: unknown }>;
  const compare = (compareResults ?? []) as Array<{ module: string; result: unknown }>;

  // 감성 비율
  const baseSentiment = parseModule(base, 'sentiment-framing')?.sentimentRatio as
    | {
        positive: number;
        negative: number;
        neutral: number;
      }
    | undefined;
  const compareSentiment = parseModule(compare, 'sentiment-framing')?.sentimentRatio as
    | {
        positive: number;
        negative: number;
        neutral: number;
      }
    | undefined;

  // 총 언급량
  const baseTrend = parseModule(base, 'macro-view')?.dailyMentionTrend as
    | Array<{ count: number }>
    | undefined;
  const compareTrend = parseModule(compare, 'macro-view')?.dailyMentionTrend as
    | Array<{ count: number }>
    | undefined;
  const baseMentions = baseTrend?.reduce((s, t) => s + t.count, 0) ?? 0;
  const compareMentions = compareTrend?.reduce((s, t) => s + t.count, 0) ?? 0;

  // 여론 방향
  const baseDirection = parseModule(base, 'macro-view')?.overallDirection as string | undefined;
  const compareDirection = parseModule(compare, 'macro-view')?.overallDirection as
    | string
    | undefined;

  // 키워드 비교
  const baseKeywords =
    (
      parseModule(base, 'sentiment-framing')?.topKeywords as Array<{ keyword: string }> | undefined
    )?.map((k) => k.keyword) ?? [];
  const compareKeywords =
    (
      parseModule(compare, 'sentiment-framing')?.topKeywords as
        | Array<{ keyword: string }>
        | undefined
    )?.map((k) => k.keyword) ?? [];
  const newKeywords = compareKeywords.filter((k) => !baseKeywords.includes(k));
  const goneKeywords = baseKeywords.filter((k) => !compareKeywords.includes(k));

  // 감성 비교 차트 데이터
  const sentimentCompareData =
    baseSentiment && compareSentiment
      ? [
          {
            name: '긍정',
            base: Math.round(baseSentiment.positive * 100),
            compare: Math.round(compareSentiment.positive * 100),
          },
          {
            name: '부정',
            base: Math.round(baseSentiment.negative * 100),
            compare: Math.round(compareSentiment.negative * 100),
          },
          {
            name: '중립',
            base: Math.round(baseSentiment.neutral * 100),
            compare: Math.round(compareSentiment.neutral * 100),
          },
        ]
      : null;

  const compareBarConfig = {
    base: { label: '기준', color: 'hsl(217 91% 60%)' },
    compare: { label: '비교', color: 'hsl(280 70% 55%)' },
  } satisfies ChartConfig;

  const directionLabel = (d?: string) =>
    d === 'positive' ? '긍정적' : d === 'negative' ? '부정적' : d === 'mixed' ? '혼합' : '—';

  return (
    <div className="space-y-6">
      {/* KPI 변화량 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">총 수집량 변화</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono">{baseMentions.toLocaleString()}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold font-mono">
                {compareMentions.toLocaleString()}
              </span>
            </div>
            <DeltaIndicator before={baseMentions} after={compareMentions} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">긍정 비율 변화</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono">
                {baseSentiment ? Math.round(baseSentiment.positive * 100) : '—'}%
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold font-mono">
                {compareSentiment ? Math.round(compareSentiment.positive * 100) : '—'}%
              </span>
            </div>
            {baseSentiment && compareSentiment && (
              <DeltaIndicator
                before={baseSentiment.positive * 100}
                after={compareSentiment.positive * 100}
                suffix="%"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">부정 비율 변화</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold font-mono">
                {baseSentiment ? Math.round(baseSentiment.negative * 100) : '—'}%
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold font-mono">
                {compareSentiment ? Math.round(compareSentiment.negative * 100) : '—'}%
              </span>
            </div>
            {baseSentiment && compareSentiment && (
              <DeltaIndicator
                before={baseSentiment.negative * 100}
                after={compareSentiment.negative * 100}
                suffix="%"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">여론 방향 변화</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{directionLabel(baseDirection)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{directionLabel(compareDirection)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 감성 비율 비교 차트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">감성 비율 비교</CardTitle>
          </CardHeader>
          <CardContent>
            {sentimentCompareData ? (
              <ChartContainer config={compareBarConfig} className="aspect-[2/1] w-full">
                <BarChart
                  data={sentimentCompareData}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12, fontFamily: 'Geist Mono, monospace' }}
                    unit="%"
                    allowDuplicatedCategory={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="base" fill="var(--color-base)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="compare" fill="var(--color-compare)" radius={[4, 4, 0, 0]} />
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                데이터 없음
              </div>
            )}
          </CardContent>
        </Card>

        {/* 키워드 변화 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">키워드 변화</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {newKeywords.length > 0 && (
              <div>
                <p className="text-xs font-medium text-emerald-500 mb-2">새로 등장한 키워드</p>
                <div className="flex flex-wrap gap-1.5">
                  {newKeywords.slice(0, 10).map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 text-xs font-medium"
                    >
                      +{k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {goneKeywords.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-500 mb-2">사라진 키워드</p>
                <div className="flex flex-wrap gap-1.5">
                  {goneKeywords.slice(0, 10).map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-red-500/10 text-red-500 px-2.5 py-0.5 text-xs font-medium"
                    >
                      -{k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {newKeywords.length === 0 && goneKeywords.length === 0 && (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                키워드 변화 없음
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
