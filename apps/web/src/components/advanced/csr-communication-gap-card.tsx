'use client';

import { AlertTriangle, Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EsgDimensionGap {
  dimension: 'E' | 'S' | 'G';
  dimensionName: string;
  claimedPosition: string;
  perceivedReality: string;
  gapScore: number;
  publicReaction: 'backlash' | 'skeptical' | 'neutral' | 'supportive';
}

interface CsrCommunicationGapData {
  overallHypocrisyScore: number;
  esgDimensionGaps: EsgDimensionGap[];
  greenwashingRisk: 'high' | 'medium' | 'low' | 'none';
  credibilityIndex: number;
  keyHypocrisyTriggers: Array<{
    trigger: string;
    publicSentiment: string;
    reputationalImpact: 'severe' | 'moderate' | 'minor';
  }>;
  communicationRecommendation: string;
  summary: string;
}

interface CsrCommunicationGapCardProps {
  data: Record<string, unknown> | null;
}

const REACTION_LABEL: Record<string, string> = {
  backlash: '반발',
  skeptical: '회의적',
  neutral: '중립',
  supportive: '지지',
};

function getGreenwashingBadge(risk: string) {
  switch (risk) {
    case 'high':
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">그린워싱 위험 높음</Badge>
      );
    case 'medium':
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
          그린워싱 위험 보통
        </Badge>
      );
    case 'low':
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          그린워싱 위험 낮음
        </Badge>
      );
    case 'none':
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">그린워싱 없음</Badge>
      );
    default:
      return <Badge variant="secondary">{risk}</Badge>;
  }
}

function getGapScoreColor(score: number) {
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-green-500';
}

function getImpactColor(impact: string) {
  switch (impact) {
    case 'severe':
      return 'text-red-500';
    case 'moderate':
      return 'text-amber-500';
    case 'minor':
      return 'text-green-500';
    default:
      return 'text-muted-foreground';
  }
}

const DIMENSION_COLORS: Record<string, string> = {
  E: 'bg-green-500',
  S: 'bg-blue-500',
  G: 'bg-purple-500',
};

export function CsrCommunicationGapCard({ data }: CsrCommunicationGapCardProps) {
  const parsed = data as unknown as CsrCommunicationGapData | null;

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Leaf className="h-4 w-4" />
            CSR 커뮤니케이션 갭
          </span>
          {parsed && getGreenwashingBadge(parsed.greenwashingRisk)}
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
            {/* 위선 점수 + 신뢰도 지수 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-2 text-center space-y-0.5">
                <p className="text-xs text-muted-foreground">CSR 위선 점수</p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    parsed.overallHypocrisyScore >= 60
                      ? 'text-red-500'
                      : parsed.overallHypocrisyScore >= 30
                        ? 'text-amber-500'
                        : 'text-green-500'
                  }`}
                >
                  {parsed.overallHypocrisyScore}
                </p>
                <p className="text-[10px] text-muted-foreground">높을수록 위험</p>
              </div>
              <div className="rounded border p-2 text-center space-y-0.5">
                <p className="text-xs text-muted-foreground">CSR 신뢰도</p>
                <p
                  className={`text-xl font-bold tabular-nums ${
                    parsed.credibilityIndex >= 60
                      ? 'text-green-500'
                      : parsed.credibilityIndex >= 30
                        ? 'text-amber-500'
                        : 'text-red-500'
                  }`}
                >
                  {parsed.credibilityIndex}
                </p>
                <p className="text-[10px] text-muted-foreground">100=완전 신뢰</p>
              </div>
            </div>

            {/* ESG 차원별 격차 */}
            {parsed.esgDimensionGaps.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">E/S/G 차원별 격차</p>
                <div className="space-y-2">
                  {parsed.esgDimensionGaps.map((gap, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white ${DIMENSION_COLORS[gap.dimension] ?? 'bg-muted'}`}
                          >
                            {gap.dimension}
                          </span>
                          {gap.dimensionName || gap.dimension}
                        </span>
                        <span className="text-muted-foreground">
                          {REACTION_LABEL[gap.publicReaction] ?? gap.publicReaction}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getGapScoreColor(gap.gapScore)}`}
                            style={{ width: `${Math.min(gap.gapScore, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">
                          {gap.gapScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 핵심 위선 트리거 */}
            {parsed.keyHypocrisyTriggers.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  위선 트리거
                </p>
                <ul className="space-y-1">
                  {parsed.keyHypocrisyTriggers.slice(0, 3).map((t, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span
                        className={`shrink-0 font-medium ${getImpactColor(t.reputationalImpact)}`}
                      >
                        ●
                      </span>
                      <span>{t.trigger}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 권고사항 */}
            {parsed.communicationRecommendation && (
              <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                {parsed.communicationRecommendation}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
