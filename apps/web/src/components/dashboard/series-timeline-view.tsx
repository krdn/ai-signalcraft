'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUpIcon, TrendingDownIcon, MinusIcon, ArrowRightIcon } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SeriesTimelineViewProps {
  seriesId: number;
  currentJobId: number;
}

export function SeriesTimelineView({ seriesId, currentJobId }: SeriesTimelineViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['series', 'getTimelineData', seriesId],
    queryFn: () => trpcClient.series.getTimelineData.query({ seriesId }),
    enabled: !!seriesId,
    staleTime: 30_000,
  });

  const { data: currentDelta } = useQuery({
    queryKey: ['series', 'getDelta', currentJobId],
    queryFn: () => trpcClient.series.getDelta.query({ jobId: currentJobId }),
    enabled: !!currentJobId,
    staleTime: 30_000,
  });

  if (isLoading || !data) return null;
  if (data.timelinePoints.length < 2) return null;

  const chartData = data.timelinePoints.map((p) => ({
    name: p.startDate
      ? new Date(p.startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : `#${p.seriesOrder}`,
    긍정: Math.round((p.sentimentRatio?.positive ?? 0) * 100),
    부정: Math.round((p.sentimentRatio?.negative ?? 0) * 100),
    중립: Math.round((p.sentimentRatio?.neutral ?? 0) * 100),
    언급량: p.mentions,
    jobId: p.jobId,
  }));

  const delta = currentDelta?.quantitativeDelta as any;
  const interpretation = currentDelta?.qualitativeInterpretation as any;

  return (
    <div className="space-y-4">
      {delta && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              이전 분석 대비 변화
              {delta.overallDirection.before !== delta.overallDirection.after && (
                <Badge variant="outline" className="text-xs">
                  {delta.overallDirection.before} <ArrowRightIcon className="h-3 w-3 inline mx-1" />{' '}
                  {delta.overallDirection.after}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <DeltaIndicator
                label="긍정"
                value={delta.sentiment.delta.positive}
                format="percent"
              />
              <DeltaIndicator
                label="부정"
                value={delta.sentiment.delta.negative}
                format="percent"
                invertColor
              />
              <DeltaIndicator
                label="언급량"
                value={delta.mentions.deltaPercent}
                format="number"
                suffix="%"
              />
            </div>
            {interpretation?.summary && (
              <p className="text-sm text-muted-foreground mt-3 border-t pt-3">
                {interpretation.summary}
              </p>
            )}
            {delta.keywords.appeared.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-xs text-muted-foreground">새 키워드:</span>
                {delta.keywords.appeared.slice(0, 5).map((kw: string) => (
                  <Badge key={kw} variant="secondary" className="text-xs">
                    {kw}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">감성 비율 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis unit="%" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="긍정" stroke="#22c55e" strokeWidth={2} dot />
              <Line type="monotone" dataKey="부정" stroke="#ef4444" strokeWidth={2} dot />
              <Line type="monotone" dataKey="중립" stroke="#6b7280" strokeWidth={1.5} dot />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">언급량 추이</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="언급량" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function DeltaIndicator({
  label,
  value,
  format,
  suffix = '',
  invertColor = false,
}: {
  label: string;
  value: number;
  format: 'percent' | 'number';
  suffix?: string;
  invertColor?: boolean;
}) {
  const formatted =
    format === 'percent'
      ? `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%p`
      : `${value > 0 ? '+' : ''}${value}${suffix}`;

  const isPositive = invertColor ? value < 0 : value > 0;
  const isNegative = invertColor ? value > 0 : value < 0;
  const Icon = isPositive ? TrendingUpIcon : isNegative ? TrendingDownIcon : MinusIcon;
  const color = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500';

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-lg font-semibold">{formatted}</span>
      </div>
    </div>
  );
}
