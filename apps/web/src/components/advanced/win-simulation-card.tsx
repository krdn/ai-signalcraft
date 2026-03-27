'use client';

import { useMemo } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Minus, X, AlertTriangle } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';

interface WinCondition {
  condition: string;
  currentStatus: 'met' | 'partial' | 'unmet';
  importance: 'critical' | 'high' | 'medium';
}

interface LoseCondition {
  condition: string;
  currentRisk: 'high' | 'medium' | 'low';
  mitigation: string;
}

interface KeyStrategy {
  strategy: string;
  expectedImpact: string;
  priority: number;
}

interface WinSimulationData {
  winProbability: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  winConditions: WinCondition[];
  loseConditions: LoseCondition[];
  keyStrategies: KeyStrategy[];
  simulationSummary: string;
}

interface WinSimulationCardProps {
  data: Record<string, unknown> | null;
}

const chartConfig = {
  winProbability: {
    label: '승리 확률',
    color: 'hsl(142 71% 45%)',
  },
} satisfies ChartConfig;

function getConfidenceBadge(level: string) {
  switch (level) {
    case 'high':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">높음</Badge>;
    case 'medium':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">보통</Badge>;
    case 'low':
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">낮음</Badge>;
    default:
      return <Badge variant="secondary">{level}</Badge>;
  }
}

// 승리 조건 상태 아이콘
function getStatusIcon(status: string) {
  switch (status) {
    case 'met':
      return <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case 'partial':
      return <Minus className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    case 'unmet':
      return <X className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    default:
      return null;
  }
}

// 패배 조건 리스크별 색상
function getRiskColor(risk: string) {
  switch (risk) {
    case 'high':
      return 'border-red-500/30 bg-red-500/5';
    case 'medium':
      return 'border-amber-500/30 bg-amber-500/5';
    case 'low':
      return 'border-green-500/30 bg-green-500/5';
    default:
      return '';
  }
}

export function WinSimulationCard({ data }: WinSimulationCardProps) {
  const parsed = data as unknown as WinSimulationData | null;

  // RadialBar 차트 데이터
  const radialData = useMemo(() => {
    if (!parsed) return [];
    return [{ name: '승리 확률', value: parsed.winProbability, fill: 'hsl(142 71% 45%)' }];
  }, [parsed]);

  // 핵심 전략 (priority 기준 정렬)
  const sortedStrategies = useMemo(() => {
    if (!parsed?.keyStrategies) return [];
    return [...parsed.keyStrategies].sort((a, b) => a.priority - b.priority);
  }, [parsed]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            승리 시뮬레이션
            <AdvancedCardHelp {...ADVANCED_HELP.winSimulation} />
          </span>
          {parsed && getConfidenceBadge(parsed.confidenceLevel)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed ? (
          <div className="flex items-center justify-center h-[260px] text-muted-foreground" role="status">
            데이터 없음
          </div>
        ) : (
          <>
            {/* 승리 확률 원형 프로그레스 */}
            <div className="flex items-center justify-center">
              <ChartContainer config={chartConfig} className="aspect-square max-h-[140px]">
                <RadialBarChart
                  innerRadius="70%"
                  outerRadius="100%"
                  data={radialData}
                  startAngle={180}
                  endAngle={0}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    dataKey="value"
                    background={{ fill: 'hsl(var(--muted))' }}
                    cornerRadius={10}
                    angleAxisId={0}
                  />
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-2xl font-bold fill-foreground"
                  >
                    {parsed.winProbability}%
                  </text>
                </RadialBarChart>
              </ChartContainer>
            </div>

            {/* 승리 조건 체크리스트 */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">승리 조건</p>
              <ul className="space-y-1">
                {parsed.winConditions.map((cond, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {getStatusIcon(cond.currentStatus)}
                    <span className={cond.currentStatus === 'unmet' ? 'text-muted-foreground' : ''}>
                      {cond.condition}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 패배 조건 경고 리스트 */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">패배 리스크</p>
              <div className="space-y-1">
                {parsed.loseConditions.map((cond, i) => (
                  <div key={i} className={`rounded border p-2 text-xs ${getRiskColor(cond.currentRisk)}`}>
                    <div className="flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{cond.condition}</p>
                        <p className="text-muted-foreground mt-0.5">완화: {cond.mitigation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 핵심 전략 우선순위 */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">핵심 전략</p>
              <ol className="space-y-1">
                {sortedStrategies.map((strat, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-mono font-bold text-accent shrink-0">{i + 1}.</span>
                    <div>
                      <p className="font-medium">{strat.strategy}</p>
                      <p className="text-muted-foreground">{strat.expectedImpact}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* 시뮬레이션 요약 */}
            <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
              {parsed.simulationSummary}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
