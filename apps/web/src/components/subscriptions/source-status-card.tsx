'use client';

import { SOURCE_LABEL_MAP, formatRelative } from './subscription-utils';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RunRecord } from '@/server/trpc/routers/subscriptions';

interface ItemBreakdown {
  source: string;
  itemType: string;
  count: number;
}

interface SourceStatusCardProps {
  source: string;
  runs: RunRecord[];
  itemBreakdown?: ItemBreakdown[];
}

export function SourceStatusCard({ source, runs, itemBreakdown }: SourceStatusCardProps) {
  const sourceRuns = runs.filter((r) => r.source === source);
  const now = Date.now();
  const h24Ago = now - 24 * 3600 * 1000;
  const runs24h = sourceRuns.filter((r) => new Date(r.time).getTime() >= h24Ago);

  const completed = runs24h.filter((r) => r.status === 'completed').length;
  const failed = runs24h.filter((r) => r.status === 'failed').length;
  const blocked = runs24h.filter((r) => r.status === 'blocked').length;
  const total = runs24h.length;
  const successRate = total > 0 ? (completed / total) * 100 : -1;
  const totalCollected = sourceRuns.reduce((s, r) => s + (r.itemsCollected ?? 0), 0);

  const articleCount = itemBreakdown?.find((b) => b.itemType === 'article')?.count ?? 0;
  const videoCount = itemBreakdown?.find((b) => b.itemType === 'video')?.count ?? 0;
  const commentCount = itemBreakdown?.find((b) => b.itemType === 'comment')?.count ?? 0;

  const lastRun =
    sourceRuns.length > 0
      ? sourceRuns.reduce((latest, r) =>
          new Date(r.time).getTime() > new Date(latest.time).getTime() ? r : latest,
        )
      : null;

  const hasIssue = failed > 0 || blocked > 0;

  return (
    <Card className={cn('border-t-2', hasIssue ? 'border-t-amber-500' : 'border-t-emerald-500')}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{SOURCE_LABEL_MAP[source] ?? source}</span>
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              hasIssue ? 'bg-amber-500' : 'bg-emerald-500',
            )}
          />
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>수집량</span>
            <span className="font-medium text-foreground">{totalCollected.toLocaleString()}건</span>
          </div>
          {itemBreakdown && itemBreakdown.length > 0 && (
            <div className="pl-2 space-y-0.5 border-l-2 border-slate-200 ml-1">
              {articleCount > 0 && (
                <div className="flex justify-between">
                  <span>기사</span>
                  <span>{articleCount.toLocaleString()}</span>
                </div>
              )}
              {videoCount > 0 && (
                <div className="flex justify-between">
                  <span>영상</span>
                  <span>{videoCount.toLocaleString()}</span>
                </div>
              )}
              {commentCount > 0 && (
                <div className="flex justify-between">
                  <span>댓글</span>
                  <span>{commentCount.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between">
            <span>마지막</span>
            <span>{formatRelative(lastRun?.time)}</span>
          </div>
          <div className="flex justify-between">
            <span>24h 성공률</span>
            <span className={cn('font-medium', hasIssue ? 'text-amber-600' : 'text-emerald-600')}>
              {successRate >= 0 ? `${successRate.toFixed(0)}%` : '-'}
            </span>
          </div>
          {(failed > 0 || blocked > 0) && (
            <div className="flex justify-between text-amber-600">
              <span>실패/차단</span>
              <span>
                {failed > 0 && `실패 ${failed}`}
                {failed > 0 && blocked > 0 && ' / '}
                {blocked > 0 && `차단 ${blocked}`}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
