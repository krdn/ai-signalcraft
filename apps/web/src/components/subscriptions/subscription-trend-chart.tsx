'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SOURCE_LABEL_MAP, SOURCE_COLOR_MAP } from './subscription-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunRecord } from '@/server/trpc/routers/subscriptions';

interface SubscriptionTrendChartProps {
  runs: RunRecord[];
  title?: string;
  days?: number;
}

interface DayEntry {
  date: string;
  total: number;
  /** 해당 날짜에 run 자체가 한 건이라도 있었는지 (status 무관) */
  hasRuns: boolean;
  /** 소스별 합계 */
  [source: string]: number | string | boolean;
}

export function SubscriptionTrendChart({
  runs,
  title = '수집 트렌드',
  days = 7,
}: SubscriptionTrendChartProps) {
  const { chartData, sources, summary } = useMemo(() => {
    const now = Date.now();
    // SUBS-007: total(수집량)과 hasRuns(해당 일자에 run 존재 여부)를 분리 추적.
    //   - total === 0 && hasRuns === false → "수집 시도 안 됨/데이터 없음"
    //   - total === 0 && hasRuns === true  → "수집 시도는 됐으나 0건"
    const dayMap = new Map<string, DayEntry>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000);
      const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      dayMap.set(key, { date: key, total: 0, hasRuns: false });
    }

    for (const run of runs) {
      const d = new Date(run.time);
      const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const entry = dayMap.get(key);
      if (!entry) continue;
      // status 무관: run row 자체가 있으면 hasRuns=true (failed/processing도 시도된 것)
      entry.hasRuns = true;
      if (run.status !== 'completed') continue;
      const items = run.itemsCollected ?? 0;
      entry.total = (entry.total as number) + items;
      entry[run.source] = ((entry[run.source] as number) ?? 0) + items;
    }

    const chartData = Array.from(dayMap.values());

    const sourceSet = new Set<string>();
    for (const run of runs) sourceSet.add(run.source);
    const sources = Array.from(sourceSet);

    // SUBS-008: 스크린리더용 요약. 합계 / 최고치 일자.
    const totalSum = chartData.reduce((s, d) => s + d.total, 0);
    const peak = chartData.reduce(
      (best, d) => (d.total > best.total ? d : best),
      chartData[0] ?? { date: '-', total: 0, hasRuns: false },
    );
    const noDataDays = chartData.filter((d) => !d.hasRuns).map((d) => d.date);

    return {
      chartData,
      sources,
      summary: {
        totalSum,
        peakDate: peak?.date ?? '-',
        peakValue: peak?.total ?? 0,
        noDataDays,
      },
    };
  }, [runs, days]);

  // SUBS-008: 차트 컨테이너용 aria-label. 추세·합계·최고치를 한 문장으로 요약.
  const ariaLabel =
    `최근 ${days}일 수집 트렌드. 총 ${summary.totalSum.toLocaleString()}건` +
    (summary.peakValue > 0
      ? `, ${summary.peakDate} 최고 ${summary.peakValue.toLocaleString()}건`
      : '') +
    (summary.noDataDays.length > 0 ? `. 데이터 없는 날짜: ${summary.noDataDays.join(', ')}` : '');

  return (
    <Card>
      <CardHeader className="pb-2">
        {/* SUBS-013: 페이지 내 섹션 heading. CardTitle을 h2로 위계화. */}
        <CardTitle as="h2" className="text-sm font-medium">
          {title} ({days}일)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/*
          SUBS-008: 차트 시각 영역에 role="img" + aria-label로 요약 정보를 제공하고,
          sr-only <table>을 동반해 스크린리더 사용자가 일자별 수치를 표 형태로 읽을 수 있게.
        */}
        <div className="h-[240px]" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                dataKey="date"
                tick={(props) => {
                  // SUBS-007: hasRuns=false인 날짜는 X축 라벨에 시각 단서를 추가해 0건과 구분.
                  const { x, y, payload } = props;
                  const entry = chartData.find((d) => d.date === payload.value);
                  const isNoData = entry && !entry.hasRuns;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text
                        x={0}
                        y={0}
                        dy={12}
                        textAnchor="middle"
                        className={isNoData ? 'fill-muted-foreground/60' : 'fill-foreground'}
                        fontSize={11}
                      >
                        {payload.value}
                      </text>
                      {isNoData ? (
                        <text
                          x={0}
                          y={0}
                          dy={24}
                          textAnchor="middle"
                          className="fill-muted-foreground/60"
                          fontSize={9}
                        >
                          (없음)
                        </text>
                      ) : null}
                    </g>
                  );
                }}
                height={summary.noDataDays.length > 0 ? 36 : 24}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: 600 }}
                formatter={(value, name) => {
                  const num = typeof value === 'number' ? value : Number(value ?? 0);
                  const key = typeof name === 'string' ? name : String(name);
                  return [
                    num.toLocaleString() + '건',
                    SOURCE_LABEL_MAP[key] ?? (key === 'total' ? '합계' : key),
                  ];
                }}
                labelFormatter={(label) => {
                  const key = typeof label === 'string' ? label : String(label ?? '');
                  const entry = chartData.find((d) => d.date === key);
                  if (!entry) return key;
                  if (!entry.hasRuns) return `${key} — 데이터 없음`;
                  return key;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) =>
                  value === 'total' ? '합계' : (SOURCE_LABEL_MAP[value] ?? value)
                }
              />
              {sources.map((source) => (
                <Bar
                  key={source}
                  dataKey={source}
                  stackId="sources"
                  fill={SOURCE_COLOR_MAP[source] ?? '#94A3B8'}
                  radius={[2, 2, 0, 0]}
                  name={source}
                />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                stroke="#6366F1"
                strokeWidth={2}
                dot={false}
                name="합계"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* SUBS-007: 데이터 없는 날짜 캡션 */}
        {summary.noDataDays.length > 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            ※ {summary.noDataDays.join(', ')}: 수집 기록 없음 (0건과 구분)
          </p>
        ) : null}

        {/* SUBS-008: sr-only 데이터 테이블 — 스크린리더용 일자별 수치 */}
        <table className="sr-only">
          <caption>
            {title} ({days}일) 일자별 수집량
          </caption>
          <thead>
            <tr>
              <th scope="col">일자</th>
              <th scope="col">합계</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.total.toLocaleString()}건</td>
                <td>{d.hasRuns ? '수집됨' : '데이터 없음'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
