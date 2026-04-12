'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface RepTrakDimension {
  dimension: string;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  keyFindings: string;
}

interface StakeholderPerception {
  stakeholder: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  keyConcerns: string[];
  keyStrengths: string[];
}

interface ReputationGap {
  gap: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

interface ReputationIndexData {
  overallScore: number;
  trend: 'improving' | 'stable' | 'declining';
  dimensions: RepTrakDimension[];
  stakeholderPerceptions: StakeholderPerception[];
  reputationGaps: ReputationGap[];
  benchmarkContext: string;
  summary: string;
}

interface ReputationIndexCardProps {
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
  if (score >= 70) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function ReputationIndexCard({ data }: ReputationIndexCardProps) {
  if (!data) return null;
  const d = data as unknown as ReputationIndexData;

  const topDimensions = (d.dimensions ?? []).slice(0, 5);
  const topGaps = (d.reputationGaps ?? []).slice(0, 3);
  const topPerceptions = (d.stakeholderPerceptions ?? []).slice(0, 3);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          평판 지수 측정 (RepTrak)
          <AdvancedCardHelp {...ADVANCED_HELP.reputationIndex} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 종합 점수 */}
        <div className="flex items-center gap-4 rounded-lg border p-3">
          <div className="text-center min-w-[64px]">
            <div className={`text-3xl font-bold ${getScoreColor(d.overallScore ?? 0)}`}>
              {d.overallScore ?? 0}
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
              value={d.overallScore ?? 0}
              className={`h-2 ${getProgressColor(d.overallScore ?? 0)}`}
            />
            {d.benchmarkContext && (
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                {d.benchmarkContext}
              </p>
            )}
          </div>
        </div>

        {/* RepTrak 차원별 점수 */}
        {topDimensions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">RepTrak 7차원</p>
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

        {/* 이해관계자별 인식 */}
        {topPerceptions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">이해관계자 인식</p>
            <div className="space-y-1.5">
              {topPerceptions.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">
                    {p.stakeholder}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${SENTIMENT_COLOR[p.sentiment ?? 'neutral']}`}
                  >
                    {SENTIMENT_LABEL[p.sentiment ?? 'neutral']}
                  </Badge>
                  {p.keyConcerns?.[0] && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {p.keyConcerns[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 평판 취약 지점 */}
        {topGaps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">취약 지점</p>
            <div className="space-y-1.5">
              {topGaps.map((gap, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${SEVERITY_COLOR[gap.severity ?? 'medium']}`}
                  >
                    {gap.severity === 'critical'
                      ? '긴급'
                      : gap.severity === 'high'
                        ? '높음'
                        : gap.severity === 'medium'
                          ? '중간'
                          : '낮음'}
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-tight">{gap.gap}</p>
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
