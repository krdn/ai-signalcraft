'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface Risk {
  title: string;
  description: string;
  impact: number;
  urgency: string;
  spreadPotential: string;
}

interface RiskCardsProps {
  risks: Risk[] | null;
}

// 긴급도 정렬 순서
const URGENCY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// 긴급도별 Badge 스타일
function getUrgencyBadge(urgency: string) {
  const level = urgency.toLowerCase();
  switch (level) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    case 'high':
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">High</Badge>;
    case 'medium':
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Medium</Badge>;
    case 'low':
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Low</Badge>;
    default:
      return <Badge variant="secondary">{urgency}</Badge>;
  }
}

// 영향도별 Progress bar 색상 클래스
function getImpactColorClass(impact: number): string {
  if (impact > 70) return '[&_[data-slot=progress-indicator]]:bg-destructive'; // red
  if (impact >= 40) return '[&_[data-slot=progress-indicator]]:bg-amber-500'; // amber
  return '[&_[data-slot=progress-indicator]]:bg-green-500'; // green
}

export function RiskCards({ risks }: RiskCardsProps) {
  // 긴급도별 정렬
  const sortedRisks = useMemo(() => {
    if (!risks) return [];
    return [...risks].sort(
      (a, b) => (URGENCY_ORDER[a.urgency.toLowerCase()] ?? 99) - (URGENCY_ORDER[b.urgency.toLowerCase()] ?? 99)
    );
  }, [risks]);

  return (
    <Card className="min-h-[280px]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">리스크 분석</CardTitle>
      </CardHeader>
      <CardContent>
        {!risks || risks.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground" role="status">
            리스크 없음
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRisks.map((risk, index) => (
              <div
                key={index}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-lg font-semibold leading-tight">{risk.title}</h4>
                  {getUrgencyBadge(risk.urgency)}
                </div>
                <p className="text-sm text-muted-foreground">{risk.description}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">영향도</span>
                    <span className="font-mono tabular-nums">{risk.impact}%</span>
                  </div>
                  <Progress value={risk.impact} className={getImpactColorClass(risk.impact)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
