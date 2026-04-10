'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DominantFrame {
  name: string;
  description: string;
  strength: number;
  supportingEvidence: string[];
}

interface ThreateningFrame {
  name: string;
  description: string;
  threatLevel: 'critical' | 'high' | 'medium' | 'low';
  counterStrategy: string;
}

interface ReversibleFrame {
  name: string;
  currentPerception: string;
  potentialShift: string;
  requiredAction: string;
}

interface FrameWarData {
  dominantFrames: DominantFrame[];
  threateningFrames: ThreateningFrame[];
  reversibleFrames: ReversibleFrame[];
  battlefieldSummary: string;
}

interface FrameWarChartProps {
  data: Record<string, unknown> | null;
}

const chartConfig = {
  strength: {
    label: '프레임 강도',
    color: 'hsl(221 83% 53%)',
  },
} satisfies ChartConfig;

function getThreatBadge(level: string) {
  switch (level) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    case 'high':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">High</Badge>;
    case 'medium':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Medium</Badge>;
    case 'low':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Low</Badge>;
    default:
      return <Badge variant="secondary">{level}</Badge>;
  }
}

export function FrameWarChart({ data }: FrameWarChartProps) {
  const parsed = data as unknown as FrameWarData | null;

  // 지배적 프레임 차트 데이터 (strength 기준 내림차순)
  const dominantChartData = useMemo(() => {
    if (!parsed?.dominantFrames) return [];
    return [...parsed.dominantFrames]
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5)
      .map((f) => ({ name: f.name, strength: f.strength }));
  }, [parsed]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          프레임 전쟁
          <AdvancedCardHelp {...ADVANCED_HELP.frameWar} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed ? (
          <div
            className="flex items-center justify-center h-[260px] text-muted-foreground"
            role="status"
          >
            데이터 없음
          </div>
        ) : (
          <>
            {/* 전장 요약 */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {parsed.battlefieldSummary}
            </p>

            {/* 지배적 프레임 TOP5 BarChart */}
            {dominantChartData.length > 0 && (
              <ChartContainer config={chartConfig} className="aspect-[2/1] w-full">
                <BarChart
                  data={dominantChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    tick={{ fontSize: 11 }}
                    allowDuplicatedCategory={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="strength" fill="var(--color-strength)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            )}

            {/* 위협 프레임 (경고 카드) */}
            {parsed.threateningFrames.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">위협 프레임</p>
                {parsed.threateningFrames.map((frame, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{frame.name}</span>
                      {getThreatBadge(frame.threatLevel)}
                    </div>
                    <p className="text-xs text-muted-foreground">{frame.description}</p>
                    <p className="text-xs">
                      <span className="font-medium">대응:</span> {frame.counterStrategy}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 반전 가능 프레임 (기회 카드) */}
            {parsed.reversibleFrames.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">반전 가능 프레임</p>
                {parsed.reversibleFrames.map((frame, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-1"
                  >
                    <span className="text-sm font-medium">{frame.name}</span>
                    <p className="text-xs text-muted-foreground">현재: {frame.currentPerception}</p>
                    <p className="text-xs text-muted-foreground">반전: {frame.potentialShift}</p>
                    <p className="text-xs">
                      <span className="font-medium">필요 행동:</span> {frame.requiredAction}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
