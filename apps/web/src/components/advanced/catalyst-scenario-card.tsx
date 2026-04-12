'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Scenario {
  type: 'bull' | 'base' | 'bear';
  typeName: string;
  probability: number;
  catalysts: string[];
  sentimentImpact: string;
  marketNarrative: string;
  keyWatchPoints: string[];
  timeframe: string;
}

interface NoiseVsSignal {
  isCurrentMoveNoise: boolean;
  reasoning: string;
}

interface CatalystScenarioData {
  scenarios: Scenario[];
  mostLikelyScenario: 'bull' | 'base' | 'bear';
  sentimentMomentum:
    | 'accelerating-bull'
    | 'decelerating-bull'
    | 'stable'
    | 'decelerating-bear'
    | 'accelerating-bear';
  noiseVsSignal: NoiseVsSignal;
  disclaimer: string;
  summary: string;
}

interface CatalystScenarioCardProps {
  data: Record<string, unknown> | null;
}

const SCENARIO_CONFIG = {
  bull: {
    label: '강세 (Bull)',
    icon: <TrendingUp className="h-4 w-4 text-green-500" />,
    borderColor: 'border-green-500/30',
    bgColor: 'bg-green-500/5',
    badgeColor: 'bg-green-500/10 text-green-700 border-green-500/20',
  },
  base: {
    label: '기본 (Base)',
    icon: <Minus className="h-4 w-4 text-gray-400" />,
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-500/5',
    badgeColor: 'bg-gray-500/10 text-gray-600 border-gray-400/20',
  },
  bear: {
    label: '약세 (Bear)',
    icon: <TrendingDown className="h-4 w-4 text-red-500" />,
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/5',
    badgeColor: 'bg-red-500/10 text-red-700 border-red-500/20',
  },
};

const MOMENTUM_CONFIG: Record<string, { label: string; color: string }> = {
  'accelerating-bull': { label: '강세 가속', color: 'text-green-600' },
  'decelerating-bull': { label: '강세 둔화', color: 'text-lime-600' },
  stable: { label: '안정', color: 'text-gray-500' },
  'decelerating-bear': { label: '약세 둔화', color: 'text-orange-500' },
  'accelerating-bear': { label: '약세 가속', color: 'text-red-600' },
};

export function CatalystScenarioCard({ data }: CatalystScenarioCardProps) {
  const parsed = data as unknown as CatalystScenarioData | null;

  if (!parsed) {
    return (
      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
            시장 시나리오
            <AdvancedCardHelp {...ADVANCED_HELP.catalystScenario} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
            데이터 없음
          </div>
        </CardContent>
      </Card>
    );
  }

  const momentumConfig = MOMENTUM_CONFIG[parsed.sentimentMomentum] ?? MOMENTUM_CONFIG.stable;

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          시장 시나리오
          <AdvancedCardHelp {...ADVANCED_HELP.catalystScenario} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 모멘텀 및 가장 유력한 시나리오 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">심리 모멘텀</span>
          <span className={`font-medium text-xs ${momentumConfig.color}`}>
            {momentumConfig.label}
          </span>
        </div>

        {/* 3개 시나리오 */}
        <div className="space-y-2">
          {parsed.scenarios.map((scenario, i) => {
            const config = SCENARIO_CONFIG[scenario.type];
            const isLikely = scenario.type === parsed.mostLikelyScenario;
            const probPct = Math.round(scenario.probability * 100);

            return (
              <div
                key={i}
                className={`rounded-lg border p-3 space-y-2 ${config.borderColor} ${config.bgColor} ${isLikely ? 'ring-1 ring-offset-0 ring-primary/20' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {config.icon}
                    <span className="text-xs font-medium">{scenario.typeName || config.label}</span>
                    {isLikely && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 border">
                        유력
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-bold tabular-nums">{probPct}%</span>
                </div>

                {/* 확률 바 */}
                <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scenario.type === 'bull' ? 'bg-green-500' : scenario.type === 'bear' ? 'bg-red-500' : 'bg-gray-400'}`}
                    style={{ width: `${probPct}%` }}
                  />
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {scenario.marketNarrative}
                </p>

                {scenario.catalysts.length > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-medium">촉발 이벤트: </span>
                    {scenario.catalysts.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 노이즈 vs 시그널 */}
        {parsed.noiseVsSignal.reasoning && (
          <div className="rounded border px-2.5 py-2 text-xs space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-muted-foreground">
                {parsed.noiseVsSignal.isCurrentMoveNoise ? '⚡ 단기 노이즈' : '📊 구조적 시그널'}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {parsed.noiseVsSignal.reasoning}
            </p>
          </div>
        )}

        {/* 면책 문구 */}
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed border-t pt-2">
          ⚠️ {parsed.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}
