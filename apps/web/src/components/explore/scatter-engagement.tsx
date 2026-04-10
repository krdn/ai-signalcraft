'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { EXPLORE_HELP, SENTIMENT_COLORS } from './explore-help';
import { CardHelp } from '@/components/dashboard/card-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SOURCE_LABELS } from '@/components/dashboard/collected-data-shared';

interface ScatterRow {
  id: number;
  source: string;
  likeCount: number;
  sentiment: string;
  sentimentScore: number;
  contentPreview: string;
  articleId: number | null;
  publishedAt: string | null;
}

interface ScatterEngagementProps {
  data: ScatterRow[] | undefined;
  isLoading: boolean;
}

const scatterChartConfig = {
  positive: { label: '긍정', color: SENTIMENT_COLORS.positive },
  negative: { label: '부정', color: SENTIMENT_COLORS.negative },
  neutral: { label: '중립', color: SENTIMENT_COLORS.neutral },
} satisfies ChartConfig;

export function ScatterEngagement({ data, isLoading }: ScatterEngagementProps) {
  const [logScale, setLogScale] = useState(true);
  const [selected, setSelected] = useState<ScatterRow | null>(null);

  const { positive, negative, neutral } = useMemo(() => {
    const p: ScatterRow[] = [];
    const n: ScatterRow[] = [];
    const u: ScatterRow[] = [];
    for (const r of data ?? []) {
      // log scale 사용 시 0은 1로 대체 (log(0) 방지)
      const x = logScale ? Math.max(1, r.likeCount) : r.likeCount;
      const point = { ...r, x, y: r.sentimentScore };
      if (r.sentiment === 'positive') p.push(point);
      else if (r.sentiment === 'negative') n.push(point);
      else u.push(point);
    }
    return { positive: p, negative: n, neutral: u };
  }, [data, logScale]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">인게이지먼트 × 감정</CardTitle>
            <CardHelp {...EXPLORE_HELP.scatter} />
          </div>
          <Button
            size="sm"
            variant={logScale ? 'default' : 'outline'}
            onClick={() => setLogScale((v) => !v)}
            className="h-7 text-xs px-2"
          >
            {logScale ? 'Log X' : 'Linear X'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
            댓글 데이터 없음
          </div>
        ) : (
          <ChartContainer config={scatterChartConfig} className="h-[260px] w-full">
            <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                type="number"
                dataKey="x"
                name="좋아요"
                scale={logScale ? 'log' : 'linear'}
                domain={['auto', 'auto']}
                tick={{ fontSize: 10 }}
                label={{
                  value: logScale ? '좋아요 (log)' : '좋아요',
                  position: 'insideBottom',
                  offset: -8,
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="확신도"
                domain={[0, 1]}
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              <ZAxis range={[40, 40]} />
              <RTooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const p = payload[0]?.payload as ScatterRow | undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded-md border bg-background p-2 text-xs shadow-md max-w-xs">
                      <div className="font-semibold mb-1">
                        {SOURCE_LABELS[p.source] ?? p.source} · 좋아요 {p.likeCount}
                      </div>
                      <div className="text-muted-foreground truncate">{p.contentPreview}</div>
                    </div>
                  );
                }}
              />
              <Scatter
                name="긍정"
                data={positive}
                fill={SENTIMENT_COLORS.positive}
                onClick={(e: unknown) =>
                  setSelected((e as { payload?: ScatterRow }).payload ?? null)
                }
              />
              <Scatter
                name="부정"
                data={negative}
                fill={SENTIMENT_COLORS.negative}
                onClick={(e: unknown) =>
                  setSelected((e as { payload?: ScatterRow }).payload ?? null)
                }
              />
              <Scatter
                name="중립"
                data={neutral}
                fill={SENTIMENT_COLORS.neutral}
                onClick={(e: unknown) =>
                  setSelected((e as { payload?: ScatterRow }).payload ?? null)
                }
              />
            </ScatterChart>
          </ChartContainer>
        )}
      </CardContent>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>댓글 상세</DialogTitle>
            <DialogDescription>
              {selected && (SOURCE_LABELS[selected.source] ?? selected.source)} · 좋아요{' '}
              {selected?.likeCount} · 확신도{' '}
              {selected ? Math.round(selected.sentimentScore * 100) : 0}%
              {selected?.publishedAt && ` · ${selected.publishedAt.slice(0, 10)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">
            {selected?.contentPreview}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
