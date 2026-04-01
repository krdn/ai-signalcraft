'use client';

import { useMemo } from 'react';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface Opportunity {
  title: string;
  description: string;
  impact: number;
  feasibility: string;
}

interface OpportunityCardsProps {
  opportunities: Opportunity[] | null;
}

// 실현가능성 정렬 순서 (높을수록 우선)
const FEASIBILITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// 실현가능성별 Badge 스타일
function getFeasibilityBadge(feasibility: string) {
  const level = feasibility.toLowerCase();
  switch (level) {
    case 'high':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">High</Badge>;
    case 'medium':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Medium</Badge>;
    case 'low':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Low</Badge>;
    default:
      return <Badge variant="secondary">{feasibility}</Badge>;
  }
}

// 영향도별 Progress bar 색상 클래스
function getImpactColorClass(impact: number): string {
  if (impact > 70) return '[&_[data-slot=progress-indicator]]:bg-destructive';
  if (impact >= 40) return '[&_[data-slot=progress-indicator]]:bg-amber-500';
  return '[&_[data-slot=progress-indicator]]:bg-green-500';
}

export function OpportunityCards({ opportunities }: OpportunityCardsProps) {
  // 실현가능성별 정렬
  const sortedOpportunities = useMemo(() => {
    if (!opportunities) return [];
    return [...opportunities].sort(
      (a, b) =>
        (FEASIBILITY_ORDER[a.feasibility.toLowerCase()] ?? 99) -
        (FEASIBILITY_ORDER[b.feasibility.toLowerCase()] ?? 99),
    );
  }, [opportunities]);

  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">기회 분석</CardTitle>
          <CardHelp {...DASHBOARD_HELP.opportunity} />
        </div>
      </CardHeader>
      <CardContent>
        {!opportunities || opportunities.length === 0 ? (
          <div
            className="flex items-center justify-center h-[200px] text-muted-foreground"
            role="status"
          >
            기회 없음
          </div>
        ) : (
          <div className="space-y-3">
            {sortedOpportunities.map((opportunity, index) => (
              <div key={index} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-lg font-semibold leading-tight">{opportunity.title}</h4>
                  {getFeasibilityBadge(opportunity.feasibility)}
                </div>
                <p className="text-sm text-muted-foreground">{opportunity.description}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">영향도</span>
                    <span className="font-mono tabular-nums">{opportunity.impact}%</span>
                  </div>
                  <Progress
                    value={opportunity.impact}
                    className={getImpactColorClass(opportunity.impact)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
