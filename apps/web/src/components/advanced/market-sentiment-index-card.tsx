'use client';

import { AlertTriangle, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BehavioralBias {
  bias: string;
  biasName: string;
  evidence: string;
  affectedSegment: string;
}

interface InvestorSegmentSentiment {
  segment: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  intensity: 'high' | 'medium' | 'low';
  keyDrivers: string[];
}

interface SentimentSignals {
  contraindicators: string[];
  momentumIndicators: string[];
}

interface MarketSentimentIndexData {
  sentimentIndex: number;
  sentimentLabel: 'extreme-fear' | 'fear' | 'neutral' | 'greed' | 'extreme-greed';
  trend: 'improving' | 'stable' | 'deteriorating';
  investorSegmentSentiment: InvestorSegmentSentiment[];
  behavioralBiases: BehavioralBias[];
  sentimentSignals: SentimentSignals;
  disclaimer: string;
  summary: string;
}

interface MarketSentimentIndexCardProps {
  data: Record<string, unknown> | null;
}

const SENTIMENT_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; barColor: string }
> = {
  'extreme-fear': {
    label: '극단적 공포',
    color: 'text-blue-700',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    barColor: 'bg-blue-500',
  },
  fear: {
    label: '공포',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    barColor: 'bg-blue-400',
  },
  neutral: {
    label: '중립',
    color: 'text-gray-600',
    bgColor: 'bg-gray-500/10 border-gray-500/20',
    barColor: 'bg-gray-400',
  },
  greed: {
    label: '탐욕',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    barColor: 'bg-amber-400',
  },
  'extreme-greed': {
    label: '극단적 탐욕',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10 border-red-500/20',
    barColor: 'bg-red-500',
  },
};

const TREND_ICONS = {
  improving: <TrendingUp className="h-3.5 w-3.5 text-green-500" />,
  stable: <Minus className="h-3.5 w-3.5 text-gray-400" />,
  deteriorating: <TrendingDown className="h-3.5 w-3.5 text-red-500" />,
};

const TREND_LABELS = {
  improving: '심리 개선 중',
  stable: '심리 안정',
  deteriorating: '심리 악화 중',
};

const SEGMENT_SENTIMENT_BADGE: Record<string, string> = {
  bullish: 'bg-green-500/10 text-green-700 border-green-500/20',
  bearish: 'bg-red-500/10 text-red-700 border-red-500/20',
  neutral: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  mixed: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
};
const SEGMENT_SENTIMENT_LABEL: Record<string, string> = {
  bullish: '강세',
  bearish: '약세',
  neutral: '중립',
  mixed: '혼조',
};

export function MarketSentimentIndexCard({ data }: MarketSentimentIndexCardProps) {
  const parsed = data as unknown as MarketSentimentIndexData | null;

  if (!parsed) {
    return (
      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
            투자 심리 지수
            <AdvancedCardHelp {...ADVANCED_HELP.marketSentimentIndex} />
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

  const config = SENTIMENT_CONFIG[parsed.sentimentLabel] ?? SENTIMENT_CONFIG.neutral;
  const indexPct = Math.min(100, Math.max(0, parsed.sentimentIndex));

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          투자 심리 지수
          <AdvancedCardHelp {...ADVANCED_HELP.marketSentimentIndex} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 심리 지수 게이지 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">공포 (0)</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-3xl font-bold tabular-nums ${config.color}`}>
                {indexPct}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <span className="text-xs text-muted-foreground">탐욕 (100)</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${config.barColor}`}
              style={{ width: `${indexPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <Badge className={`text-xs ${config.bgColor} ${config.color} border`}>
              {config.label}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {TREND_ICONS[parsed.trend]}
              {TREND_LABELS[parsed.trend]}
            </div>
          </div>
        </div>

        {/* 투자자 집단별 심리 */}
        {parsed.investorSegmentSentiment.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">집단별 심리</p>
            <div className="space-y-1">
              {parsed.investorSegmentSentiment.map((seg, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{seg.segment}</span>
                  <Badge className={`text-[10px] px-1.5 py-0 border ${SEGMENT_SENTIMENT_BADGE[seg.sentiment]}`}>
                    {SEGMENT_SENTIMENT_LABEL[seg.sentiment]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 행동 재무학 편향 */}
        {parsed.behavioralBiases.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">감지된 편향</p>
            <div className="space-y-1">
              {parsed.behavioralBiases.slice(0, 3).map((bias, i) => (
                <div key={i} className="text-xs rounded border px-2 py-1.5 space-y-0.5">
                  <span className="font-medium">{bias.biasName}</span>
                  <p className="text-muted-foreground leading-relaxed">{bias.evidence}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 역발상 신호 */}
        {parsed.sentimentSignals.contraindicators.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">역발상 신호</p>
            {parsed.sentimentSignals.contraindicators.slice(0, 2).map((signal, i) => (
              <div key={i} className="flex gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{signal}</span>
              </div>
            ))}
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
