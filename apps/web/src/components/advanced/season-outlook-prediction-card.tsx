'use client';

import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FanEngagementForecast {
  trend: 'increasing' | 'stable' | 'decreasing';
  confidence: 'high' | 'medium' | 'low';
  description: string;
}

interface KeyWatchPoint {
  watchPoint: string;
  fanInterestLevel: 'high' | 'medium' | 'low';
  narrativePotential: string;
}

interface RiskFactor {
  risk: string;
  probability: number;
  impact: 'high' | 'medium' | 'low';
  mitigationSuggestion: string;
}

interface OpportunityFactor {
  opportunity: string;
  activationSuggestion: string;
}

interface SeasonOutlookData {
  overallOutlook: 'very-positive' | 'positive' | 'neutral' | 'negative' | 'very-negative';
  fanExpectationLevel: number;
  fanEngagementForecast: FanEngagementForecast;
  keyWatchPoints: KeyWatchPoint[];
  riskFactors: RiskFactor[];
  opportunityFactors: OpportunityFactor[];
  competitorComparison: string;
  disclaimer: string;
  summary: string;
}

interface SeasonOutlookPredictionCardProps {
  data: Record<string, unknown> | null;
}

const OUTLOOK_CONFIG = {
  'very-positive': { label: '매우 긍정', color: 'text-green-700', barColor: 'bg-green-500' },
  positive: { label: '긍정', color: 'text-green-600', barColor: 'bg-green-400' },
  neutral: { label: '중립', color: 'text-muted-foreground', barColor: 'bg-gray-400' },
  negative: { label: '부정', color: 'text-orange-600', barColor: 'bg-orange-400' },
  'very-negative': { label: '매우 부정', color: 'text-red-600', barColor: 'bg-red-500' },
};

const TREND_CONFIG = {
  increasing: { label: '증가', icon: TrendingUp, color: 'text-green-600' },
  stable: { label: '유지', icon: Minus, color: 'text-muted-foreground' },
  decreasing: { label: '감소', icon: TrendingDown, color: 'text-red-500' },
};

const CONFIDENCE_CONFIG = {
  high: { label: '높음', color: 'bg-green-500/15 text-green-600 border-green-500/20' },
  medium: { label: '보통', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  low: { label: '낮음', color: 'bg-gray-500/15 text-gray-500 border-gray-500/20' },
};

const INTEREST_CONFIG = {
  high: { label: '높음', color: 'bg-orange-500/15 text-orange-600 border-orange-500/20' },
  medium: { label: '보통', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  low: { label: '낮음', color: 'bg-gray-500/15 text-gray-500 border-gray-500/20' },
};

const IMPACT_CONFIG = {
  high: { label: '높음', color: 'bg-red-500/15 text-red-600 border-red-500/20' },
  medium: { label: '보통', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  low: { label: '낮음', color: 'bg-gray-500/15 text-gray-500 border-gray-500/20' },
};

export function SeasonOutlookPredictionCard({ data }: SeasonOutlookPredictionCardProps) {
  if (!data) return null;
  const result = data as unknown as SeasonOutlookData;

  const outlookCfg = OUTLOOK_CONFIG[result.overallOutlook ?? 'neutral'];
  const engagementTrend = result.fanEngagementForecast;
  const TrendIcon = TREND_CONFIG[engagementTrend?.trend ?? 'stable'].icon;
  const trendCfg = TREND_CONFIG[engagementTrend?.trend ?? 'stable'];

  // 팬 기대치 지수 색상
  const expectationLevel = result.fanExpectationLevel ?? 50;
  const expectationColor =
    expectationLevel >= 70
      ? 'bg-green-500'
      : expectationLevel >= 50
        ? 'bg-yellow-400'
        : 'bg-red-400';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          시즌 전망 예측
          <AdvancedCardHelp {...ADVANCED_HELP.seasonOutlookPrediction} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 종합 전망 + 기대치 지수 */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground">종합 전망</p>
            <p className={`font-semibold text-sm mt-0.5 ${outlookCfg.color}`}>{outlookCfg.label}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">팬 기대치 지수</p>
            <p className="text-2xl font-bold">{expectationLevel}</p>
            <p className="text-[10px] text-muted-foreground">/100</p>
          </div>
        </div>

        {/* 기대치 지수 바 */}
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>낮음 (CORFing 위험)</span>
            <span>높음 (BIRGing 극대화)</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${expectationColor}`}
              style={{ width: `${Math.min(100, Math.max(0, expectationLevel))}%` }}
            />
          </div>
        </div>

        {/* 팬 참여도 예측 */}
        {engagementTrend && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <TrendIcon className={`h-4 w-4 ${trendCfg.color}`} />
              <span className={`font-medium ${trendCfg.color}`}>참여도 {trendCfg.label} 예측</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${CONFIDENCE_CONFIG[engagementTrend.confidence]?.color ?? ''}`}
              >
                신뢰도 {CONFIDENCE_CONFIG[engagementTrend.confidence]?.label ?? ''}
              </Badge>
            </div>
          </div>
        )}
        {engagementTrend?.description && (
          <p className="text-[11px] text-muted-foreground -mt-2">{engagementTrend.description}</p>
        )}

        {/* 주요 관전 포인트 */}
        {result.keyWatchPoints?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">주요 관전 포인트</p>
            <div className="space-y-2">
              {result.keyWatchPoints.slice(0, 3).map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={`shrink-0 mt-0.5 text-[10px] ${INTEREST_CONFIG[w.fanInterestLevel]?.color ?? ''}`}
                  >
                    {INTEREST_CONFIG[w.fanInterestLevel]?.label ?? w.fanInterestLevel}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{w.watchPoint}</p>
                    {w.narrativePotential && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {w.narrativePotential}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 리스크 요인 */}
        {result.riskFactors?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">리스크 요인</p>
            <div className="space-y-2">
              {result.riskFactors.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium">{r.risk}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${IMPACT_CONFIG[r.impact]?.color ?? ''}`}
                      >
                        영향 {IMPACT_CONFIG[r.impact]?.label ?? r.impact}
                      </Badge>
                      <span className="text-muted-foreground text-[10px]">
                        확률 {Math.round((r.probability ?? 0) * 100)}%
                      </span>
                    </div>
                    {r.mitigationSuggestion && (
                      <p className="text-muted-foreground mt-0.5">{r.mitigationSuggestion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 기회 요인 */}
        {result.opportunityFactors?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">기회 요인</p>
            <div className="space-y-2">
              {result.opportunityFactors.slice(0, 3).map((o, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-yellow-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{o.opportunity}</p>
                    {o.activationSuggestion && (
                      <p className="text-muted-foreground mt-0.5">{o.activationSuggestion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 경쟁 팀 비교 */}
        {result.competitorComparison && (
          <div className="rounded border p-2 bg-muted/30 text-xs">
            <p className="font-medium text-muted-foreground mb-1">경쟁 팀 대비 포지션</p>
            <p className="text-muted-foreground">{result.competitorComparison}</p>
          </div>
        )}

        {/* 면책 문구 */}
        {result.disclaimer && (
          <p className="text-[10px] text-muted-foreground/60 border-t pt-2">{result.disclaimer}</p>
        )}

        {/* 요약 */}
        {result.summary && (
          <p className="text-xs text-muted-foreground border-t pt-3">{result.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
