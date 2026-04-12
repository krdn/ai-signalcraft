'use client';

import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type SignalType = 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';

interface TimeHorizonSignal {
  signal: SignalType;
  rationale: string;
  timeframe: string;
}

interface SignalComponent {
  component: string;
  signal: 'positive' | 'negative' | 'neutral';
  weight: number;
  rationale: string;
}

interface SentimentExtremeWarning {
  isExtreme: boolean;
  direction: 'euphoric' | 'panicking' | 'none';
  contraindicatorSignal: string;
}

interface InvestmentSignalData {
  overallSignal: SignalType;
  signalStrength: number;
  signalComponents: SignalComponent[];
  timeHorizon: {
    shortTerm: TimeHorizonSignal;
    mediumTerm: TimeHorizonSignal;
  };
  keyRisks: string[];
  keyOpportunities: string[];
  sentimentExtremeWarning: SentimentExtremeWarning;
  disclaimer: string;
  summary: string;
}

interface InvestmentSignalCardProps {
  data: Record<string, unknown> | null;
}

const SIGNAL_CONFIG: Record<SignalType, { label: string; color: string; badgeClass: string; icon: React.ReactNode }> = {
  'strong-buy': {
    label: '강력 매수',
    color: 'text-green-700',
    badgeClass: 'bg-green-600/10 text-green-700 border-green-600/20',
    icon: <TrendingUp className="h-4 w-4 text-green-600" />,
  },
  buy: {
    label: '매수',
    color: 'text-green-500',
    badgeClass: 'bg-green-500/10 text-green-600 border-green-500/20',
    icon: <TrendingUp className="h-4 w-4 text-green-500" />,
  },
  hold: {
    label: '관망',
    color: 'text-gray-500',
    badgeClass: 'bg-gray-500/10 text-gray-600 border-gray-400/20',
    icon: <Minus className="h-4 w-4 text-gray-400" />,
  },
  sell: {
    label: '매도',
    color: 'text-red-500',
    badgeClass: 'bg-red-500/10 text-red-600 border-red-500/20',
    icon: <TrendingDown className="h-4 w-4 text-red-500" />,
  },
  'strong-sell': {
    label: '강력 매도',
    color: 'text-red-700',
    badgeClass: 'bg-red-600/10 text-red-700 border-red-600/20',
    icon: <TrendingDown className="h-4 w-4 text-red-600" />,
  },
};

const COMPONENT_SIGNAL_COLOR = {
  positive: 'text-green-600',
  negative: 'text-red-500',
  neutral: 'text-gray-400',
};

export function InvestmentSignalCard({ data }: InvestmentSignalCardProps) {
  const parsed = data as unknown as InvestmentSignalData | null;

  if (!parsed) {
    return (
      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
            투자 신호 종합
            <AdvancedCardHelp {...ADVANCED_HELP.investmentSignal} />
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

  const overallConfig = SIGNAL_CONFIG[parsed.overallSignal] ?? SIGNAL_CONFIG.hold;
  const strengthPct = Math.min(100, Math.max(0, parsed.signalStrength));

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          투자 신호 종합
          <AdvancedCardHelp {...ADVANCED_HELP.investmentSignal} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 종합 신호 */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2">
            {overallConfig.icon}
            <div>
              <p className={`text-base font-bold ${overallConfig.color}`}>
                {overallConfig.label}
              </p>
              <p className="text-[10px] text-muted-foreground">여론 기반 · 투자 자문 아님</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">{strengthPct}</p>
            <p className="text-[10px] text-muted-foreground">신호 강도</p>
          </div>
        </div>

        {/* 신호 강도 바 */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              parsed.overallSignal.includes('buy')
                ? 'bg-green-500'
                : parsed.overallSignal.includes('sell')
                  ? 'bg-red-500'
                  : 'bg-gray-400'
            }`}
            style={{ width: `${strengthPct}%` }}
          />
        </div>

        {/* 단기 / 중기 신호 */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '단기', data: parsed.timeHorizon.shortTerm },
            { label: '중기', data: parsed.timeHorizon.mediumTerm },
          ].map(({ label, data: horizon }) => {
            const hConfig = SIGNAL_CONFIG[horizon.signal] ?? SIGNAL_CONFIG.hold;
            return (
              <div key={label} className="rounded border px-2.5 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{label} ({horizon.timeframe})</span>
                  <Badge className={`text-[10px] px-1 py-0 border ${hConfig.badgeClass}`}>
                    {hConfig.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{horizon.rationale}</p>
              </div>
            );
          })}
        </div>

        {/* 극단적 심리 경고 */}
        {parsed.sentimentExtremeWarning.isExtreme && (
          <div className="flex gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700">
                극단적 심리 경고 ({parsed.sentimentExtremeWarning.direction === 'euphoric' ? '과열' : '공황'})
              </p>
              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                {parsed.sentimentExtremeWarning.contraindicatorSignal}
              </p>
            </div>
          </div>
        )}

        {/* 신호 구성 요소 (상위 3개) */}
        {parsed.signalComponents.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">신호 구성</p>
            <div className="space-y-1">
              {parsed.signalComponents.slice(0, 3).map((comp, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    comp.signal === 'positive'
                      ? 'bg-green-500'
                      : comp.signal === 'negative'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                  }`} />
                  <span className="flex-1 text-muted-foreground">{comp.component}</span>
                  <span className={`font-medium ${COMPONENT_SIGNAL_COLOR[comp.signal]}`}>
                    {Math.round(comp.weight * 100)}%
                  </span>
                </div>
              ))}
            </div>
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
