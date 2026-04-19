'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, CircleSlash } from 'lucide-react';
import { WorkerManagementModal } from './worker-management-modal';
import { trpcClient } from '@/lib/trpc';

const HEALTH_COLOR: Record<string, string> = {
  healthy: 'text-green-600 bg-green-100 dark:bg-green-950',
  idle: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800',
  stuck: 'text-amber-600 bg-amber-100 dark:bg-amber-950',
  warn: 'text-amber-600 bg-amber-100 dark:bg-amber-950',
  down: 'text-red-600 bg-red-100 dark:bg-red-950',
};

const HEALTH_ICON: Record<string, typeof Activity> = {
  healthy: Activity,
  idle: Activity,
  stuck: AlertCircle,
  warn: AlertCircle,
  down: CircleSlash,
};

export function WorkerHealthBadge() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['admin', 'workerStatus'],
    queryFn: () => trpcClient.admin.workerStatus.query(),
    refetchInterval: 10_000,
  });

  if (!data) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
      >
        {data.map((q) => {
          const Icon = HEALTH_ICON[q.health] ?? Activity;
          const color = HEALTH_COLOR[q.health] ?? '';
          return (
            <span key={q.queue} className={`flex items-center gap-1 rounded px-2 py-0.5 ${color}`}>
              <Icon className="h-3 w-3" />
              {q.queue} ({q.workerCount})
            </span>
          );
        })}
      </button>
      <WorkerManagementModal open={open} onOpenChange={setOpen} defaultTab="queue-status" />
    </>
  );
}
