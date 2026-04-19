'use client';

import { Clock, Zap, Play } from 'lucide-react';
import { formatRelative, SOURCE_LABEL_MAP, getStatusLabel } from './subscription-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionActions } from '@/hooks/use-subscription-actions';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

interface UpcomingRunsProps {
  subscriptions: SubscriptionRecord[];
}

export function UpcomingRuns({ subscriptions }: UpcomingRunsProps) {
  const { triggerNow, resume } = useSubscriptionActions();

  const sorted = [...subscriptions].sort((a, b) => {
    if (!a.nextRunAt && !b.nextRunAt) return 0;
    if (!a.nextRunAt) return 1;
    if (!b.nextRunAt) return -1;
    return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          다음 예정 수집
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">예정된 수집이 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {sorted.map((sub) => (
              <div
                key={sub.id}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  sub.status === 'paused' ? 'opacity-50' : ''
                }`}
              >
                <span className={`font-medium ${sub.status === 'paused' ? 'line-through' : ''}`}>
                  {sub.keyword}
                </span>
                <span className="text-xs text-muted-foreground">
                  {sub.status === 'paused'
                    ? getStatusLabel(sub.status)
                    : formatRelative(sub.nextRunAt)}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <div className="flex gap-0.5">
                    {(sub.sources as string[]).map((s) => (
                      <Badge key={s} variant="outline" className="text-[9px] font-normal">
                        {SOURCE_LABEL_MAP[s] ?? s}
                      </Badge>
                    ))}
                  </div>
                  {sub.status === 'active' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => triggerNow.mutate(sub.id)}
                      disabled={triggerNow.isPending}
                      title="즉시 수집"
                    >
                      <Zap className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => resume.mutate(sub.id)}
                      disabled={resume.isPending}
                      title="재개"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
