'use client';

import { AlertTriangle, Shield, TrendingUp } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Scenario {
  type: 'spread' | 'control' | 'reverse';
  name: string;
  probability: number;
  triggerConditions: string[];
  expectedOutcome: string;
  responseStrategy: string[];
  timeframe: string;
}

interface CrisisScenarioData {
  scenarios: [
    Scenario & { type: 'spread' },
    Scenario & { type: 'control' },
    Scenario & { type: 'reverse' },
  ];
  currentRiskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: string;
}

interface CrisisscenariosProps {
  data: Record<string, unknown> | null;
}

// 시나리오별 테마 설정
const SCENARIO_THEME = {
  spread: {
    icon: AlertTriangle,
    label: '확산',
    borderColor: 'border-red-500/40',
    bgColor: 'bg-red-500/5',
    iconColor: 'text-red-500',
    barColor: 'bg-red-500',
  },
  control: {
    icon: Shield,
    label: '통제',
    borderColor: 'border-amber-500/40',
    bgColor: 'bg-amber-500/5',
    iconColor: 'text-amber-500',
    barColor: 'bg-amber-500',
  },
  reverse: {
    icon: TrendingUp,
    label: '역전',
    borderColor: 'border-green-500/40',
    bgColor: 'bg-green-500/5',
    iconColor: 'text-green-500',
    barColor: 'bg-green-500',
  },
};

function getRiskBadge(level: string) {
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

export function CrisisScenarios({ data }: CrisisscenariosProps) {
  const parsed = data as unknown as CrisisScenarioData | null;

  return (
    <Card className="min-h-[320px] lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            위기 시나리오
            <AdvancedCardHelp {...ADVANCED_HELP.crisisScenario} />
          </span>
          {parsed && getRiskBadge(parsed.currentRiskLevel)}
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
            {/* 3개 시나리오 카드 (가로 3열) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {parsed.scenarios.map((scenario) => {
                const theme = SCENARIO_THEME[scenario.type];
                const Icon = theme.icon;
                return (
                  <div
                    key={scenario.type}
                    className={`rounded-lg border ${theme.borderColor} ${theme.bgColor} p-4 space-y-3`}
                  >
                    {/* 헤더 */}
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${theme.iconColor}`} />
                      <div>
                        <p className="text-sm font-semibold">{scenario.name}</p>
                        <p className="text-[10px] text-muted-foreground">{theme.label} 시나리오</p>
                      </div>
                    </div>

                    {/* 발생 확률 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">발생 확률</span>
                        <span className="font-mono font-medium tabular-nums">
                          {scenario.probability}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${theme.barColor} transition-all`}
                          style={{ width: `${scenario.probability}%` }}
                        />
                      </div>
                    </div>

                    {/* 트리거 조건 */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium">트리거 조건</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {scenario.triggerConditions.map((cond, i) => (
                          <li key={i} className="flex gap-1">
                            <span className="shrink-0">-</span>
                            <span>{cond}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 대응 전략 */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium">대응 전략</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {scenario.responseStrategy.map((strat, i) => (
                          <li key={i} className="flex gap-1">
                            <span className="shrink-0">-</span>
                            <span>{strat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 예상 결과 + 소요 기간 */}
                    <div className="border-t pt-2 space-y-1">
                      <p className="text-xs">
                        <span className="font-medium">예상 결과:</span> {scenario.expectedOutcome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        소요 기간: {scenario.timeframe}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 권고 행동 */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs font-medium mb-1">권고 행동</p>
              <p className="text-sm">{parsed.recommendedAction}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
