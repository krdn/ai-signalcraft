'use client';

import { SOURCE_LABEL_MAP } from './subscription-utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubscriptionRecord } from '@/server/trpc/routers/subscriptions';

interface SubscriptionStatusBarProps {
  subscriptions: SubscriptionRecord[];
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export function SubscriptionStatusBar({
  subscriptions,
  statusFilter,
  onStatusFilterChange,
}: SubscriptionStatusBarProps) {
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const pausedCount = subscriptions.filter((s) => s.status === 'paused').length;
  const errorCount = subscriptions.filter((s) => s.status === 'error').length;

  const sourceCounts: Record<string, number> = {};
  for (const sub of subscriptions) {
    for (const src of sub.sources) {
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }
  }

  const statusItems = [
    { key: 'active', label: '활성', count: activeCount, dot: 'bg-emerald-500' },
    { key: 'paused', label: '정지', count: pausedCount, dot: 'bg-slate-400' },
    { key: 'error', label: '오류', count: errorCount, dot: 'bg-red-500' },
  ];

  // SUBS-006: 모든 상태가 0이면 status-bar 자체를 의미 없는 데드 클릭 영역으로 두지 않고
  // 안내 메시지로 대체.
  const totalStatusCount = activeCount + pausedCount + errorCount;
  if (totalStatusCount === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground"
        role="status"
      >
        아직 등록된 구독이 없습니다. 첫 키워드 구독을 등록하면 상태별 필터가 활성화됩니다.
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between flex-wrap gap-2 rounded-lg border px-4 py-2.5"
      role="group"
      aria-label="구독 상태별 필터"
    >
      <h2 className="sr-only">구독 상태별 필터</h2>
      <div className="flex items-center gap-4">
        {statusItems.map((item) => {
          // SUBS-006: count === 0인 상태 버튼은 disabled로 비활성화하여 데드 클릭 방지.
          const isEmpty = item.count === 0;
          const isSelected = statusFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onStatusFilterChange(statusFilter === item.key ? 'all' : item.key)}
              disabled={isEmpty}
              aria-pressed={isSelected}
              aria-label={`${item.label} ${item.count}개${isEmpty ? ' (해당 상태 구독 없음)' : ''}`}
              title={
                isEmpty ? `${item.label} 상태의 구독이 없습니다` : `${item.label} 상태 구독만 보기`
              }
              className={cn(
                'flex items-center gap-1.5 text-sm transition-colors',
                isEmpty
                  ? 'cursor-not-allowed text-muted-foreground/50'
                  : isSelected
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  item.dot,
                  isEmpty && 'opacity-50',
                )}
              />
              {item.label} {item.count}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        {Object.entries(sourceCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => (
            <Badge key={source} variant="outline" className="text-[10px] font-normal">
              {SOURCE_LABEL_MAP[source] ?? source} {count}
            </Badge>
          ))}
      </div>
    </div>
  );
}
