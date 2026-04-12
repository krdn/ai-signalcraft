'use client';

import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HbmLevelFactor {
  level: 'high' | 'medium' | 'low';
  evidence: string;
}

interface HbmFactors {
  perceivedSusceptibility: HbmLevelFactor;
  perceivedSeverity: HbmLevelFactor;
  perceivedBenefits: HbmLevelFactor;
  perceivedBarriers: { barrier: string; severity: 'high' | 'medium' | 'low' }[];
  cuesToAction: string[];
  selfEfficacy: HbmLevelFactor;
}

interface SegmentCompliance {
  segment: string;
  complianceProbability: number;
  keyBarriers: string[];
  keyMotivators: string[];
}

interface InterventionRecommendation {
  intervention: string;
  targetFactor: string;
  expectedImpact: string;
  priority: 'high' | 'medium' | 'low';
}

interface CompliancePredictorData {
  overallComplianceProbability: number;
  hbmFactors: HbmFactors;
  segmentCompliance: SegmentCompliance[];
  interventionRecommendations: InterventionRecommendation[];
  summary: string;
}

interface CompliancePredictorCardProps {
  data: Record<string, unknown> | null;
}

const LEVEL_CONFIG = {
  high: { label: '높음', color: 'text-green-600', bgColor: 'bg-green-500/10' },
  medium: { label: '보통', color: 'text-yellow-600', bgColor: 'bg-yellow-500/10' },
  low: { label: '낮음', color: 'text-red-600', bgColor: 'bg-red-500/10' },
};

const HBM_FACTOR_LABELS: Record<string, string> = {
  perceivedSusceptibility: '인지된 취약성',
  perceivedSeverity: '인지된 심각성',
  perceivedBenefits: '인지된 이익',
  selfEfficacy: '자기효능감',
};

function ProbabilityBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-9 text-right">{value}%</span>
    </div>
  );
}

export function CompliancePredictorCard({ data }: CompliancePredictorCardProps) {
  if (!data) return null;
  const result = data as unknown as CompliancePredictorData;

  const prob = result.overallComplianceProbability ?? 50;
  const probColor = prob >= 70 ? 'text-green-600' : prob >= 40 ? 'text-yellow-600' : 'text-red-600';
  const probBg = prob >= 70 ? 'bg-green-500/10 border-green-500/20' : prob >= 40 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20';

  const hbmFactors = result.hbmFactors;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          의료 순응도 예측
          <AdvancedCardHelp {...ADVANCED_HELP.compliancePredictor} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 전체 순응 확률 */}
        <div className={`rounded-lg border p-3 ${probBg}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className={`h-4 w-4 ${probColor}`} />
              <span className="text-sm font-medium">전체 의료 순응 예측</span>
            </div>
            <span className={`text-2xl font-bold ${probColor}`}>{prob}%</span>
          </div>
          <ProbabilityBar value={prob} />
        </div>

        {/* HBM 핵심 4요인 */}
        {hbmFactors && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">HBM 핵심 요인</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(HBM_FACTOR_LABELS) as [keyof typeof hbmFactors, string][]).map(([key, label]) => {
                const factor = hbmFactors[key] as { level: 'high' | 'medium' | 'low'; evidence: string } | undefined;
                if (!factor) return null;
                const config = LEVEL_CONFIG[factor.level] ?? LEVEL_CONFIG.medium;
                const LevelIcon = factor.level === 'high' ? ChevronUp : factor.level === 'low' ? ChevronDown : null;
                return (
                  <div key={key} className={`rounded border p-2 text-xs ${config.bgColor}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className={`font-semibold flex items-center gap-0.5 ${config.color}`}>
                        {LevelIcon && <LevelIcon className="h-3 w-3" />}
                        {config.label}
                      </span>
                    </div>
                    {factor.evidence && (
                      <p className="text-muted-foreground line-clamp-2">{factor.evidence}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 인지된 장벽 */}
        {hbmFactors?.perceivedBarriers && hbmFactors.perceivedBarriers.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">인지된 장벽</p>
            <div className="space-y-1">
              {hbmFactors.perceivedBarriers.slice(0, 3).map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${
                      b.severity === 'high'
                        ? 'bg-red-500/15 text-red-600 border-red-500/20'
                        : b.severity === 'medium'
                          ? 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20'
                          : 'bg-gray-500/15 text-gray-600 border-gray-500/20'
                    }`}
                  >
                    {b.severity === 'high' ? '높음' : b.severity === 'medium' ? '보통' : '낮음'}
                  </Badge>
                  <span>{b.barrier}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 집단별 순응도 */}
        {result.segmentCompliance.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">집단별 순응 예측</p>
            <div className="space-y-2">
              {result.segmentCompliance.slice(0, 4).map((seg, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{seg.segment}</span>
                    <span className="text-muted-foreground">{seg.complianceProbability}%</span>
                  </div>
                  <ProbabilityBar value={seg.complianceProbability} />
                </div>
              ))}
            </div>
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
