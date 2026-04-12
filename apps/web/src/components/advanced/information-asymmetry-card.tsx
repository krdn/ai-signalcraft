'use client';

import { ArrowRight, Lightbulb, AlertCircle, Eye } from 'lucide-react';
import { AdvancedCardHelp, ADVANCED_HELP } from './advanced-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InformationCascade {
  cascade: string;
  origin: string;
  spreadPath: string;
  magnitude: 'high' | 'medium' | 'low';
}

interface LeadingIndicator {
  indicator: string;
  platform: string;
  significance: 'high' | 'medium' | 'low';
  lagTime: string;
}

interface InformationVacuum {
  vacuum: string;
  rumorRisk: 'high' | 'medium' | 'low';
  fillRecommendation: string;
}

interface InformationAsymmetryData {
  asymmetryLevel: 'high' | 'medium' | 'low';
  informationCascades: InformationCascade[];
  leadingIndicators: LeadingIndicator[];
  informationVacuums: InformationVacuum[];
  smartMoneySignals: string[];
  disclaimer: string;
  summary: string;
}

interface InformationAsymmetryCardProps {
  data: Record<string, unknown> | null;
}

const LEVEL_CONFIG = {
  high: { label: '높음', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
  medium: { label: '보통', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  low: { label: '낮음', className: 'bg-green-500/10 text-green-700 border-green-500/20' },
};

const ASYMMETRY_CONFIG = {
  high: { label: '격차 큼', description: '기관-개인 정보 격차 심각', color: 'text-red-600' },
  medium: { label: '격차 보통', description: '기관-개인 정보 격차 존재', color: 'text-amber-600' },
  low: { label: '격차 적음', description: '비교적 균등한 정보 접근', color: 'text-green-600' },
};

export function InformationAsymmetryCard({ data }: InformationAsymmetryCardProps) {
  const parsed = data as unknown as InformationAsymmetryData | null;

  if (!parsed) {
    return (
      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
            정보 비대칭 분석
            <AdvancedCardHelp {...ADVANCED_HELP.informationAsymmetry} />
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

  const asymConfig = ASYMMETRY_CONFIG[parsed.asymmetryLevel];

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          정보 비대칭 분석
          <AdvancedCardHelp {...ADVANCED_HELP.informationAsymmetry} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 정보 비대칭 수준 */}
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className={`text-sm font-semibold ${asymConfig.color}`}>{asymConfig.label}</p>
            <p className="text-xs text-muted-foreground">{asymConfig.description}</p>
          </div>
          <Badge className={`ml-auto border ${LEVEL_CONFIG[parsed.asymmetryLevel].className}`}>
            {LEVEL_CONFIG[parsed.asymmetryLevel].label}
          </Badge>
        </div>

        {/* 정보 폭포 */}
        {parsed.informationCascades.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">정보 폭포 현상</p>
            <div className="space-y-2">
              {parsed.informationCascades.slice(0, 2).map((cascade, i) => (
                <div key={i} className="rounded border px-2.5 py-2 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[10px] px-1 py-0 border ${LEVEL_CONFIG[cascade.magnitude].className}`}>
                      {LEVEL_CONFIG[cascade.magnitude].label}
                    </Badge>
                    <span className="text-muted-foreground">발원: {cascade.origin}</span>
                  </div>
                  <p className="font-medium">{cascade.cascade}</p>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span>{cascade.spreadPath}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 선행 지표 */}
        {parsed.leadingIndicators.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">선행 지표</p>
            <div className="space-y-1.5">
              {parsed.leadingIndicators.slice(0, 3).map((ind, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{ind.indicator}</span>
                    <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                      <span>{ind.platform}</span>
                      <span>·</span>
                      <span>선행 {ind.lagTime}</span>
                    </div>
                  </div>
                  <Badge className={`text-[10px] px-1 py-0 border shrink-0 ${LEVEL_CONFIG[ind.significance].className}`}>
                    {LEVEL_CONFIG[ind.significance].label}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 정보 공백 */}
        {parsed.informationVacuums.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">정보 공백 (루머 위험)</p>
            {parsed.informationVacuums.slice(0, 2).map((vac, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p>{vac.vacuum}</p>
                  <p className="text-muted-foreground mt-0.5">{vac.fillRecommendation}</p>
                </div>
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
