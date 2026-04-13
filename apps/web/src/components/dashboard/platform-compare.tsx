'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// 소스 표시 순서 및 레이블
const SOURCE_ORDER = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;
const SOURCE_LABELS: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  youtube: '유튜브',
  dcinside: 'DC인사이드',
  fmkorea: '에펨코리아',
  clien: '클리앙',
};

interface SentimentRow {
  source: string;
  sentiment: string;
  count: number;
}

interface SentimentCount {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface SourceGroup {
  source: string;
  label: string;
  articles: SentimentCount | null;
  comments: SentimentCount | null;
}

interface PlatformCompareProps {
  articles: SentimentRow[];
  comments: SentimentRow[];
}

const chartConfig = {
  positive: { label: '긍정', color: 'hsl(142 71% 45%)' },
  negative: { label: '부정', color: 'hsl(0 84% 60%)' },
  neutral: { label: '중립', color: 'hsl(240 5% 64%)' },
} satisfies ChartConfig;

function aggregateSentiment(rows: SentimentRow[], source: string): SentimentCount | null {
  const filtered = rows.filter((r) => r.source === source);
  if (filtered.length === 0) return null;
  const result = { positive: 0, negative: 0, neutral: 0, total: 0 };
  for (const r of filtered) {
    const s = r.sentiment as keyof typeof result;
    if (s === 'positive' || s === 'negative' || s === 'neutral') {
      result[s] += r.count;
    } else {
      result.neutral += r.count;
    }
    result.total += r.count;
  }
  return result;
}

// 차트용 flat 데이터로 변환 (기사/댓글 각각 한 행)
function buildChartRows(groups: SourceGroup[]) {
  const rows: Array<{
    key: string;
    label: string;
    sublabel: string;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    type: 'articles' | 'comments';
    source: string;
  }> = [];

  for (const g of groups) {
    if (g.articles) {
      rows.push({
        key: `${g.source}__articles`,
        label: g.label,
        sublabel: '기사',
        type: 'articles',
        source: g.source,
        ...g.articles,
      });
    }
    if (g.comments) {
      rows.push({
        key: `${g.source}__comments`,
        label: g.label,
        sublabel: g.source === 'youtube' ? '댓글' : g.articles ? '댓글' : '포스트',
        type: 'comments',
        source: g.source,
        ...g.comments,
      });
    }
  }
  return rows;
}

// 커스텀 X축 틱: 소스명 + 기사/댓글 서브레이블 두 줄
function CustomXAxisTick(props: Record<string, unknown>) {
  const x = props.x as number | undefined;
  const y = props.y as number | undefined;
  const payload = props.payload as { value: string } | undefined;
  if (!payload || x == null || y == null) return null;
  const [label, sublabel] = payload.value.split('||');
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={10} fill="#888">
        {sublabel}
      </text>
      <text x={0} y={0} dy={24} textAnchor="middle" fontSize={11} fill="#555">
        {label}
      </text>
    </g>
  );
}

// 커스텀 툴팁
type TooltipPayloadItem = { payload: ReturnType<typeof buildChartRows>[number] };

function CustomTooltip(props: Record<string, unknown>) {
  const active = props.active as boolean | undefined;
  const payload = props.payload as TooltipPayloadItem[] | undefined;
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-sm text-sm min-w-[160px]">
      <p className="font-semibold mb-1">
        {d.label} · {d.sublabel}
      </p>
      <p className="text-muted-foreground text-xs mb-1.5">총 {d.total.toLocaleString()}건</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-green-600">긍정</span>
          <span>
            {d.positive.toLocaleString()}건 (
            {d.total ? Math.round((d.positive / d.total) * 100) : 0}%)
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-red-500">부정</span>
          <span>
            {d.negative.toLocaleString()}건 (
            {d.total ? Math.round((d.negative / d.total) * 100) : 0}%)
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">중립</span>
          <span>
            {d.neutral.toLocaleString()}건 ({d.total ? Math.round((d.neutral / d.total) * 100) : 0}
            %)
          </span>
        </div>
      </div>
    </div>
  );
}

export function PlatformCompare({ articles, comments }: PlatformCompareProps) {
  const chartRows = useMemo(() => {
    const groups: SourceGroup[] = SOURCE_ORDER.map((src) => ({
      source: src,
      label: SOURCE_LABELS[src] ?? src,
      articles: aggregateSentiment(articles, src),
      comments: aggregateSentiment(comments, src),
    })).filter((g) => g.articles !== null || g.comments !== null);

    return buildChartRows(groups);
  }, [articles, comments]);

  const isEmpty = chartRows.length === 0;

  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">소스별 감성 비교</CardTitle>
          <CardHelp {...DASHBOARD_HELP.platform} />
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div
            className="flex items-center justify-center h-[200px] text-muted-foreground"
            role="status"
          >
            데이터 없음
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
            <BarChart
              data={chartRows}
              margin={{ top: 5, right: 10, left: 10, bottom: 30 }}
              barCategoryGap="20%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={(row: (typeof chartRows)[number]) => `${row.label}||${row.sublabel}`}
                tick={(props) => <CustomXAxisTick {...props} />}
                tickLine={false}
                height={40}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11, fontFamily: 'Geist Mono, monospace' }} />
              <ChartTooltip content={<CustomTooltip />} />
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
        {/* 소스 구분선 — 같은 소스의 기사/댓글 그룹 시각적 분리 */}
        {!isEmpty && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            각 소스별 기사(왼쪽)·댓글(오른쪽) 감성 분포 · DB 실측값 기준
          </p>
        )}
      </CardContent>
    </Card>
  );
}
