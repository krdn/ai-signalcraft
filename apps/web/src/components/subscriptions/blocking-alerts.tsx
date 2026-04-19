'use client';

import { ShieldAlert } from 'lucide-react';
import { SOURCE_LABEL_MAP } from './subscription-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { SourceHealthRun } from '@/server/trpc/routers/subscriptions';

interface BlockingAlertsProps {
  runs: SourceHealthRun[];
}

export function BlockingAlerts({ runs }: BlockingAlertsProps) {
  const blockedSources = runs.filter((r) => {
    if (r.total === 0) return false;
    return r.blocked / r.total >= 0.2;
  });

  if (blockedSources.length === 0) return null;

  return (
    <Alert variant="destructive">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>차단 경고</AlertTitle>
      <AlertDescription>
        <div className="mt-1 space-y-2 text-xs">
          {blockedSources.map((r) => {
            const pct = Math.round((r.blocked / r.total) * 100);
            return (
              <div key={r.source}>
                <span className="font-medium">{SOURCE_LABEL_MAP[r.source] ?? r.source}</span>: 최근
                24시간 실행 중 {pct}% ({r.blocked}/{r.total}) 차단됨. 수집 주기 완화 또는 User-Agent
                로테이션 권장.
              </div>
            );
          })}
        </div>
      </AlertDescription>
    </Alert>
  );
}
