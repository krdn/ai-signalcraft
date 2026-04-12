'use client';

import { TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
interface DimensionScore {
  dimension: string;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  keyFindings: string;
  evidences: string[];
}

interface GroupPerception {
  group: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  keyConcerns: string[];
  keyStrengths: string[];
  perceptionGap: string;
}

interface SignalingGap {
  signal: string;
  reception: string;
  gapSeverity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

interface InstitutionalReputationIndexData {
  reputationIndex: number;
  trend: 'improving' | 'stable' | 'declining';
  dimensionScores: DimensionScore[];
  groupPerceptions: GroupPerception[];
  signalingGaps: SignalingGap[];
  earlyWarnings: string[];
  summary: string;
}

interface InstitutionalReputationIndexCardProps {
  data: Record<string, unknown> | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 border-red-500/20',
  high: 'bg-orange-500/15 text-orange-600 border-orange-500/20',
  medium: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  low: 'bg-slate-500/15 text-slate-600 border-slate-500/20',
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'bg-green-500/15 text-green-600 border-green-500/20',
  negative: 'bg-red-500/15 text-red-600 border-red-500/20',
  neutral: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
  mixed: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
};

const SENTIMENT_LABEL: Record<string, string> = {
  positive: '긍정',
  negative: '부정',
  neutral: '중립',
  mixed: '혼재',
};

const TREND_LABEL: Record<string, string> = {
  improving: '개선',
  stable: '유지',
  declining: '악화',
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (trend === 'declining') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-slate-400" />;
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function getProgressColor(score: number) {
  if (score >= 70) return '[&>div]:bg-green-500';
  if (score >= 50) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-red-500';
}

export function InstitutionalReputationIndexCard({ data }: InstitutionalReputationIndexCardProps) {
  if (!data) return null;
  const d = data as unknown as InstitutionalReputationIndexData;

  const topDimensions = (d.dimensionScores ?? []).slice(0, 4);
  const topGroups = (d.groupPerceptions ?? []).slice(0, 4);
  const topGaps = (d.signalingGaps ?? []).slice(0, 3);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          기관 평판 지수
          <AdvancedCardHelp {...ADVANCED_HELP.institutionalReputationIndex} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 종합 점수 */}
        <div className="flex items-center gap-4 rounded-lg border p-3">
          <div className="text-center min-w-[64px]">
            <div className={`text-3xl font-bold ${getScoreColor(d.reputationIndex ?? 0)}`}>
              {d.reputationIndex ?? 0}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">/ 100</div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendIcon trend={d.trend ?? 'stable'} />
              <span className="text-xs text-muted-foreground">
                추세: {TREND_LABEL[d.trend ?? 'stable']}
              </span>
            </div>
            <Progress
              value={d.reputationIndex ?? 0}
              className={`h-2 ${getProgressColor(d.reputationIndex ?? 0)}`}
            />
          </div>
        </div>

        {/* 4차원 평판 점수 */}
        {topDimensions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">4차원 평판 점수</p>
            <div className="space-y-2">
              {topDimensions.map((dim, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">
                    {dim.dimension}
                  </span>
                  <Progress
                    value={dim.score ?? 0}
                    className={`h-1.5 flex-1 ${getProgressColor(dim.score ?? 0)}`}
                  />
                  <div className="flex items-center gap-1 min-w-[40px]">
                    <span className={`text-xs font-medium ${getScoreColor(dim.score ?? 0)}`}>
                      {dim.score ?? 0}
                    </span>
                    <TrendIcon trend={dim.trend ?? 'stable'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 집단별 인식 */}
        {topGroups.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">집단별 인식</p>
            <div className="space-y-1.5">
              {topGroups.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0 truncate">
                    {g.group}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${SENTIMENT_COLOR[g.sentiment ?? 'neutral']}`}
                  >
                    {SENTIMENT_LABEL[g.sentiment ?? 'neutral']}
                  </Badge>
                  {g.perceptionGap && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {g.perceptionGap}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 신호-수신 간극 */}
        {topGaps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">신호-수신 간극</p>
            <div className="space-y-1.5">
              {topGaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${SEVERITY_COLOR[gap.gapSeverity ?? 'medium']}`}
                  >
                    {gap.gapSeverity === 'critical'
                      ? '긴급'
                      : gap.gapSeverity === 'high'
                        ? '높음'
                        : gap.gapSeverity === 'medium'
                          ? '중간'
                          : '낮음'}
                  </Badge>
                  <div>
                    <p className="text-xs font-medium leading-tight">{gap.signal}</p>
                    {gap.reception && (
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        → {gap.reception}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 조기 경고 */}
        {(d.earlyWarnings ?? []).length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-100 p-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {(d.earlyWarnings ?? []).slice(0, 2).map((w, i) => (
                <p key={i} className="text-[10px] text-red-700 leading-tight">
                  {w}
                </p>
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
