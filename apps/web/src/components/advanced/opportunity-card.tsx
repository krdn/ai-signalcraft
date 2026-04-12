'use client';

import { Lightbulb, Star, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PositiveAsset {
  title: string;
  description: string;
  expandability: 'high' | 'medium' | 'low';
  recommendation: string;
  currentUtilization: 'fully' | 'partially' | 'unused';
}

interface UntappedArea {
  area: string;
  approach: string;
  potential: string;
}

interface PriorityOpportunity {
  title: string;
  reason: string;
  actionPlan: string;
}

interface OpportunityData {
  positiveAssets?: PositiveAsset[];
  untappedAreas?: UntappedArea[];
  priorityOpportunity?: PriorityOpportunity;
}

interface OpportunityCardProps {
  data: Record<string, unknown> | null;
}

const EXPANDABILITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: '확장성 높음', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  medium: { label: '확장성 보통', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  low: { label: '확장성 낮음', color: 'bg-gray-500/10 text-gray-600 border-gray-400/20' },
};

const UTILIZATION_CONFIG: Record<string, { label: string; color: string }> = {
  fully: { label: '충분 활용', color: 'text-green-600' },
  partially: { label: '부분 활용', color: 'text-amber-600' },
  unused: { label: '미활용', color: 'text-red-500' },
};

export function OpportunityCard({ data }: OpportunityCardProps) {
  const parsed = data as unknown as OpportunityData | null;

  if (!parsed) {
    return (
      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4" />
            기회 분석
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

  return (
    <Card className="min-h-[320px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4" />
          기회 분석
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 우선 기회 */}
        {parsed.priorityOpportunity && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold text-primary">핵심 기회</p>
            </div>
            <p className="text-sm font-medium">{parsed.priorityOpportunity.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {parsed.priorityOpportunity.reason}
            </p>
            <div className="border-t pt-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">실행 계획</p>
              <p className="text-xs leading-relaxed">{parsed.priorityOpportunity.actionPlan}</p>
            </div>
          </div>
        )}

        {/* 긍정 자산 */}
        {parsed.positiveAssets && parsed.positiveAssets.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground">활용 가능 자산</p>
            </div>
            {parsed.positiveAssets.map((asset, i) => {
              const expConfig =
                EXPANDABILITY_CONFIG[asset.expandability] ?? EXPANDABILITY_CONFIG.medium;
              const utilConfig =
                UTILIZATION_CONFIG[asset.currentUtilization] ?? UTILIZATION_CONFIG.partially;
              return (
                <div key={i} className="rounded-md border bg-card p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug">{asset.title}</p>
                    <div className="flex gap-1 shrink-0">
                      <Badge className={`text-[10px] px-1.5 py-0 border ${expConfig.color}`}>
                        {expConfig.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {asset.description}
                  </p>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground">현재 활용도:</span>
                    <span className={`font-medium ${utilConfig.color}`}>{utilConfig.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground border-t pt-1.5 leading-relaxed">
                    💡 {asset.recommendation}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* 미개척 영역 */}
        {parsed.untappedAreas && parsed.untappedAreas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">미개척 영역</p>
            {parsed.untappedAreas.map((area, i) => (
              <div key={i} className="rounded-md border border-dashed bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-medium">{area.area}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {area.potential}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
