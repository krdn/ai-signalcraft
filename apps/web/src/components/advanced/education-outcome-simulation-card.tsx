'use client';

import { TrendingDown, TrendingUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
interface WinCondition {
  condition: string;
  status: 'met' | 'partial' | 'unmet';
  evidence: string;
  requiredAction: string;
}

interface StrategicPriority {
  priority: number;
  action: string;
  targetGroup: string;
  expectedImpact: string;
  timeframe: string;
}

interface DifferentiationOpportunity {
  area: string;
  currentState: string;
  targetState: string;
  approach: string;
}

interface Scenario {
  probability: number;
  description: string;
  keyDriver?: string;
  keyRisk?: string;
}

interface EducationOutcomeSimulationData {
  recoveryProbability: number;
  probabilityBasis: string;
  winConditions: WinCondition[];
  strategicPriorities: StrategicPriority[];
  differentiationOpportunities: DifferentiationOpportunity[];
  riskAdjustments: unknown[];
  optimisticScenario: Scenario;
  pessimisticScenario: Scenario;
  summary: string;
}

interface EducationOutcomeSimulationCardProps {
  data: Record<string, unknown> | null;
}

const CONDITION_STATUS_META: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  met: {
    icon: <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />,
    label: '달성',
    color: 'text-green-600',
  },
  partial: {
    icon: <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />,
    label: '부분',
    color: 'text-yellow-600',
  },
  unmet: {
    icon: <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
    label: '미달성',
    color: 'text-red-600',
  },
};

function getProbabilityColor(prob: number) {
  if (prob >= 70) return 'text-green-600';
  if (prob >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function getProbabilityProgressColor(prob: number) {
  if (prob >= 70) return '[&>div]:bg-green-500';
  if (prob >= 40) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-red-500';
}

export function EducationOutcomeSimulationCard({ data }: EducationOutcomeSimulationCardProps) {
  if (!data) return null;
  const d = data as unknown as EducationOutcomeSimulationData;

  const topConditions = (d.winConditions ?? []).slice(0, 4);
  const topPriorities = (d.strategicPriorities ?? []).slice(0, 3);
  const topOpportunities = (d.differentiationOpportunities ?? []).slice(0, 2);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          교육기관 목표 달성 시뮬레이션
          <AdvancedCardHelp {...ADVANCED_HELP.educationOutcomeSimulation} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 회복 확률 */}
        <div className="flex items-center gap-4 rounded-lg border p-3">
          <div className="text-center min-w-[64px]">
            <div
              className={`text-3xl font-bold ${getProbabilityColor(d.recoveryProbability ?? 0)}`}
            >
              {d.recoveryProbability ?? 0}%
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">신뢰 회복</div>
          </div>
          <div className="flex-1">
            <Progress
              value={d.recoveryProbability ?? 0}
              className={`h-2 mb-1.5 ${getProbabilityProgressColor(d.recoveryProbability ?? 0)}`}
            />
            {d.probabilityBasis && (
              <p className="text-[10px] text-muted-foreground leading-tight">
                {d.probabilityBasis}
              </p>
            )}
          </div>
        </div>

        {/* 낙관/비관 시나리오 */}
        <div className="grid grid-cols-2 gap-2">
          {d.optimisticScenario && (
            <div className="rounded-md border border-green-200 bg-green-50/50 p-2">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-[10px] font-medium text-green-700">낙관</span>
                <span className="text-[10px] text-green-600 ml-auto">
                  {d.optimisticScenario.probability}%
                </span>
              </div>
              {d.optimisticScenario.keyDriver && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {d.optimisticScenario.keyDriver}
                </p>
              )}
            </div>
          )}
          {d.pessimisticScenario && (
            <div className="rounded-md border border-red-200 bg-red-50/50 p-2">
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown className="h-3 w-3 text-red-500" />
                <span className="text-[10px] font-medium text-red-700">비관</span>
                <span className="text-[10px] text-red-600 ml-auto">
                  {d.pessimisticScenario.probability}%
                </span>
              </div>
              {d.pessimisticScenario.keyRisk && (
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {d.pessimisticScenario.keyRisk}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 목표 달성 조건 */}
        {topConditions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">목표 달성 조건</p>
            <div className="space-y-1.5">
              {topConditions.map((c, i) => {
                const meta =
                  CONDITION_STATUS_META[c.status ?? 'unmet'] ?? CONDITION_STATUS_META.unmet;
                return (
                  <div key={i} className="flex items-start gap-2">
                    {meta.icon}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] leading-tight">{c.condition}</p>
                      {c.requiredAction && c.status !== 'met' && (
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          → {c.requiredAction}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 전략 우선순위 */}
        {topPriorities.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">전략 우선순위</p>
            <div className="space-y-2">
              {topPriorities.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground min-w-[16px]">
                    {p.priority}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium leading-tight">{p.action}</p>
                    {p.expectedImpact && (
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        효과: {p.expectedImpact}
                      </p>
                    )}
                  </div>
                  {p.timeframe && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 shrink-0 bg-slate-50"
                    >
                      {p.timeframe}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 차별화 기회 */}
        {topOpportunities.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">차별화 기회</p>
            <div className="space-y-1">
              {topOpportunities.map((o, i) => (
                <div key={i} className="flex gap-1.5 text-[10px] text-muted-foreground">
                  <span className="text-blue-500 shrink-0">◆</span>
                  <span className="font-medium shrink-0">{o.area}</span>
                  {o.approach && <span className="leading-tight">— {o.approach}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 요약 */}
        {d.summary && (
          <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">{d.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
