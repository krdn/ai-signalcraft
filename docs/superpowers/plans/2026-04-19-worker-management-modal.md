# 워커 관리 모달 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BullMQ 큐/워커 통합 관리 모달을 구현하여, 분산된 워커 관리 UI를 하나로 통합하고 stalled/failed job 정리 기능을 제공한다.

**Architecture:** 새 tRPC 라우터(`admin.workerMgmt`)에 큐 관리 API를 추가하고, `WorkerManagementModal` 컴포넌트에서 4개 탭(큐 상태, Stalled Jobs, Failed Jobs, 워커)으로 제공한다. 기존 `WorkerHealthBadge`와 `WorkerStatusBar`에서 동일 모달을 열되 진입점별 초기 탭이 다르다.

**Tech Stack:** React 19, tRPC 11, BullMQ 5, shadcn/ui (Dialog, Tabs, AlertDialog), TanStack Query 5, Zod 3, sonner (toast)

---

## 파일 구조

### 새로 생성

| 파일                                                                   | 역할                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/core/src/pipeline/worker-management.ts`                      | 큐 관리 비즈니스 로직 (pause/resume, stalled/failed 조회, retry, remove) |
| `apps/web/src/server/trpc/routers/admin/worker-management.ts`          | tRPC 라우터 (시스템 관리자 전용)                                         |
| `apps/web/src/components/admin/worker-management-modal.tsx`            | 메인 모달 (Dialog + Tabs 컨테이너)                                       |
| `apps/web/src/components/admin/worker-management/queue-status-tab.tsx` | 탭 1: 큐 상태 + pause/resume                                             |
| `apps/web/src/components/admin/worker-management/stalled-jobs-tab.tsx` | 탭 2: Stalled job 목록 + 정리                                            |
| `apps/web/src/components/admin/worker-management/failed-jobs-tab.tsx`  | 탭 3: Failed job 목록 + 재시도/삭제                                      |
| `apps/web/src/components/admin/worker-management/workers-tab.tsx`      | 탭 4: 워커 상태                                                          |
| `apps/web/src/components/admin/worker-management/types.ts`             | 공유 타입 정의                                                           |

### 수정

| 파일                                                                      | 변경 내용                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| `packages/core/src/pipeline/control.ts`                                   | worker-management.ts 함수들 re-export 추가       |
| `apps/web/src/server/trpc/routers/admin/index.ts`                         | workerMgmt 라우터 등록                           |
| `apps/web/src/components/admin/worker-health-badge.tsx`                   | WorkerHealthModal → WorkerManagementModal로 교체 |
| `apps/web/src/components/analysis/pipeline-monitor/worker-status-bar.tsx` | "관리" 버튼 추가 + WorkerManagementModal 연결    |
| `apps/web/src/components/analysis/trigger-form.tsx`                       | handleSubmit에 고아 job 확인 다이얼로그 추가     |

### 삭제

| 파일                                                    | 이유           |
| ------------------------------------------------------- | -------------- |
| `apps/web/src/components/admin/worker-health-modal.tsx` | 새 모달로 대체 |
| `apps/web/src/app/queue-status/page.tsx`                | 새 모달로 대체 |

---

## Task 1: 백엔드 — 큐 관리 비즈니스 로직

**Files:**

- Create: `packages/core/src/pipeline/worker-management.ts`
- Modify: `packages/core/src/pipeline/control.ts:16-23`

- [ ] **Step 1: worker-management.ts 작성**

`packages/core/src/pipeline/worker-management.ts`:

```typescript
import { Queue, Job } from 'bullmq';
import { getQueue } from './queue-management';

const QUEUE_NAMES = ['collectors', 'pipeline', 'analysis'] as const;
type QueueName = (typeof QUEUE_NAMES)[number];

const queueNameSchema = (name: string): QueueName => {
  if (QUEUE_NAMES.includes(name as QueueName)) return name as QueueName;
  throw new Error(`Invalid queue name: ${name}`);
};

export async function pauseQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueNameSchema(queueName));
  await queue.pause();
}

export async function resumeQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueNameSchema(queueName));
  await queue.resume();
}

export async function getStalledJobs(): Promise<
  Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    elapsedSeconds: number;
    processedOn: number | null;
  }>
> {
  const STALLED_THRESHOLD_MS = 10 * 60 * 1000;
  const now = Date.now();
  const result: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    elapsedSeconds: number;
    processedOn: number | null;
  }> = [];

  for (const queueName of QUEUE_NAMES) {
    const queue = getQueue(queueName);
    try {
      const activeJobs = await queue.getJobs(['active']);
      for (const job of activeJobs) {
        if (!job.processedOn) continue;
        const elapsed = now - job.processedOn;
        if (elapsed > STALLED_THRESHOLD_MS) {
          result.push({
            queue: queueName,
            bullmqId: job.id ?? '',
            name: job.name,
            dbJobId: (job.data?.dbJobId as number) ?? null,
            elapsedSeconds: Math.floor(elapsed / 1000),
            processedOn: job.processedOn,
          });
        }
      }
    } catch {
      // 큐 접근 실패
    }
  }

  return result;
}

export async function removeStalledJobs(
  jobs: Array<{ bullmqId: string; queue: string }>,
): Promise<number> {
  let removed = 0;
  for (const { bullmqId, queue: queueName } of jobs) {
    const queue = getQueue(queueNameSchema(queueName));
    try {
      const job = await Job.fromId(queue, bullmqId);
      if (job) {
        await job.remove();
        removed++;
      }
    } catch {
      // 이미 제거되었거나 상태 변경됨
    }
  }
  return removed;
}

export async function getFailedJobs(): Promise<
  Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    failedReason: string | null;
    timestamp: number | null;
    finishedOn: number | null;
  }>
> {
  const result: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    failedReason: string | null;
    timestamp: number | null;
    finishedOn: number | null;
  }> = [];

  for (const queueName of QUEUE_NAMES) {
    const queue = getQueue(queueName);
    try {
      const failedJobs = await queue.getJobs(['failed'], 0, 50);
      for (const job of failedJobs) {
        result.push({
          queue: queueName,
          bullmqId: job.id ?? '',
          name: job.name,
          dbJobId: (job.data?.dbJobId as number) ?? null,
          failedReason: job.failedReason ?? null,
          timestamp: job.timestamp ?? null,
          finishedOn: job.finishedOn ?? null,
        });
      }
    } catch {
      // 큐 접근 실패
    }
  }

  return result;
}

export async function retryFailedJob(bullmqId: string, queueName: string): Promise<boolean> {
  const queue = getQueue(queueNameSchema(queueName));
  try {
    const job = await Job.fromId(queue, bullmqId);
    if (!job) return false;
    await job.retry();
    return true;
  } catch {
    return false;
  }
}

export async function removeFailedJobs(
  jobs: Array<{ bullmqId: string; queue: string }>,
): Promise<number> {
  let removed = 0;
  for (const { bullmqId, queue: queueName } of jobs) {
    const queue = getQueue(queueNameSchema(queueName));
    try {
      const job = await Job.fromId(queue, bullmqId);
      if (job) {
        await job.remove();
        removed++;
      }
    } catch {
      // 이미 제거됨
    }
  }
  return removed;
}

export async function removeJob(bullmqId: string, queueName: string): Promise<boolean> {
  const queue = getQueue(queueNameSchema(queueName));
  try {
    const job = await Job.fromId(queue, bullmqId);
    if (!job) return false;
    await job.remove();
    return true;
  } catch {
    return false;
  }
}

export async function checkOrphanedJobs(): Promise<{
  count: number;
  jobs: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    state: string;
  }>;
}> {
  const { getDb } = await import('../db');
  const { collectionJobs } = await import('../db/schema/collections');
  const { eq } = await import('drizzle-orm');

  const db = getDb();
  const TERMINAL_STATUSES = ['cancelled', 'failed', 'completed'];
  const orphans: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    state: string;
  }> = [];

  for (const queueName of QUEUE_NAMES) {
    const queue = getQueue(queueName);
    try {
      const jobs = await queue.getJobs(['waiting', 'delayed', 'waiting-children', 'active']);
      for (const job of jobs) {
        if (!job?.data?.dbJobId) continue;
        const [dbJob] = await db
          .select({ status: collectionJobs.status })
          .from(collectionJobs)
          .where(eq(collectionJobs.id, job.data.dbJobId))
          .limit(1);

        if (!dbJob || TERMINAL_STATUSES.includes(dbJob.status)) {
          let state = 'unknown';
          try {
            state = await job.getState();
          } catch {
            /* ignore */
          }
          orphans.push({
            queue: queueName,
            bullmqId: job.id ?? '',
            name: job.name,
            dbJobId: job.data.dbJobId as number,
            state,
          });
        }
      }
    } catch {
      // 큐 접근 실패
    }
  }

  return { count: orphans.length, jobs: orphans };
}
```

- [ ] **Step 2: control.ts에 re-export 추가**

`packages/core/src/pipeline/control.ts` 라인 16-23을 수정하여 새 함수들을 re-export:

기존:

```typescript
export {
  removeWaitingBullMQJobs,
  getQueueStatus,
  purgeAllBullMQJobs,
  cleanupBeforeNewPipeline,
  getJobDiagnostic,
  forceCleanupActiveJob,
} from './queue-management';
```

변경:

```typescript
export {
  removeWaitingBullMQJobs,
  getQueueStatus,
  purgeAllBullMQJobs,
  cleanupBeforeNewPipeline,
  getJobDiagnostic,
  forceCleanupActiveJob,
} from './queue-management';
export {
  pauseQueue,
  resumeQueue,
  getStalledJobs,
  removeStalledJobs,
  getFailedJobs,
  retryFailedJob,
  removeFailedJobs,
  removeJob,
  checkOrphanedJobs,
} from './worker-management';
```

- [ ] **Step 3: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build --filter @ai-signalcraft/core`
Expected: 빌드 성공, 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/pipeline/worker-management.ts packages/core/src/pipeline/control.ts
git commit -m "feat: 워커 관리 비즈니스 로직 추가

pause/resume, stalled/failed job 조회/정리, 고아 job 확인 함수 구현"
```

---

## Task 2: 백엔드 — tRPC 워커 관리 라우터

**Files:**

- Create: `apps/web/src/server/trpc/routers/admin/worker-management.ts`
- Modify: `apps/web/src/server/trpc/routers/admin/index.ts`

- [ ] **Step 1: worker-management.ts tRPC 라우터 작성**

`apps/web/src/server/trpc/routers/admin/worker-management.ts`:

```typescript
import { z } from 'zod';
import {
  getWorkerStatus,
  getQueueStatus,
  pauseQueue,
  resumeQueue,
  getStalledJobs,
  removeStalledJobs,
  getFailedJobs,
  retryFailedJob,
  removeFailedJobs,
  removeJob,
  checkOrphanedJobs,
  cleanupBeforeNewPipeline,
} from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

const queueNameSchema = z.enum(['collectors', 'pipeline', 'analysis']);

const jobRefSchema = z.object({
  bullmqId: z.string(),
  queue: queueNameSchema,
});

export const workerManagementRouter = router({
  getQueueOverview: systemAdminProcedure.query(async () => {
    const [workerHealth, queueStatus, stalledJobs, failedJobs] = await Promise.all([
      getWorkerStatus(),
      getQueueStatus(),
      getStalledJobs(),
      getFailedJobs(),
    ]);
    return { workerHealth, queueStatus, stalledJobs, failedJobs };
  }),

  pauseQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await pauseQueue(input.queueName);
      return { paused: true, queue: input.queueName };
    }),

  resumeQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await resumeQueue(input.queueName);
      return { resumed: true, queue: input.queueName };
    }),

  removeStalledJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeStalledJobs(input.jobs);
      return { removed };
    }),

  retryFailedJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const retried = await retryFailedJob(input.bullmqId, input.queue);
    return { retried };
  }),

  removeFailedJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeFailedJobs(input.jobs);
      return { removed };
    }),

  removeJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const removed = await removeJob(input.bullmqId, input.queue);
    return { removed };
  }),

  checkOrphanedJobs: systemAdminProcedure.query(async () => {
    return checkOrphanedJobs();
  }),

  cleanupOrphanedJobs: systemAdminProcedure.mutation(async () => {
    const cleaned = await cleanupBeforeNewPipeline();
    return { cleaned };
  }),
});
```

- [ ] **Step 2: admin/index.ts에 라우터 등록**

`apps/web/src/server/trpc/routers/admin/index.ts`에 추가:

import 추가:

```typescript
import { workerManagementRouter } from './worker-management';
```

adminRouter에 추가:

```typescript
workerMgmt: workerManagementRouter,
```

- [ ] **Step 3: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build --filter web`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/server/trpc/routers/admin/worker-management.ts apps/web/src/server/trpc/routers/admin/index.ts
git commit -m "feat: 워커 관리 tRPC 라우터 추가

admin.workerMgmt 네임스페이스에 큐 관리 API 9개 프로시저 등록"
```

---

## Task 3: 프론트엔드 — 공유 타입 및 메인 모달 컨테이너

**Files:**

- Create: `apps/web/src/components/admin/worker-management/types.ts`
- Create: `apps/web/src/components/admin/worker-management-modal.tsx`

- [ ] **Step 1: 공유 타입 정의**

`apps/web/src/components/admin/worker-management/types.ts`:

```typescript
import type { QueueHealth } from '@ai-signalcraft/core/client';

export type WorkerModalTab = 'queue-status' | 'stalled' | 'failed' | 'workers';

export interface WorkerManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: WorkerModalTab;
  focusJobId?: number | null;
}

export interface QueueOverviewData {
  workerHealth: QueueHealth[];
  queueStatus: {
    queues: Array<{
      name: string;
      counts: {
        active: number;
        waiting: number;
        delayed: number;
        'waiting-children': number;
        completed: number;
        failed: number;
      };
      jobs: Array<{
        id: string;
        name: string;
        state: string;
        dbJobId: number | null;
        timestamp: number | null;
        processedOn: number | null;
        failedReason: string | null;
      }>;
      error?: string;
    }>;
  };
  stalledJobs: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    elapsedSeconds: number;
    processedOn: number | null;
  }>;
  failedJobs: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    failedReason: string | null;
    timestamp: number | null;
    finishedOn: number | null;
  }>;
}
```

- [ ] **Step 2: 메인 모달 컨테이너 작성**

`apps/web/src/components/admin/worker-management-modal.tsx`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';
import { QueueStatusTab } from './worker-management/queue-status-tab';
import { StalledJobsTab } from './worker-management/stalled-jobs-tab';
import { FailedJobsTab } from './worker-management/failed-jobs-tab';
import { WorkersTab } from './worker-management/workers-tab';
import type { WorkerManagementModalProps } from './worker-management/types';

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
      <DialogContent
        className="max-w-4xl max-h-[85vh] overflow-y-auto"
        showCloseButton
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              워커 관리
              {focusJobId && (
                <span className="text-xs font-normal text-muted-foreground">
                  Job #{focusJobId}
                </span>
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
```

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/types.ts apps/web/src/components/admin/worker-management-modal.tsx
git commit -m "feat: 워커 관리 모달 컨테이너 및 타입 정의

Dialog + Tabs 기반 4개 탭 구조, 5초 자동 갱신, 진입점별 초기 탭 지원"
```

---

## Task 4: 프론트엔드 — 큐 상태 탭

**Files:**

- Create: `apps/web/src/components/admin/worker-management/queue-status-tab.tsx`

- [ ] **Step 1: QueueStatusTab 컴포넌트 작성**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';
import type { QueueOverviewData } from './types';

const HEALTH_COLOR: Record<string, string> = {
  healthy: 'text-green-600',
  idle: 'text-muted-foreground',
  stuck: 'text-amber-600',
  warn: 'text-amber-600',
  down: 'text-red-600',
};

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-green-500',
  idle: 'bg-zinc-400',
  stuck: 'bg-amber-500',
  warn: 'bg-amber-500',
  down: 'bg-red-500',
};

interface QueueStatusTabProps {
  data: QueueOverviewData;
  onRefresh: () => void;
}

export function QueueStatusTab({ data, onRefresh }: QueueStatusTabProps) {
  const qc = useQueryClient();

  const pauseMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.pauseQueue.mutate({ queueName: queueName as any }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 일시정지됨`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('큐 일시정지에 실패했습니다'),
  });

  const resumeMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.resumeQueue.mutate({ queueName: queueName as any }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 재개됨`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('큐 재개에 실패했습니다'),
  });

  const totalActive = data.workerHealth.reduce((sum, q) => sum + q.counts.active, 0);
  const totalWaiting = data.workerHealth.reduce((sum, q) => sum + q.counts.waiting, 0);
  const totalFailed = data.workerHealth.reduce((sum, q) => sum + q.counts.failed, 0);

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-3">
        {data.workerHealth.map((q) => (
          <div
            key={q.queue}
            className={`rounded-lg border p-4 ${
              q.health === 'down' || q.health === 'warn'
                ? 'border-amber-500/30'
                : 'border-border'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[q.health]}`} />
                <span className="font-medium text-sm">{q.queue}</span>
              </div>
              <span className={`text-xs ${HEALTH_COLOR[q.health]}`}>{q.health}</span>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className="font-medium">{q.counts.active}</div>
                <div className="text-muted-foreground">active</div>
              </div>
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className="font-medium">{q.counts.waiting}</div>
                <div className="text-muted-foreground">waiting</div>
              </div>
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className="font-medium">{q.counts.delayed}</div>
                <div className="text-muted-foreground">delayed</div>
              </div>
              <div className="rounded bg-muted px-2 py-1.5 text-center">
                <div className={`font-medium ${q.counts.failed > 0 ? 'text-red-500' : ''}`}>
                  {q.counts.failed}
                </div>
                <div className="text-muted-foreground">failed</div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() =>
                q.isPaused
                  ? resumeMutation.mutate(q.queue)
                  : pauseMutation.mutate(q.queue)
              }
              disabled={pauseMutation.isPending || resumeMutation.isPending}
            >
              {q.isPaused ? (
                <>
                  <Play className="mr-1 h-3 w-3" /> 재개
                </>
              ) : (
                <>
                  <Pause className="mr-1 h-3 w-3" /> 일시정지
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-between rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
        <span>
          전체: active {totalActive} · waiting {totalWaiting} · failed {totalFailed}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/queue-status-tab.tsx
git commit -m "feat: 큐 상태 탭 컴포넌트 구현

3개 큐 카운트 카드 + pause/resume 토글"
```

---

## Task 5: 프론트엔드 — Stalled Jobs 탭

**Files:**

- Create: `apps/web/src/components/admin/worker-management/stalled-jobs-tab.tsx`

- [ ] **Step 1: StalledJobsTab 컴포넌트 작성**

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

interface StalledJobsTabProps {
  stalledJobs: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    elapsedSeconds: number;
  }>;
  onRefresh: () => void;
}

export function StalledJobsTab({ stalledJobs, onRefresh }: StalledJobsTabProps) {
  const qc = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (jobs: Array<{ bullmqId: string; queue: string }>) =>
      trpcClient.admin.workerMgmt.removeStalledJobs.mutate({ jobs: jobs as any }),
    onSuccess: (res) => {
      toast.success(`${res.removed}개 stalled 작업 정리 완료`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('정리에 실패했습니다'),
  });

  const formatElapsed = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  };

  if (stalledJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Info className="mb-2 h-8 w-8" />
        <p className="text-sm">중단 의심 작업이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          {stalledJobs.length}개 중단 의심 작업
        </span>
        <Button
          variant="destructive"
          size="sm"
          className="text-xs"
          onClick={() =>
            removeMutation.mutate(
              stalledJobs.map((j) => ({ bullmqId: j.bullmqId, queue: j.queue })),
            )
          }
          disabled={removeMutation.isPending}
        >
          {removeMutation.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3 w-3" />
          )}
          전체 정리
        </Button>
      </div>

      <div className="space-y-2">
        {stalledJobs.map((job) => (
          <div
            key={`${job.queue}-${job.bullmqId}`}
            className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">{job.name}</div>
              <div className="text-xs text-muted-foreground">
                {job.queue} · {job.dbJobId ? `Job #${job.dbJobId}` : 'N/A'} ·{' '}
                {formatElapsed(job.elapsedSeconds)} 경과
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-red-500/30 text-red-600 hover:bg-red-500/10"
              onClick={() =>
                removeMutation.mutate([{ bullmqId: job.bullmqId, queue: job.queue }])
              }
              disabled={removeMutation.isPending}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              제거
            </Button>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        💡 10분 이상 응답 없는 active job을 표시합니다. lock 만료 후 자동 실패 처리되지만, 즉시
        정리할 수도 있습니다.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/stalled-jobs-tab.tsx
git commit -m "feat: Stalled Jobs 탭 컴포넌트 구현

10분+ 무응답 active job 목록, 개별/일괄 정리 기능"
```

---

## Task 6: 프론트엔드 — Failed Jobs 탭

**Files:**

- Create: `apps/web/src/components/admin/worker-management/failed-jobs-tab.tsx`

- [ ] **Step 1: FailedJobsTab 컴포넌트 작성**

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, RotateCcw, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpcClient } from '@/lib/trpc';

interface FailedJobsTabProps {
  failedJobs: Array<{
    queue: string;
    bullmqId: string;
    name: string;
    dbJobId: number | null;
    failedReason: string | null;
    timestamp: number | null;
    finishedOn: number | null;
  }>;
  onRefresh: () => void;
}

const QUEUE_FILTERS = ['all', 'collectors', 'pipeline', 'analysis'] as const;

export function FailedJobsTab({ failedJobs, onRefresh }: FailedJobsTabProps) {
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const qc = useQueryClient();

  const retryMutation = useMutation({
    mutationFn: ({ bullmqId, queue }: { bullmqId: string; queue: string }) =>
      trpcClient.admin.workerMgmt.retryFailedJob.mutate({ bullmqId, queue: queue as any }),
    onSuccess: () => {
      toast.success('재시도 완료');
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('재시도에 실패했습니다'),
  });

  const removeMutation = useMutation({
    mutationFn: (jobs: Array<{ bullmqId: string; queue: string }>) =>
      trpcClient.admin.workerMgmt.removeFailedJobs.mutate({ jobs: jobs as any }),
    onSuccess: (res) => {
      toast.success(`${res.removed}개 작업 삭제 완료`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  });

  const filtered =
    queueFilter === 'all' ? failedJobs : failedJobs.filter((j) => j.queue === queueFilter);

  const queueCounts = failedJobs.reduce(
    (acc, j) => {
      acc[j.queue] = (acc[j.queue] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const formatTime = (ts: number | null) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return `${Math.floor(diff / 3600)}시간 전`;
  };

  if (failedJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Info className="mb-2 h-8 w-8" />
        <p className="text-sm">실패한 작업이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">큐:</span>
          {QUEUE_FILTERS.map((f) => {
            const count = f === 'all' ? failedJobs.length : (queueCounts[f] ?? 0);
            if (f !== 'all' && count === 0) return null;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setQueueFilter(f)}
                className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                  queueFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all' ? '전체' : f} ({count})
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() =>
            removeMutation.mutate(
              filtered.map((j) => ({ bullmqId: j.bullmqId, queue: j.queue })),
            )
          }
          disabled={removeMutation.isPending}
        >
          {removeMutation.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3 w-3" />
          )}
          전체 삭제
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.map((job) => (
          <div
            key={`${job.queue}-${job.bullmqId}`}
            className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3"
          >
            <div className="min-w-0 flex-1 mr-3">
              <div className="text-sm font-medium">{job.name}</div>
              <div className="text-xs text-muted-foreground">
                {job.queue} · {formatTime(job.finishedOn || job.timestamp)}
              </div>
              {job.failedReason && (
                <div className="mt-1 truncate text-xs text-red-500">{job.failedReason}</div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  retryMutation.mutate({ bullmqId: job.bullmqId, queue: job.queue })
                }
                disabled={retryMutation.isPending}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                재시도
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  removeMutation.mutate([{ bullmqId: job.bullmqId, queue: job.queue }])
                }
                disabled={removeMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/failed-jobs-tab.tsx
git commit -m "feat: Failed Jobs 탭 컴포넌트 구현

큐별 필터, 실패 사유 표시, 개별 재시도/삭제 기능"
```

---

## Task 7: 프론트엔드 — 워커 탭

**Files:**

- Create: `apps/web/src/components/admin/worker-management/workers-tab.tsx`

- [ ] **Step 1: WorkersTab 컴포넌트 작성**

```typescript
'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QueueHealth } from '@ai-signalcraft/core/client';

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-green-500',
  idle: 'bg-zinc-400',
  stuck: 'bg-amber-500',
  warn: 'bg-amber-500',
  down: 'bg-red-500',
};

interface WorkersTabProps {
  workerHealth: QueueHealth[];
}

const RESTART_COMMAND = 'dserver restart ais-prod-worker';

export function WorkersTab({ workerHealth }: WorkersTabProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(RESTART_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-3">
        {workerHealth.map((q) => (
          <div key={q.queue} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[q.health]}`} />
              <span className="font-medium text-sm">{q.queue}</span>
            </div>

            <div className="mb-2 text-xs text-muted-foreground">
              워커 {q.workerCount}개 활성
            </div>

            {q.workers.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {q.workers.map((w) => (
                  <li key={w.id || w.addr}>
                    • {w.addr || w.id} — idle {Math.floor(w.idle / 1000)}s
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-red-600">⚠ 활성 워커 없음</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted p-3">
        <div className="mb-1.5 text-xs text-muted-foreground">워커 다운 시 재시작:</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-background px-3 py-1.5 font-mono text-xs">
            {RESTART_COMMAND}
          </code>
          <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={handleCopy}>
            {copied ? (
              <Check className="mr-1 h-3 w-3 text-green-600" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {copied ? '복사됨' : '복사'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/workers-tab.tsx
git commit -m "feat: 워커 탭 컴포넌트 구현

큐별 워커 상태, idle 시간, 재시작 명령어 복사"
```

---

## Task 8: 진입점 연결 — WorkerHealthBadge + WorkerStatusBar

**Files:**

- Modify: `apps/web/src/components/admin/worker-health-badge.tsx`
- Modify: `apps/web/src/components/analysis/pipeline-monitor/worker-status-bar.tsx`
- Delete: `apps/web/src/components/admin/worker-health-modal.tsx`

- [ ] **Step 1: WorkerHealthBadge 수정**

`apps/web/src/components/admin/worker-health-badge.tsx`에서:

import 변경:

```typescript
// 삭제
import { WorkerHealthModal } from './worker-health-modal';
// 추가
import { WorkerManagementModal } from './worker-management-modal';
```

모달 렌더링 변경 — 기존:

```typescript
{open && <WorkerHealthModal onClose={() => setOpen(false)} data={data} />}
```

변경:

```typescript
<WorkerManagementModal open={open} onOpenChange={setOpen} defaultTab="queue-status" />
```

- [ ] **Step 2: WorkerStatusBar에 "관리" 버튼 추가**

`apps/web/src/components/analysis/pipeline-monitor/worker-status-bar.tsx`에서:

import 추가:

```typescript
import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { WorkerManagementModal } from '@/components/admin/worker-management-modal';
```

WorkerStatusBar 컴포넌트 내부에 state 추가:

```typescript
const [mgmtOpen, setMgmtOpen] = useState(false);
```

메인 바의 expand 버튼 옆에 "관리" 버튼 추가:

```typescript
<Button
  variant="ghost"
  size="sm"
  className="h-6 text-xs gap-1"
  onClick={() => setMgmtOpen(true)}
>
  <Settings2 className="h-3 w-3" />
  관리
</Button>
```

컴포넌트 return 마지막에 모달 추가:

```typescript
<WorkerManagementModal
  open={mgmtOpen}
  onOpenChange={setMgmtOpen}
  defaultTab={allStalledJobs.length > 0 ? 'stalled' : 'queue-status'}
  focusJobId={jobId}
/>
```

- [ ] **Step 3: 기존 WorkerHealthModal 파일 삭제**

```bash
rm apps/web/src/components/admin/worker-health-modal.tsx
```

- [ ] **Step 4: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build`
Expected: 빌드 성공, 타입 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src/components/admin/worker-health-badge.tsx apps/web/src/components/analysis/pipeline-monitor/worker-status-bar.tsx
git rm apps/web/src/components/admin/worker-health-modal.tsx
git commit -m "feat: 워커 관리 모달 진입점 연결

WorkerHealthBadge → 새 모달로 교체, WorkerStatusBar에 관리 버튼 추가
기존 WorkerHealthModal 제거"
```

---

## Task 9: D1 — 새 분석 실행 전 고아 Job 확인 다이얼로그

**Files:**

- Modify: `apps/web/src/components/analysis/trigger-form.tsx:200-237`

- [ ] **Step 1: trigger-form.tsx에 고아 확인 로직 추가**

import 추가:

```typescript
import { useState } from 'react'; // 기존에 있으면 확인
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
```

state 추가 (기존 state 블록 근처):

```typescript
const [orphanDialog, setOrphanDialog] = useState<{
  open: boolean;
  count: number;
  pendingSubmit: (() => void) | null;
}>({ open: false, count: 0, pendingSubmit: null });
```

cleanupMutation 추가:

```typescript
const cleanupMutation = useMutation({
  mutationFn: () => trpcClient.admin.workerMgmt.cleanupOrphanedJobs.mutate(),
  onSuccess: (res) => {
    toast.success(`${res.cleaned}개 고아 작업 정리 완료`);
  },
  onError: () => toast.error('정리에 실패했습니다'),
});
```

handleSubmit 함수 수정 — 기존:

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!keyword.trim() || (sources.length === 0 && customSourceIds.length === 0)) return;
  // ... triggerMutation.mutate(...)
};
```

변경:

```typescript
const doTrigger = () => {
  const resolvedStart = dateMode === 'event' ? subDays(eventDate, eventRadius) : startDate;
  const resolvedEnd = dateMode === 'event' ? addDays(eventDate, eventRadius) : endDate;

  triggerMutation.mutate({
    keyword: keyword.trim(),
    ...(preset?.slug && { keywordType: preset.slug }),
    ...(preset?.domain && { domain: preset.domain as any }),
    sources,
    customSourceIds: customSourceIds.length > 0 ? customSourceIds : undefined,
    startDate: resolvedStart.toISOString(),
    endDate: resolvedEnd.toISOString(),
    options:
      enableItemAnalysis || optimizationPreset !== 'none' || collectTranscript
        ? {
            ...(enableItemAnalysis && { enableItemAnalysis: true }),
            ...(optimizationPreset !== 'none' && { tokenOptimization: optimizationPreset }),
            ...(collectTranscript && { collectTranscript: true }),
          }
        : undefined,
    limits: {
      naverArticles: maxNaverArticles,
      youtubeVideos: maxYoutubeVideos,
      communityPosts: maxCommunityPosts,
      commentsPerItem: maxCommentsPerItem,
    },
    limitMode: dateMode === 'period' ? 'perDay' : 'total',
    breakpoints: breakpoints.length > 0 ? breakpoints : undefined,
    ...(selectedSeriesId && { seriesId: selectedSeriesId }),
    ...(createNewSeries && { createNewSeries: true }),
    ...(forceRefetch && { forceRefetch: true }),
  });
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!keyword.trim() || (sources.length === 0 && customSourceIds.length === 0)) return;

  try {
    const orphans = await trpcClient.admin.workerMgmt.checkOrphanedJobs.query();
    if (orphans.count > 0) {
      setOrphanDialog({ open: true, count: orphans.count, pendingSubmit: doTrigger });
      return;
    }
  } catch {
    // 권한 없거나 API 실패 시 무시하고 진행
  }

  doTrigger();
};
```

JSX에 AlertDialog 추가 (form 닫는 태그 뒤):

```typescript
<AlertDialog
  open={orphanDialog.open}
  onOpenChange={(open) => {
    if (!open) setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
  }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>이전 작업이 남아있습니다</AlertDialogTitle>
      <AlertDialogDescription>
        이전 실행의 잔여 작업 {orphanDialog.count}개가 큐에 남아있습니다.
        정리 후 실행하면 충돌을 방지할 수 있습니다.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel
        onClick={() => setOrphanDialog({ open: false, count: 0, pendingSubmit: null })}
      >
        취소
      </AlertDialogCancel>
      <Button
        variant="outline"
        onClick={() => {
          orphanDialog.pendingSubmit?.();
          setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
        }}
      >
        그냥 실행
      </Button>
      <AlertDialogAction
        onClick={async () => {
          await cleanupMutation.mutateAsync();
          orphanDialog.pendingSubmit?.();
          setOrphanDialog({ open: false, count: 0, pendingSubmit: null });
        }}
      >
        정리 후 실행
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/components/analysis/trigger-form.tsx
git commit -m "feat: 새 분석 실행 전 고아 작업 확인 다이얼로그

잔여 BullMQ 작업 감지 시 정리/무시/취소 선택 다이얼로그 표시"
```

---

## Task 10: QueueStatusPage 제거 + 최종 정리

**Files:**

- Delete: `apps/web/src/app/queue-status/page.tsx`

- [ ] **Step 1: QueueStatusPage 제거**

```bash
rm apps/web/src/app/queue-status/page.tsx
```

- [ ] **Step 2: queue-status 링크 참조 확인 및 제거**

Run: `grep -r "queue-status" apps/web/src/ --include="*.tsx" --include="*.ts" -l`

발견되는 참조를 모두 제거하거나 새 모달로 대체.

- [ ] **Step 3: 전체 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build`
Expected: 빌드 성공, 미참조 오류 없음

- [ ] **Step 4: 커밋**

```bash
git rm apps/web/src/app/queue-status/page.tsx
git commit -m "refactor: QueueStatusPage 제거

워커 관리 모달로 기능 통합 완료"
```

---

## Task 11: 브라우저 통합 테스트

- [ ] **Step 1: 개발 서버 시작**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm dev`

- [ ] **Step 2: 워커 배지 → 모달 열기 확인**

브라우저에서 헤더의 워커 배지 클릭:

- 모달 열림 확인
- "큐 상태" 탭이 기본 선택
- 3개 큐 카드 표시
- pause/resume 버튼 작동
- 5초 자동 갱신 확인

- [ ] **Step 3: Stalled/Failed 탭 확인**

- Stalled Jobs 탭: stalled가 없으면 빈 상태 메시지
- Failed Jobs 탭: 큐 필터 작동, 재시도/삭제 버튼 확인

- [ ] **Step 4: 워커 탭 확인**

- 워커 목록 표시
- 재시작 명령어 복사 버튼

- [ ] **Step 5: WorkerStatusBar → 모달 열기 확인**

분석 실행 화면에서 "관리" 버튼 클릭:

- 모달 열림 확인
- stalled가 있으면 해당 탭으로 초기화

- [ ] **Step 6: D1 고아 확인 다이얼로그 확인**

"새 분석 실행" 버튼 클릭:

- 고아 job이 없으면 바로 분석 시작
- 고아 job이 있으면 다이얼로그 표시

- [ ] **Step 7: 기존 기능 회귀 확인**

- WorkerStatusBar 인라인 기능 (고아 정리 버튼) 정상 작동
- /queue-status 페이지 제거 후 404 확인
- 파이프라인 모니터의 다른 기능 정상 작동

---

## 검증 체크리스트

| #   | 검증 항목                    | 방법                                     |
| --- | ---------------------------- | ---------------------------------------- |
| 1   | 배지 클릭 → 모달 열림        | 브라우저 확인                            |
| 2   | 상태바 관리 버튼 → 모달 열림 | 분석 실행 화면에서 확인                  |
| 3   | 큐 pause/resume 토글         | 버튼 클릭 후 상태 변경 확인              |
| 4   | Stalled job 개별/일괄 정리   | 워커 중지 후 stalled 발생시켜서 확인     |
| 5   | Failed job 재시도            | failed job이 waiting으로 이동하는지 확인 |
| 6   | Failed job 삭제              | 삭제 후 목록에서 제거 확인               |
| 7   | 고아 확인 다이얼로그         | 잔여 job이 있는 상태에서 새 분석 시작    |
| 8   | 자동 갱신                    | 5초마다 데이터 갱신 (탭 열려 있을 때만)  |
| 9   | 기존 기능 회귀               | WorkerStatusBar, 파이프라인 모니터 정상  |
| 10  | 빌드 성공                    | `pnpm build` 에러 없음                   |
