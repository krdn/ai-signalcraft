'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface NarrativeArc {
  arc: string;
  dominance: 'dominant' | 'emerging' | 'fading';
  fanReactionType: 'birging' | 'corfing' | 'mixed';
  description: string;
}

interface KeyPerformanceDriver {
  driver: string;
  impact: 'positive' | 'negative' | 'mixed';
  magnitude: 'high' | 'medium' | 'low';
}

interface PerformanceNarrativeData {
  performanceSentimentCorrelation: {
    description: string;
    correlationStrength: 'strong' | 'moderate' | 'weak';
    lag: string;
  };
  narrativeArcs: NarrativeArc[];
  keyPerformanceDrivers: KeyPerformanceDriver[];
  mediaFraming: {
    dominantFrame: string;
    fanCommunityFrame: string;
    frameDivergence: string;
  };
  momentumAssessment: {
    currentMomentum: 'positive' | 'negative' | 'neutral';
    stabilityIndex: number;
    outlookDescription: string;
  };
  summary: string;
}

interface PerformanceNarrativeCardProps {
  data: Record<string, unknown> | null;
}

const DOMINANCE_CONFIG = {
  dominant: { label: '지배적', color: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
  emerging: { label: '부상 중', color: 'bg-blue-500/15 text-blue-600 border-blue-500/20' },
  fading: { label: '약화 중', color: 'bg-gray-500/15 text-gray-500 border-gray-500/20' },
};

const FAN_REACTION_CONFIG = {
  birging: { label: 'BIRGing', color: 'bg-green-500/15 text-green-600 border-green-500/20' },
  corfing: { label: 'CORFing', color: 'bg-red-500/15 text-red-600 border-red-500/20' },
  mixed: { label: '혼재', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
};

const IMPACT_CONFIG = {
  positive: { label: '긍정', color: 'text-green-600' },
  negative: { label: '부정', color: 'text-red-500' },
  mixed: { label: '혼재', color: 'text-yellow-600' },
};

const MAGNITUDE_CONFIG = {
  high: { label: '높음', color: 'bg-red-500/15 text-red-600 border-red-500/20' },
  medium: { label: '보통', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  low: { label: '낮음', color: 'bg-gray-500/15 text-gray-500 border-gray-500/20' },
};

const MOMENTUM_CONFIG = {
  positive: { label: '긍정 모멘텀', color: 'text-green-600', icon: TrendingUp },
  negative: { label: '부정 모멘텀', color: 'text-red-500', icon: TrendingDown },
  neutral: { label: '중립', color: 'text-muted-foreground', icon: Minus },
};

const CORRELATION_CONFIG = {
  strong: { label: '강함', color: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
  moderate: { label: '보통', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  weak: { label: '약함', color: 'bg-gray-500/15 text-gray-500 border-gray-500/20' },
};

export function PerformanceNarrativeCard({ data }: PerformanceNarrativeCardProps) {
  if (!data) return null;
  const result = data as unknown as PerformanceNarrativeData;

  const momentum = result.momentumAssessment;
  const momentumCfg = MOMENTUM_CONFIG[momentum?.currentMomentum ?? 'neutral'];
  const MomentumIcon = momentumCfg.icon;
  const correlationCfg =
    CORRELATION_CONFIG[result.performanceSentimentCorrelation?.correlationStrength ?? 'moderate'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          성과 내러티브 분석
          <AdvancedCardHelp {...ADVANCED_HELP.performanceNarrative} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 모멘텀 요약 */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <MomentumIcon className={`h-5 w-5 ${momentumCfg.color}`} />
            <span className={`font-semibold text-sm ${momentumCfg.color}`}>
              {momentumCfg.label}
            </span>
          </div>
          {momentum?.stabilityIndex !== undefined && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">안정성 지수</p>
              <p className="text-sm font-bold">{momentum.stabilityIndex}/100</p>
            </div>
          )}
        </div>

        {/* 성적-여론 상관관계 */}
        {result.performanceSentimentCorrelation?.description && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-xs font-medium text-muted-foreground">성적-여론 상관관계</p>
              <Badge variant="outline" className={`text-[10px] ${correlationCfg.color}`}>
                {correlationCfg.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {result.performanceSentimentCorrelation.description}
            </p>
            {result.performanceSentimentCorrelation.lag && (
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                반응 시간: {result.performanceSentimentCorrelation.lag}
              </p>
            )}
          </div>
        )}

        {/* 서사 호(Arc) */}
        {result.narrativeArcs?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">주요 서사 호</p>
            <div className="space-y-2">
              {result.narrativeArcs.slice(0, 4).map((arc, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex gap-1 shrink-0 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${DOMINANCE_CONFIG[arc.dominance]?.color ?? ''}`}
                    >
                      {DOMINANCE_CONFIG[arc.dominance]?.label ?? arc.dominance}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${FAN_REACTION_CONFIG[arc.fanReactionType]?.color ?? ''}`}
                    >
                      {FAN_REACTION_CONFIG[arc.fanReactionType]?.label ?? arc.fanReactionType}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{arc.arc}</p>
                    {arc.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{arc.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 핵심 성과 요인 */}
        {result.keyPerformanceDrivers?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">핵심 성과 요인</p>
            <div className="space-y-1.5">
              {result.keyPerformanceDrivers.slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${MAGNITUDE_CONFIG[d.magnitude]?.color ?? ''}`}
                  >
                    {MAGNITUDE_CONFIG[d.magnitude]?.label ?? d.magnitude}
                  </Badge>
                  <span className={`font-medium shrink-0 ${IMPACT_CONFIG[d.impact]?.color ?? ''}`}>
                    {IMPACT_CONFIG[d.impact]?.label ?? d.impact}
                  </span>
                  <span className="text-muted-foreground truncate">{d.driver}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 미디어 vs 팬 커뮤니티 프레임 */}
        {result.mediaFraming?.dominantFrame && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">프레임 비교</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border p-2 bg-muted/30">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">미디어 프레임</p>
                <p>{result.mediaFraming.dominantFrame}</p>
              </div>
              <div className="rounded border p-2 bg-muted/30">
                <p className="text-[10px] font-medium text-muted-foreground mb-1">팬 커뮤니티</p>
                <p>{result.mediaFraming.fanCommunityFrame}</p>
              </div>
            </div>
            {result.mediaFraming.frameDivergence && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                차이: {result.mediaFraming.frameDivergence}
              </p>
            )}
          </div>
        )}

        {/* 요약 */}
        {result.summary && (
          <p className="text-xs text-muted-foreground border-t pt-3">{result.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
