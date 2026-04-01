'use client';

import { Lightbulb } from 'lucide-react';
import { CardHelp, DASHBOARD_HELP } from './card-help';
import { Card, CardContent } from '@/components/ui/card';

interface CriticalAction {
  priority: number;
  action: string;
  expectedImpact: string;
  timeline: string;
}

interface InsightSummaryProps {
  oneLiner: string | null;
  currentState: { summary: string; sentiment: string; keyFactor: string } | null;
  criticalActions: CriticalAction[] | null;
}

export function InsightSummary({ oneLiner, currentState, criticalActions }: InsightSummaryProps) {
  if (!oneLiner && !currentState && !criticalActions) {
    return null;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-500">
          <Lightbulb className="h-4 w-4" />
          <span className="text-sm font-semibold flex-1">핵심 인사이트</span>
          <CardHelp {...DASHBOARD_HELP.insight} />
        </div>

        {oneLiner && <p className="text-sm font-medium leading-relaxed">{oneLiner}</p>}

        <ul className="space-y-1.5">
          {currentState && (
            <li className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">현황:</span> {currentState.summary}
            </li>
          )}
          {currentState?.keyFactor && (
            <li className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">핵심 요인:</span>{' '}
              {currentState.keyFactor}
            </li>
          )}
          {criticalActions?.slice(0, 3).map((action) => (
            <li key={action.priority} className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">조치 {action.priority}:</span>{' '}
              {action.action} ({action.timeline})
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
