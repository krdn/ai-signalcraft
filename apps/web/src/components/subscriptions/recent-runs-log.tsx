'use client';

import { useState } from 'react';
import { SOURCE_LABEL_MAP, formatRelative } from './subscription-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RunRecord } from '@/server/trpc/routers/subscriptions';

interface RecentRunsLogProps {
  runs: RunRecord[];
}

const STATUS_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
  { value: 'blocked', label: '차단' },
] as const;

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500';
    case 'failed':
      return 'bg-red-500';
    case 'blocked':
      return 'bg-amber-500';
    case 'running':
      return 'bg-blue-500';
    default:
      return 'bg-slate-400';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return '완료';
    case 'failed':
      return '실패';
    case 'blocked':
      return '차단';
    case 'running':
      return '실행 중';
    default:
      return status;
  }
}

export function RecentRunsLog({ runs }: RecentRunsLogProps) {
  const [filter, setFilter] = useState('all');

  const sorted = [...runs]
    .filter((r) => r.status !== 'running')
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 100);

  const filtered = filter === 'all' ? sorted : sorted.filter((r) => r.status === filter);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">최근 실행 로그</CardTitle>
        <div className="flex gap-0.5">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">실행 기록이 없습니다</p>
          ) : (
            filtered.map((run, i) => (
              <div
                key={`${run.runId}-${run.source}-${i}`}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs ${
                  run.status === 'failed' || run.status === 'blocked'
                    ? 'bg-destructive/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${getStatusColor(run.status)}`}
                />
                <span className="font-mono text-muted-foreground w-[50px] shrink-0">
                  {run.runId.slice(0, 7)}
                </span>
                <Badge variant="outline" className="text-[9px] font-normal shrink-0">
                  {SOURCE_LABEL_MAP[run.source] ?? run.source}
                </Badge>
                <span className="shrink-0">{getStatusLabel(run.status)}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {run.itemsCollected}건
                </span>
                {run.durationMs != null && (
                  <span className="text-muted-foreground tabular-nums hidden md:inline">
                    {(run.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
                {run.errorReason && (
                  <span className="text-destructive truncate max-w-[200px]">{run.errorReason}</span>
                )}
                <span className="ml-auto text-muted-foreground shrink-0">
                  {formatRelative(run.time)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
