'use client';

import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PerceptionBias {
  biasType: 'dread-factor' | 'unknown-risk' | 'normalcy-bias' | 'availability-heuristic' | 'other';
  biasName: string;
  description: string;
  affectedGroups: string[];
  intensity: 'high' | 'medium' | 'low';
}

interface MisinformationPattern {
  claim: string;
  spreadLevel: 'high' | 'medium' | 'low';
  correctionPriority: 'urgent' | 'high' | 'medium' | 'low';
}

interface HealthRiskPerceptionData {
  perceivedRiskLevel: 'overestimated' | 'accurate' | 'underestimated';
  expertRiskVsPublicPerception: {
    expertAssessment: string;
    publicPerception: string;
    gap: string;
    gapMagnitude: 'large' | 'moderate' | 'small';
  };
  perceptionBiases: PerceptionBias[];
  misinformationPatterns: MisinformationPattern[];
  communicationRecommendations: {
    recommendation: string;
    targetAudience: string;
    channel: string;
  }[];
  summary: string;
}

interface HealthRiskPerceptionCardProps {
  data: Record<string, unknown> | null;
}

const RISK_LEVEL_CONFIG = {
  overestimated: {
    label: '과대 인식',
    color: 'text-orange-600',
    bgColor: 'bg-orange-500/10 border-orange-500/20',
    icon: TrendingUp,
  },
  accurate: {
    label: '정확한 인식',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10 border-green-500/20',
    icon: CheckCircle,
  },
  underestimated: {
    label: '과소 인식',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    icon: TrendingDown,
  },
};

const BIAS_TYPE_LABELS: Record<string, string> = {
  'dread-factor': '공포 요소',
  'unknown-risk': '미지성 위험',
  'normalcy-bias': '정상화 편향',
  'availability-heuristic': '가용성 휴리스틱',
  other: '기타',
};

const INTENSITY_CONFIG = {
  high: { label: '높음', color: 'bg-red-500/15 text-red-600 border-red-500/20' },
  medium: { label: '보통', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  low: { label: '낮음', color: 'bg-gray-500/15 text-gray-600 border-gray-500/20' },
};

const PRIORITY_CONFIG = {
  urgent: { label: '긴급', color: 'bg-red-500/15 text-red-600 border-red-500/20' },
  high: { label: '높음', color: 'bg-orange-500/15 text-orange-600 border-orange-500/20' },
  medium: { label: '보통', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20' },
  low: { label: '낮음', color: 'bg-gray-500/15 text-gray-600 border-gray-500/20' },
};

export function HealthRiskPerceptionCard({ data }: HealthRiskPerceptionCardProps) {
  if (!data) return null;
  const result = data as unknown as HealthRiskPerceptionData;

  const riskConfig = RISK_LEVEL_CONFIG[result.perceivedRiskLevel] ?? RISK_LEVEL_CONFIG.accurate;
  const RiskIcon = riskConfig.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          건강 위험 인식 분석
          <AdvancedCardHelp {...ADVANCED_HELP.healthRiskPerception} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 위험 인식 수준 */}
        <div className={`rounded-lg border p-3 ${riskConfig.bgColor}`}>
          <div className="flex items-center gap-2">
            <RiskIcon className={`h-5 w-5 ${riskConfig.color}`} />
            <span className={`font-semibold text-sm ${riskConfig.color}`}>
              대중 위험 인식: {riskConfig.label}
            </span>
          </div>
          {result.expertRiskVsPublicPerception?.gap && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {result.expertRiskVsPublicPerception.gap}
            </p>
          )}
        </div>

        {/* 전문가 vs 대중 비교 */}
        {result.expertRiskVsPublicPerception && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border p-2 bg-muted/30">
              <p className="font-medium text-muted-foreground mb-1">전문가 평가</p>
              <p>{result.expertRiskVsPublicPerception.expertAssessment || '—'}</p>
            </div>
            <div className="rounded border p-2 bg-muted/30">
              <p className="font-medium text-muted-foreground mb-1">대중 인식</p>
              <p>{result.expertRiskVsPublicPerception.publicPerception || '—'}</p>
            </div>
          </div>
        )}

        {/* 인식 편향 목록 */}
        {result.perceptionBiases.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">인식 편향 유형</p>
            <div className="space-y-2">
              {result.perceptionBiases.slice(0, 3).map((bias, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${INTENSITY_CONFIG[bias.intensity]?.color ?? ''}`}
                  >
                    {INTENSITY_CONFIG[bias.intensity]?.label ?? bias.intensity}
                  </Badge>
                  <div>
                    <span className="font-medium">
                      {BIAS_TYPE_LABELS[bias.biasType] ?? bias.biasType}
                    </span>
                    {bias.biasName && bias.biasName !== BIAS_TYPE_LABELS[bias.biasType] && (
                      <span className="text-muted-foreground"> · {bias.biasName}</span>
                    )}
                    {bias.description && (
                      <p className="text-muted-foreground mt-0.5">{bias.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 오정보 패턴 */}
        {result.misinformationPatterns.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">주요 오정보 패턴</p>
            <div className="space-y-1.5">
              {result.misinformationPatterns.slice(0, 3).map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-orange-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">{m.claim}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${PRIORITY_CONFIG[m.correctionPriority]?.color ?? ''}`}
                  >
                    {PRIORITY_CONFIG[m.correctionPriority]?.label ?? m.correctionPriority}
                  </Badge>
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
