import type { trpcClient } from '@/lib/trpc';

export type WorkerModalTab = 'queue-status' | 'stalled' | 'failed' | 'workers';

export interface WorkerManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: WorkerModalTab;
  focusJobId?: number | null;
}

/** tRPC getQueueOverview 반환 타입을 그대로 추론 */
export type QueueOverviewData = Awaited<
  ReturnType<typeof trpcClient.admin.workerMgmt.getQueueOverview.query>
>;
