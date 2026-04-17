'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar } from 'lucide-react';
import type { TimelinePoint } from './helpers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  timeline: TimelinePoint[];
}

type Series = 'articles' | 'videos' | 'comments';
type ScaleMode = 'dual' | 'log' | 'normalized';

const SERIES_META: Record<Series, { label: string; color: string }> = {
  articles: { label: '기사', color: '#3b82f6' },
  videos: { label: '영상', color: '#ef4444' },
  comments: { label: '댓글', color: '#22c55e' },
};

function formatTick(date: string) {
  return date.slice(5); // MM-DD
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('ko-KR');
}

export function CollectionTimeline({ timeline }: Props) {
  const [visible, setVisible] = useState<Record<Series, boolean>>({
    articles: true,
    videos: true,
    comments: true,
  });
  const [mode, setMode] = useState<ScaleMode>('dual');

  const toggle = (s: Series) => setVisible((v) => ({ ...v, [s]: !v[s] }));

  const totals = useMemo(() => {
    return timeline.reduce(
      (acc, p) => {
        acc.articles += p.articles;
        acc.videos += p.videos;
        acc.comments += p.comments;
        return acc;
      },
      { articles: 0, videos: 0, comments: 0 },
    );
  }, [timeline]);

  const chartData = useMemo(() => {
    if (mode === 'normalized') {
      return timeline.map((p) => ({
        date: p.date,
        articles: totals.articles > 0 ? (p.articles / totals.articles) * 100 : 0,
        videos: totals.videos > 0 ? (p.videos / totals.videos) * 100 : 0,
        comments: totals.comments > 0 ? (p.comments / totals.comments) * 100 : 0,
      }));
    }
    if (mode === 'log') {
      // 로그 스케일은 0을 표시할 수 없어 원 데이터를 그대로 전달하되 YAxis에서 처리
      return timeline;
    }
    return timeline;
  }, [timeline, mode, totals]);

  const isEmpty = timeline.length === 0;
  const onlyOne = timeline.length === 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            날짜별 수집량
            <span className="text-xs font-normal text-muted-foreground ml-2">KST 기준</span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 시리즈 토글 */}
            <div className="flex gap-1">
              {(Object.keys(SERIES_META) as Series[]).map((s) => {
                const meta = SERIES_META[s];
                const on = visible[s];
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant={on ? 'default' : 'outline'}
                    className="h-7 text-xs gap-1.5"
                    onClick={() => toggle(s)}
                    style={
                      on
                        ? { backgroundColor: meta.color, borderColor: meta.color, color: '#fff' }
                        : undefined
                    }
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    {meta.label}
                    <span className="opacity-75 tabular-nums">{fmt(totals[s])}</span>
                  </Button>
                );
              })}
            </div>
            {/* 스케일 모드 */}
            <div className="flex gap-1 border-l pl-2 ml-1">
              {(
                [
                  { v: 'dual', label: '이중축' },
                  { v: 'log', label: '로그' },
                  { v: 'normalized', label: '정규화' },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.v}
                  size="sm"
                  variant={mode === opt.v ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => setMode(opt.v)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            수집 기록이 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
              barCategoryGap={onlyOne ? '40%' : '15%'}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatTick} />

              {mode === 'dual' && (
                <>
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    label={{
                      value: '기사/영상',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 11, fill: '#64748b' },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    label={{
                      value: '댓글',
                      angle: 90,
                      position: 'insideRight',
                      style: { fontSize: 11, fill: '#64748b' },
                    }}
                  />
                </>
              )}
              {mode === 'log' && (
                <YAxis
                  yAxisId="left"
                  scale="log"
                  domain={[1, 'auto']}
                  allowDataOverflow
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => fmt(v)}
                />
              )}
              {mode === 'normalized' && (
                <YAxis
                  yAxisId="left"
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
              )}

              <Tooltip
                formatter={(v, name) => {
                  const num = Number(v);
                  if (mode === 'normalized') return [`${num.toFixed(1)}%`, name];
                  return [fmt(num), name];
                }}
                labelFormatter={(d) => `${d} (KST)`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />

              {/* 이중축: 기사·영상=Bar(좌), 댓글=Line(우) */}
              {mode === 'dual' ? (
                <>
                  {visible.articles && (
                    <Bar
                      yAxisId="left"
                      dataKey="articles"
                      name="기사"
                      fill={SERIES_META.articles.color}
                      fillOpacity={0.85}
                      radius={[2, 2, 0, 0]}
                    />
                  )}
                  {visible.videos && (
                    <Bar
                      yAxisId="left"
                      dataKey="videos"
                      name="영상"
                      fill={SERIES_META.videos.color}
                      fillOpacity={0.85}
                      radius={[2, 2, 0, 0]}
                    />
                  )}
                  {visible.comments && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="comments"
                      name="댓글"
                      stroke={SERIES_META.comments.color}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </>
              ) : (
                <>
                  {visible.articles && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="articles"
                      name="기사"
                      stroke={SERIES_META.articles.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  )}
                  {visible.videos && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="videos"
                      name="영상"
                      stroke={SERIES_META.videos.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  )}
                  {visible.comments && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="comments"
                      name="댓글"
                      stroke={SERIES_META.comments.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  )}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}

        <p className="text-[11px] text-muted-foreground mt-2">
          {mode === 'dual' && '좌축: 기사·영상 · 우축: 댓글 (스케일 차이 보정)'}
          {mode === 'log' && '로그 스케일 — 단위가 크게 다른 시리즈를 한 축에 비교'}
          {mode === 'normalized' && '각 시리즈의 전체 합을 100%로 정규화한 상대 분포'}
        </p>
      </CardContent>
    </Card>
  );
}
