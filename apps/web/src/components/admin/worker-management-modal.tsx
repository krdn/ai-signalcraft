'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { QueueStatusTab } from './worker-management/queue-status-tab';
import { StalledJobsTab } from './worker-management/stalled-jobs-tab';
import { FailedJobsTab } from './worker-management/failed-jobs-tab';
import { WorkersTab } from './worker-management/workers-tab';
import type { WorkerManagementModalProps } from './worker-management/types';
import { trpcClient } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function WorkerManagementModal({
  open,
  onOpenChange,
  defaultTab = 'queue-status',
  focusJobId,
}: WorkerManagementModalProps) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'workerMgmt', 'overview'],
    queryFn: () => trpcClient.admin.workerMgmt.getQueueOverview.query(),
    refetchInterval: open ? 5_000 : false,
    enabled: open,
  });

  const stalledCount = data?.stalledJobs.length ?? 0;
  const failedCount = data?.failedJobs.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" showCloseButton>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              워커 관리
              {focusJobId && (
                <span className="text-xs font-normal text-muted-foreground">Job #{focusJobId}</span>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mr-6"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <Tabs defaultValue={defaultTab} className="mt-2">
            <TabsList variant="line">
              <TabsTrigger value="queue-status">큐 상태</TabsTrigger>
              <TabsTrigger value="stalled" className="gap-1">
                Stalled Jobs
                {stalledCount > 0 && (
                  <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                    {stalledCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="failed" className="gap-1">
                Failed Jobs
                {failedCount > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                    {failedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="workers">워커</TabsTrigger>
            </TabsList>

            <TabsContent value="queue-status">
              <QueueStatusTab data={data} onRefresh={refetch} />
            </TabsContent>
            <TabsContent value="stalled">
              <StalledJobsTab stalledJobs={data.stalledJobs} onRefresh={refetch} />
            </TabsContent>
            <TabsContent value="failed">
              <FailedJobsTab failedJobs={data.failedJobs} onRefresh={refetch} />
            </TabsContent>
            <TabsContent value="workers">
              <WorkersTab workerHealth={data.workerHealth} />
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
