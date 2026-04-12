'use client';

import { AlertTriangle, Shield, TrendingUp } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
interface ScenarioTimeline {
  shortTerm: string;
  midTerm: string;
  longTerm: string;
}

interface ReputationImpact {
  admissionsEffect: string;
  studentSatisfactionEffect: string;
  mediaFrameShift: string;
  socialContractBreach: 'severe' | 'moderate' | 'minimal' | 'none';
}

interface CrisisScenarioItem {
  type: 'spread' | 'control' | 'reverse';
  label: string;
  probability: number;
  triggerConditions: string[];
  timeline: ScenarioTimeline;
  reputationImpact: ReputationImpact;
  keyActions: string[];
  recoveryPath: string;
}

interface CrisisRoot {
  primaryTrigger: string;
  contractBreachDimensions: string[];
  vulnerableStakeholders: string[];
}

interface RecoveryFramework {
  shortTermGoals: string[];
  midTermGoals: string[];
  longTermGoals: string[];
}

interface EducationCrisisScenarioData {
  scenarios: CrisisScenarioItem[];
  crisisRoot: CrisisRoot;
  goldenHourActions: string[];
  recoveryFramework: RecoveryFramework;
  summary: string;
}

interface EducationCrisisScenarioCardProps {
  data: Record<string, unknown> | null;
}

const SCENARIO_META: Record<
  string,
  { label: string; icon: React.ReactNode; bgColor: string; borderColor: string; badgeColor: string }
> = {
  spread: {
    label: '확산 (최악)',
    icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    bgColor: 'bg-red-50/50',
    borderColor: 'border-red-200',
    badgeColor: 'bg-red-500/15 text-red-600 border-red-500/20',
  },
  control: {
    label: '통제 (보통)',
    icon: <Shield className="h-4 w-4 text-yellow-500" />,
    bgColor: 'bg-yellow-50/50',
    borderColor: 'border-yellow-200',
    badgeColor: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  },
  reverse: {
    label: '역전 (최선)',
    icon: <TrendingUp className="h-4 w-4 text-green-500" />,
    bgColor: 'bg-green-50/50',
    borderColor: 'border-green-200',
    badgeColor: 'bg-green-500/15 text-green-600 border-green-500/20',
  },
};

const CONTRACT_BREACH_LABEL: Record<string, string> = {
  severe: '심각',
  moderate: '보통',
  minimal: '경미',
  none: '없음',
};

const CONTRACT_BREACH_COLOR: Record<string, string> = {
  severe: 'bg-red-500/15 text-red-600 border-red-500/20',
  moderate: 'bg-orange-500/15 text-orange-600 border-orange-500/20',
  minimal: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  none: 'bg-green-500/15 text-green-600 border-green-500/20',
};

export function EducationCrisisScenarioCard({ data }: EducationCrisisScenarioCardProps) {
  if (!data) return null;
  const d = data as unknown as EducationCrisisScenarioData;

  const scenarios = d.scenarios ?? [];
  const goldenHourActions = (d.goldenHourActions ?? []).slice(0, 3);
  const contractBreachDimensions = (d.crisisRoot?.contractBreachDimensions ?? []).slice(0, 3);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          교육 위기 시나리오
          <AdvancedCardHelp {...ADVANCED_HELP.educationCrisisScenario} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 3개 시나리오 */}
        {scenarios.length > 0 && (
          <div className="space-y-2">
            {scenarios.slice(0, 3).map((scenario, i) => {
              const meta = SCENARIO_META[scenario.type ?? 'control'] ?? SCENARIO_META.control;
              return (
                <div
                  key={i}
                  className={`rounded-md border ${meta.borderColor} ${meta.bgColor} p-2.5`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {meta.icon}
                      <span className="text-xs font-medium">{meta.label}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${meta.badgeColor}`}
                    >
                      {scenario.probability ?? 0}%
                    </Badge>
                  </div>
                  {scenario.label && (
                    <p className="text-[10px] text-muted-foreground leading-tight mb-1.5">
                      {scenario.label}
                    </p>
                  )}
                  {/* 사회계약 위반 수준 */}
                  {scenario.reputationImpact?.socialContractBreach && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">계약 위반:</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${CONTRACT_BREACH_COLOR[scenario.reputationImpact.socialContractBreach]}`}
                      >
                        {CONTRACT_BREACH_LABEL[scenario.reputationImpact.socialContractBreach]}
                      </Badge>
                    </div>
                  )}
                  {/* 트리거 조건 1개만 표시 */}
                  {scenario.triggerConditions?.[0] && (
                    <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                      <span className="font-medium">트리거:</span> {scenario.triggerConditions[0]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 사회계약 위반 차원 */}
        {contractBreachDimensions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">사회계약 위반 차원</p>
            <div className="flex flex-wrap gap-1">
              {contractBreachDimensions.map((dim, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 bg-orange-500/10 text-orange-600 border-orange-500/20"
                >
                  {dim}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 골든타임 조치 */}
        {goldenHourActions.length > 0 && (
          <div className="rounded-md border border-red-100 bg-red-50/50 p-2.5">
            <p className="text-[10px] font-semibold text-red-700 mb-1.5">⚡ 72시간 내 우선 조치</p>
            <ul className="space-y-1">
              {goldenHourActions.map((action, i) => (
                <li key={i} className="flex gap-1.5 text-[10px] text-red-700">
                  <span className="shrink-0">{i + 1}.</span>
                  <span className="leading-tight">{action}</span>
                </li>
              ))}
            </ul>
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
