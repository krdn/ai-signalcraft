'use client';

import { useMemo } from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { Check, Minus, X } from 'lucide-react';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RecoveryPhase {
  phase: number;
  phaseName: string;
  durationMonths: number;
  keyActions: string[];
  expectedScoreGain: number;
  criticalStakeholders: string[];
  successIndicator: string;
}

interface SloCondition {
  condition: string;
  currentStatus: 'met' | 'partial' | 'unmet';
  actionRequired: string;
}

interface ReputationRecoverySimulationData {
  recoveryProbability: number;
  targetReputationScore: number;
  baselineScore: number;
  recoveryTimelineMonths: number;
  recoveryPhases: RecoveryPhase[];
  crisisTypeInfluence: {
    crisisType: 'victim' | 'accidental' | 'preventable';
    recoveryMultiplier: number;
    recommendedStrategy: string;
  };
  sloRecoveryConditions: SloCondition[];
  simulationSummary: string;
}

interface ReputationRecoverySimulationCardProps {
  data: Record<string, unknown> | null;
}

const chartConfig = {
  recoveryProbability: {
    label: '회복 확률',
    color: 'hsl(217 91% 60%)',
  },
} satisfies ChartConfig;

const CRISIS_TYPE_LABEL: Record<string, string> = {
  victim: '피해자형',
  accidental: '우발형',
  preventable: '예방가능형',
};

function getCrisisTypeBadge(crisisType: string) {
  switch (crisisType) {
    case 'victim':
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          {CRISIS_TYPE_LABEL.victim}
        </Badge>
      );
    case 'accidental':
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
          {CRISIS_TYPE_LABEL.accidental}
        </Badge>
      );
    case 'preventable':
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          {CRISIS_TYPE_LABEL.preventable}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{crisisType}</Badge>;
  }
}

function getSloStatusIcon(status: string) {
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

export function ReputationRecoverySimulationCard({ data }: ReputationRecoverySimulationCardProps) {
  const parsed = data as unknown as ReputationRecoverySimulationData | null;

  const radialData = useMemo(() => {
    if (!parsed) return [];
    return [
      {
        name: '회복 확률',
        value: parsed.recoveryProbability,
        fill: 'hsl(217 91% 60%)',
      },
    ];
  }, [parsed]);

  const topPhases = useMemo(() => {
    if (!parsed?.recoveryPhases) return [];
    return [...parsed.recoveryPhases].sort((a, b) => a.phase - b.phase).slice(0, 3);
  }, [parsed]);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span>평판 회복 시뮬레이션</span>
          {parsed && getCrisisTypeBadge(parsed.crisisTypeInfluence?.crisisType ?? 'accidental')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed ? (
          <div
            className="flex items-center justify-center h-[260px] text-muted-foreground"
            role="status"
          >
            분석 데이터 없음
          </div>
        ) : (
          <>
            {/* 회복 확률 RadialBar */}
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
                    {parsed.recoveryProbability}%
                  </text>
                </RadialBarChart>
              </ChartContainer>
            </div>

            {/* 기반선 → 목표 점수 + 타임라인 */}
            <div className="flex items-center justify-between text-xs rounded border p-2">
              <div className="text-center">
                <p className="text-muted-foreground">현재</p>
                <p className="text-lg font-bold tabular-nums">{parsed.baselineScore}</p>
              </div>
              <div className="text-center text-muted-foreground">
                <p>→</p>
                <p>{parsed.recoveryTimelineMonths}개월</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">목표</p>
                <p className="text-lg font-bold tabular-nums text-blue-500">
                  {parsed.targetReputationScore}
                </p>
              </div>
            </div>

            {/* 회복 단계 (최대 3단계) */}
            {topPhases.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">회복 로드맵</p>
                <ol className="space-y-1.5">
                  {topPhases.map((p) => (
                    <li key={p.phase} className="flex items-start gap-2 text-xs">
                      <span className="font-mono font-bold text-blue-500 shrink-0">{p.phase}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {p.phaseName}
                          <span className="text-muted-foreground font-normal ml-1">
                            ({p.durationMonths}개월, +{p.expectedScoreGain}점)
                          </span>
                        </p>
                        {p.successIndicator && (
                          <p className="text-muted-foreground truncate">{p.successIndicator}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* SLO 회복 조건 */}
            {parsed.sloRecoveryConditions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">SLO 회복 조건</p>
                <ul className="space-y-1">
                  {parsed.sloRecoveryConditions.slice(0, 4).map((cond, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      {getSloStatusIcon(cond.currentStatus)}
                      <span
                        className={cond.currentStatus === 'unmet' ? 'text-muted-foreground' : ''}
                      >
                        {cond.condition}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 시뮬레이션 요약 */}
            {parsed.simulationSummary && (
              <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                {parsed.simulationSummary}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
