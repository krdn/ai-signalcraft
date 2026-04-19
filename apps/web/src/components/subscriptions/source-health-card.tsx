'use client';

import { SOURCE_LABEL_MAP } from './subscription-utils';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SourceHealthRun, SourceHealthError } from '@/server/trpc/routers/subscriptions';

interface SourceHealthCardProps {
  source: string;
  run?: SourceHealthRun;
  errors: SourceHealthError[];
}

export function SourceHealthCard({ source, run, errors }: SourceHealthCardProps) {
  const total = run?.total ?? 0;
  const completed = run?.completed ?? 0;
  const blocked = run?.blocked ?? 0;
  const failed = run?.failed ?? 0;
  const successRate = total > 0 ? (completed / total) * 100 : -1;
  const hasIssue = blocked > 0 || failed > 0;
  const sourceErrors = errors.filter((e) => e.source === source);

  return (
    <Card
      className={cn(
        'border-t-2',
        hasIssue
          ? blocked > failed
            ? 'border-t-amber-500'
            : 'border-t-red-500'
          : 'border-t-emerald-500',
      )}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{SOURCE_LABEL_MAP[source] ?? source}</span>
          <span
            className={cn('text-xs font-medium', hasIssue ? 'text-amber-600' : 'text-emerald-600')}
          >
            {hasIssue ? '경고' : '정상'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <Row label="실행" value={`${total}회`} />
          <Row
            label="성공"
            value={successRate >= 0 ? `${completed} (${successRate.toFixed(0)}%)` : '-'}
          />
          <Row label="차단" value={String(blocked)} warn={blocked > 0} />
          <Row label="실패" value={String(failed)} warn={failed > 0} />
          <Row
            label="평균 소요"
            value={run?.avgDurationMs != null ? `${(run.avgDurationMs / 1000).toFixed(1)}초` : '-'}
          />
          {sourceErrors.length > 0 && (
            <div className="pt-1 border-t mt-1">
              <span className="text-[10px] font-medium">오류 유형:</span>
              {sourceErrors.map((e) => (
                <div key={e.errorType} className="flex justify-between text-[10px]">
                  <span>{e.errorType}</span>
                  <span>{e.count}건</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className={cn('font-medium', warn ? 'text-amber-600' : 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}
