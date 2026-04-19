'use client';

import { SOURCE_LABEL_MAP } from './subscription-utils';
import { Badge } from '@/components/ui/badge';
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

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg border px-4 py-2.5">
      <div className="flex items-center gap-4">
        {statusItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onStatusFilterChange(statusFilter === item.key ? 'all' : item.key)}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              statusFilter === item.key
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${item.dot}`} />
            {item.label} {item.count}
          </button>
        ))}
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
