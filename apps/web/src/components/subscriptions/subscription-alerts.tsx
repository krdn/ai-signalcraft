'use client';

import { AlertTriangle } from 'lucide-react';
import { formatRelative, SOURCE_LABEL_MAP } from './subscription-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

interface SubscriptionAlertsProps {
  subscriptions: SubscriptionRecord[];
}

export function SubscriptionAlerts({ subscriptions }: SubscriptionAlertsProps) {
  const errorSubs = subscriptions.filter((s) => s.status === 'error' || s.lastError);

  if (errorSubs.length === 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>수집 오류 {errorSubs.length}건</AlertTitle>
      <AlertDescription>
        <div className="mt-1 space-y-1 text-xs">
          {errorSubs.map((sub) => (
            <div key={sub.id} className="flex items-start gap-1">
              <span className="font-medium">&quot;{sub.keyword}&quot;</span>
              <span className="text-muted-foreground">
                ({(sub.sources as string[]).map((s) => SOURCE_LABEL_MAP[s] ?? s).join(', ')})
              </span>
              {sub.lastError && <span className="truncate max-w-[300px]">— {sub.lastError}</span>}
              <span className="text-muted-foreground ml-auto shrink-0">
                {formatRelative(sub.lastErrorAt)}
              </span>
            </div>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
