'use client';

import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface EsgDimension {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number;
  keyIssues: string[];
  positiveFactors: string[];
  negativeFactors: string[];
  summary: string;
}

interface EsgRisk {
  dimension: 'E' | 'S' | 'G';
  risk: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  stakeholderImpact: string;
}

interface EsgSentimentData {
  overallEsgSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  dimensions: {
    environmental: EsgDimension;
    social: EsgDimension;
    governance: EsgDimension;
  };
  esgRisks: EsgRisk[];
  esgOpportunities: { dimension: 'E' | 'S' | 'G'; opportunity: string; potentialImpact: string }[];
  regulatoryRisk: 'high' | 'medium' | 'low';
  summary: string;
}

interface EsgSentimentCardProps {
  data: Record<string, unknown> | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-600 border-red-500/20',
  high: 'bg-orange-500/15 text-orange-600 border-orange-500/20',
  medium: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  low: 'bg-slate-500/15 text-slate-600 border-slate-500/20',
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음',
};

const REGULATORY_COLOR: Record<string, string> = {
  high: 'bg-red-500/15 text-red-600 border-red-500/20',
  medium: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20',
  low: 'bg-green-500/15 text-green-600 border-green-500/20',
};

const REGULATORY_LABEL: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

const DIM_LABEL: Record<string, string> = {
  environmental: 'E 환경',
  social: 'S 사회',
  governance: 'G 지배구조',
};

const DIM_SHORT: Record<string, string> = {
  environmental: 'E',
  social: 'S',
  governance: 'G',
};

export function EsgSentimentCard({ data }: EsgSentimentCardProps) {
  if (!data) return null;
  const d = data as unknown as EsgSentimentData;
  const dimensions = d.dimensions ?? {};
  const dimKeys = ['environmental', 'social', 'governance'] as const;
  const topRisks = (d.esgRisks ?? []).slice(0, 3);

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          ESG 여론 분석
          <AdvancedCardHelp {...ADVANCED_HELP.esgSentiment} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* E·S·G 차원별 점수 */}
        <div className="space-y-2">
          {dimKeys.map((key) => {
            const dim = dimensions[key];
            if (!dim) return null;
            const score = dim.score ?? 50;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{DIM_LABEL[key]}</span>
                  <span className={`font-bold ${getScoreColor(score)}`}>{score}</span>
                </div>
                <Progress value={score} className="h-2" />
                {dim.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{dim.summary}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* 규제 리스크 */}
        {d.regulatoryRisk && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">규제 리스크</span>
            <Badge variant="outline" className={REGULATORY_COLOR[d.regulatoryRisk]}>
              {REGULATORY_LABEL[d.regulatoryRisk] ?? d.regulatoryRisk}
            </Badge>
          </div>
        )}

        {/* ESG 리스크 상위 3개 */}
        {topRisks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              주요 리스크
            </p>
            {topRisks.map((risk, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className="shrink-0 text-[10px] px-1 py-0">
                  {DIM_SHORT[risk.dimension] ?? risk.dimension}
                </Badge>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] px-1 py-0 ${SEVERITY_COLOR[risk.severity]}`}
                >
                  {SEVERITY_LABEL[risk.severity] ?? risk.severity}
                </Badge>
                <span className="text-muted-foreground line-clamp-1">{risk.risk}</span>
              </div>
            ))}
          </div>
        )}

        {/* 요약 */}
        {d.summary && (
          <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-3">{d.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}
