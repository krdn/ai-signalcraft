# 워커 관리 모달 Phase 2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 워커 관리 모달에 큐 Drain, Active Job 상세, 워커 상황별 가이드, Redis 현황, 감사 로그 기능을 추가한다.

**Architecture:** 백엔드에 drain/Redis info/감사 로그 함수를 추가하고, 기존 모달의 큐 상태 탭과 워커 탭을 확장하며, 새 "시스템" 탭을 추가한다. 감사 로그는 Redis 리스트에 최근 100건을 저장한다.

**Tech Stack:** BullMQ 5, ioredis 5, tRPC 11, React 19, shadcn/ui (Collapsible, AlertDialog), sonner

---

## 파일 구조

### 새로 생성

| 파일                                                             | 역할                               |
| ---------------------------------------------------------------- | ---------------------------------- |
| `packages/core/src/pipeline/worker-audit.ts`                     | 감사 로그 기록/조회 (Redis 리스트) |
| `apps/web/src/components/admin/worker-management/system-tab.tsx` | 시스템 탭 (Redis 현황 + 감사 로그) |

### 수정

| 파일                                                                   | 변경                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/core/src/pipeline/worker-management.ts`                      | `drainQueue()`, `getRedisInfo()` 추가          |
| `packages/core/src/pipeline/control.ts:24-34`                          | re-export에 새 함수 추가                       |
| `apps/web/src/server/trpc/routers/admin/worker-management.ts`          | 프로시저 추가 + 기존 mutation에 감사 로그 삽입 |
| `apps/web/src/components/admin/worker-management/types.ts`             | WorkerModalTab에 'system' 추가                 |
| `apps/web/src/components/admin/worker-management-modal.tsx`            | 시스템 탭 추가                                 |
| `apps/web/src/components/admin/worker-management/queue-status-tab.tsx` | drain 버튼 + active job collapsible            |
| `apps/web/src/components/admin/worker-management/workers-tab.tsx`      | 상황별 가이드 + 다중 명령어                    |

---

## Task 1: 백엔드 — drainQueue + getRedisInfo

**Files:**

- Modify: `packages/core/src/pipeline/worker-management.ts` (끝에 추가)
- Modify: `packages/core/src/pipeline/control.ts:24-34` (re-export 추가)

- [ ] **Step 1: worker-management.ts에 drainQueue, getRedisInfo 추가**

파일 끝에 추가:

```typescript
export async function drainQueue(queueName: string): Promise<void> {
  const queue = getQueue(queueNameSchema(queueName));
  await queue.drain();
}

export async function getRedisInfo(): Promise<{
  usedMemory: string;
  maxMemory: string;
  totalKeys: number;
  prefixCounts: Array<{ prefix: string; count: number }>;
}> {
  const Redis = (await import('ioredis')).default;
  const connOpts = (await import('../queue/connection')).getRedisConnection();
  const redis = new Redis({
    host: (connOpts as any).host ?? 'localhost',
    port: (connOpts as any).port ?? 6379,
    ...((connOpts as any).password ? { password: (connOpts as any).password } : {}),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const info = await redis.info('memory');
    const usedMatch = info.match(/used_memory_human:(\S+)/);
    const maxMatch = info.match(/maxmemory_human:(\S+)/);
    const totalKeys = await redis.dbsize();

    const prefixes = ['bull', 'ais-dev', 'ais'];
    const prefixCounts: Array<{ prefix: string; count: number }> = [];
    for (const prefix of prefixes) {
      let count = 0;
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 1000);
        cursor = next;
        count += keys.length;
      } while (cursor !== '0');
      if (count > 0) prefixCounts.push({ prefix, count });
    }

    return {
      usedMemory: usedMatch?.[1] ?? 'unknown',
      maxMemory: maxMatch?.[1] ?? '0',
      totalKeys,
      prefixCounts,
    };
  } finally {
    await redis.quit();
  }
}
```

- [ ] **Step 2: control.ts에 re-export 추가**

`packages/core/src/pipeline/control.ts`의 worker-management re-export 블록(라인 24-34)에 추가:

기존:

```typescript
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

변경:

```typescript
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
  drainQueue,
  getRedisInfo,
} from './worker-management';
```

- [ ] **Step 3: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build --filter @ai-signalcraft/core`

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/pipeline/worker-management.ts packages/core/src/pipeline/control.ts
git commit -m "feat: drainQueue, getRedisInfo 함수 추가

큐 전체 비우기 + Redis 메모리/키 현황 조회 기능

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 백엔드 — 감사 로그 (worker-audit.ts)

**Files:**

- Create: `packages/core/src/pipeline/worker-audit.ts`
- Modify: `packages/core/src/pipeline/control.ts` (re-export 추가)

- [ ] **Step 1: worker-audit.ts 작성**

```typescript
import Redis from 'ioredis';
import { getRedisConnection } from '../queue/connection';

const AUDIT_KEY = 'ais:worker-audit-log';
const MAX_ENTRIES = 100;

export interface AuditEntry {
  timestamp: string;
  action: string;
  target: string;
  result: string;
  count?: number;
}

let _auditRedis: Redis | null = null;

function getAuditRedis(): Redis {
  if (!_auditRedis) {
    const connOpts = getRedisConnection();
    _auditRedis = new Redis({
      host: (connOpts as any).host ?? 'localhost',
      port: (connOpts as any).port ?? 6379,
      ...((connOpts as any).password ? { password: (connOpts as any).password } : {}),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return _auditRedis;
}

export async function writeAuditLog(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  try {
    const redis = getAuditRedis();
    const record: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    await redis.lpush(AUDIT_KEY, JSON.stringify(record));
    await redis.ltrim(AUDIT_KEY, 0, MAX_ENTRIES - 1);
  } catch {
    // 감사 로그 실패가 메인 작업을 방해하면 안 됨
  }
}

export async function getAuditLogs(limit: number = 50): Promise<AuditEntry[]> {
  try {
    const redis = getAuditRedis();
    const raw = await redis.lrange(AUDIT_KEY, 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as AuditEntry);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: control.ts에 re-export 추가**

`packages/core/src/pipeline/control.ts` 끝에 추가:

```typescript
export { writeAuditLog, getAuditLogs, type AuditEntry } from './worker-audit';
```

- [ ] **Step 3: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build --filter @ai-signalcraft/core`

- [ ] **Step 4: 커밋**

```bash
git add packages/core/src/pipeline/worker-audit.ts packages/core/src/pipeline/control.ts
git commit -m "feat: 감사 로그 기록/조회 함수 추가

Redis 리스트 기반, 최근 100건 유지, writeAuditLog/getAuditLogs

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 백엔드 — tRPC 라우터 확장 (drain + redis + audit + 기존 mutation에 로그 삽입)

**Files:**

- Modify: `apps/web/src/server/trpc/routers/admin/worker-management.ts`

- [ ] **Step 1: import 추가 + 새 프로시저 + 기존 mutation에 감사 로그 삽입**

`apps/web/src/server/trpc/routers/admin/worker-management.ts` 전체를 다음으로 교체:

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
  drainQueue,
  getRedisInfo,
  writeAuditLog,
  getAuditLogs,
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
      await writeAuditLog({ action: 'pause', target: input.queueName, result: 'success' });
      return { paused: true, queue: input.queueName };
    }),

  resumeQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await resumeQueue(input.queueName);
      await writeAuditLog({ action: 'resume', target: input.queueName, result: 'success' });
      return { resumed: true, queue: input.queueName };
    }),

  drainQueue: systemAdminProcedure
    .input(z.object({ queueName: queueNameSchema }))
    .mutation(async ({ input }) => {
      await drainQueue(input.queueName);
      await writeAuditLog({ action: 'drain', target: input.queueName, result: 'success' });
      return { drained: true, queue: input.queueName };
    }),

  removeStalledJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeStalledJobs(input.jobs);
      await writeAuditLog({
        action: 'remove-stalled',
        target: `${input.jobs.length} jobs`,
        result: 'success',
        count: removed,
      });
      return { removed };
    }),

  retryFailedJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const retried = await retryFailedJob(input.bullmqId, input.queue);
    await writeAuditLog({
      action: 'retry-failed',
      target: `${input.queue}:${input.bullmqId}`,
      result: retried ? 'success' : 'not-found',
    });
    return { retried };
  }),

  removeFailedJobs: systemAdminProcedure
    .input(z.object({ jobs: z.array(jobRefSchema) }))
    .mutation(async ({ input }) => {
      const removed = await removeFailedJobs(input.jobs);
      await writeAuditLog({
        action: 'remove-failed',
        target: `${input.jobs.length} jobs`,
        result: 'success',
        count: removed,
      });
      return { removed };
    }),

  removeJob: systemAdminProcedure.input(jobRefSchema).mutation(async ({ input }) => {
    const removed = await removeJob(input.bullmqId, input.queue);
    await writeAuditLog({
      action: 'remove-job',
      target: `${input.queue}:${input.bullmqId}`,
      result: removed ? 'success' : 'not-found',
    });
    return { removed };
  }),

  checkOrphanedJobs: systemAdminProcedure.query(async () => {
    return checkOrphanedJobs();
  }),

  cleanupOrphanedJobs: systemAdminProcedure.mutation(async () => {
    const cleaned = await cleanupBeforeNewPipeline();
    await writeAuditLog({
      action: 'cleanup-orphaned',
      target: 'all queues',
      result: 'success',
      count: cleaned,
    });
    return { cleaned };
  }),

  getRedisInfo: systemAdminProcedure.query(async () => {
    return getRedisInfo();
  }),

  getAuditLogs: systemAdminProcedure.query(async () => {
    return getAuditLogs();
  }),
});
```

- [ ] **Step 2: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build --filter web`

- [ ] **Step 3: 커밋**

```bash
git add apps/web/src/server/trpc/routers/admin/worker-management.ts
git commit -m "feat: tRPC 라우터에 drain, Redis info, 감사 로그 추가

기존 mutation에 writeAuditLog 삽입, 3개 새 프로시저 등록

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 프론트엔드 — 큐 상태 탭 확장 (A3 Drain + B3 Active Job 상세)

**Files:**

- Modify: `apps/web/src/components/admin/worker-management/queue-status-tab.tsx`

- [ ] **Step 1: queue-status-tab.tsx 전체 교체**

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pause, Play, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { QueueOverviewData } from './types';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { trpcClient } from '@/lib/trpc';

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
  const [drainTarget, setDrainTarget] = useState<string | null>(null);
  const [expandedQueues, setExpandedQueues] = useState<Set<string>>(new Set());

  const pauseMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.pauseQueue.mutate({
        queueName: queueName as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 일시정지됨`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('큐 일시정지에 실패했습니다'),
  });

  const resumeMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.resumeQueue.mutate({
        queueName: queueName as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 재개됨`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('큐 재개에 실패했습니다'),
  });

  const drainMutation = useMutation({
    mutationFn: (queueName: string) =>
      trpcClient.admin.workerMgmt.drainQueue.mutate({
        queueName: queueName as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: (_, queueName) => {
      toast.success(`${queueName} 큐 비우기 완료`);
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
      setDrainTarget(null);
    },
    onError: () => {
      toast.error('큐 비우기에 실패했습니다');
      setDrainTarget(null);
    },
  });

  const removeJobMutation = useMutation({
    mutationFn: ({ bullmqId, queue }: { bullmqId: string; queue: string }) =>
      trpcClient.admin.workerMgmt.removeJob.mutate({
        bullmqId,
        queue: queue as 'collectors' | 'pipeline' | 'analysis',
      }),
    onSuccess: () => {
      toast.success('작업 제거 완료');
      qc.invalidateQueries({ queryKey: ['admin', 'workerMgmt'] });
      onRefresh();
    },
    onError: () => toast.error('작업 제거에 실패했습니다'),
  });

  const toggleExpand = (queueName: string) => {
    setExpandedQueues((prev) => {
      const next = new Set(prev);
      if (next.has(queueName)) next.delete(queueName);
      else next.add(queueName);
      return next;
    });
  };

  const totalActive = data.workerHealth.reduce((sum, q) => sum + q.counts.active, 0);
  const totalWaiting = data.workerHealth.reduce((sum, q) => sum + q.counts.waiting, 0);
  const totalFailed = data.workerHealth.reduce((sum, q) => sum + q.counts.failed, 0);

  const getActiveJobs = (queueName: string) => {
    const queue = data.queueStatus.queues.find((q) => q.name === queueName);
    if (!queue) return [];
    return queue.jobs.filter((j) => j.state === 'active');
  };

  const formatElapsed = (processedOn: number | null) => {
    if (!processedOn) return '';
    const seconds = Math.floor((Date.now() - processedOn) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-3 gap-3">
        {data.workerHealth.map((q) => {
          const activeJobs = getActiveJobs(q.queue);
          const isExpanded = expandedQueues.has(q.queue);

          return (
            <div
              key={q.queue}
              className={`rounded-lg border p-4 ${
                q.health === 'down' || q.health === 'warn' ? 'border-amber-500/30' : 'border-border'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[q.health]}`} />
                  <span className="text-sm font-medium">{q.queue}</span>
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

              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() =>
                    q.isPaused ? resumeMutation.mutate(q.queue) : pauseMutation.mutate(q.queue)
                  }
                  disabled={pauseMutation.isPending || resumeMutation.isPending}
                >
                  {q.isPaused ? (
                    <>
                      <Play className="mr-1 h-3 w-3" /> 재개
                    </>
                  ) : (
                    <>
                      <Pause className="mr-1 h-3 w-3" /> 정지
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-red-600 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => setDrainTarget(q.queue)}
                  disabled={q.counts.waiting === 0 && q.counts.delayed === 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {activeJobs.length > 0 && (
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(q.queue)}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="mt-2 flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Active jobs ({activeJobs.length})
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1 space-y-1">
                    {activeJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{job.name}</span>
                          {job.dbJobId && (
                            <span className="ml-1 text-muted-foreground">#{job.dbJobId}</span>
                          )}
                          {job.processedOn && (
                            <span className="ml-1 text-muted-foreground">
                              {formatElapsed(job.processedOn)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                          onClick={() =>
                            removeJobMutation.mutate({ bullmqId: job.id, queue: q.queue })
                          }
                          disabled={removeJobMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
        <span>
          전체: active {totalActive} · waiting {totalWaiting} · failed {totalFailed}
        </span>
      </div>

      <AlertDialog open={!!drainTarget} onOpenChange={(open) => !open && setDrainTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>큐 비우기</AlertDialogTitle>
            <AlertDialogDescription>
              {drainTarget} 큐의 모든 대기/지연 작업을 제거합니다. 현재 실행 중인 작업은 영향받지
              않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => drainTarget && drainMutation.mutate(drainTarget)}
            >
              {drainMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3 w-3" />
              )}
              비우기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/queue-status-tab.tsx
git commit -m "feat: 큐 상태 탭에 Drain 버튼 + Active Job 상세 추가

AlertDialog 확인 후 큐 비우기, Collapsible로 active job 목록 및 개별 제거

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 프론트엔드 — 워커 탭 상황별 가이드 (C2)

**Files:**

- Modify: `apps/web/src/components/admin/worker-management/workers-tab.tsx`

- [ ] **Step 1: workers-tab.tsx 전체 교체**

```typescript
'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle, Terminal } from 'lucide-react';
import type { QueueHealth } from '@ai-signalcraft/core/client';
import { Button } from '@/components/ui/button';

const HEALTH_DOT: Record<string, string> = {
  healthy: 'bg-green-500',
  idle: 'bg-zinc-400',
  stuck: 'bg-amber-500',
  warn: 'bg-amber-500',
  down: 'bg-red-500',
};

const STATUS_GUIDE: Record<
  string,
  { message: string; severity: 'error' | 'warning' | 'info'; command?: string }
> = {
  down: {
    message: '워커가 다운되었습니다. 즉시 재시작하세요.',
    severity: 'error',
    command: 'dserver restart ais-prod-worker',
  },
  stuck: {
    message: '대기 작업이 처리되지 않고 있습니다. 로그를 확인하세요.',
    severity: 'warning',
    command: 'dserver logs ais-prod-worker --tail 50',
  },
  warn: {
    message: '활성 워커가 응답하지 않습니다. 재시작을 고려하세요.',
    severity: 'warning',
    command: 'dserver restart ais-prod-worker',
  },
  healthy: { message: '정상 상태입니다.', severity: 'info' },
  idle: { message: '정상 상태입니다.', severity: 'info' },
};

const COMMANDS = [
  { label: '재시작', command: 'dserver restart ais-prod-worker' },
  { label: '로그 확인', command: 'dserver logs ais-prod-worker --tail 50' },
  { label: '강제 중지', command: 'dserver stop ais-prod-worker' },
];

interface WorkersTabProps {
  workerHealth: QueueHealth[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

export function WorkersTab({ workerHealth }: WorkersTabProps) {
  const worstHealth = workerHealth.reduce(
    (worst, q) => {
      const priority: Record<string, number> = { down: 4, stuck: 3, warn: 2, healthy: 1, idle: 0 };
      return (priority[q.health] ?? 0) > (priority[worst] ?? 0) ? q.health : worst;
    },
    'idle' as string,
  );

  const guide = STATUS_GUIDE[worstHealth] ?? STATUS_GUIDE.idle;

  return (
    <div className="space-y-4 pt-4">
      {guide.severity !== 'info' && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            guide.severity === 'error'
              ? 'border border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400'
              : 'border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{guide.message}</div>
            {guide.command && (
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-background px-2 py-0.5 font-mono text-xs">
                  {guide.command}
                </code>
                <CopyButton text={guide.command} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {workerHealth.map((q) => (
          <div key={q.queue} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[q.health]}`} />
              <span className="text-sm font-medium">{q.queue}</span>
            </div>
            <div className="mb-2 text-xs text-muted-foreground">워커 {q.workerCount}개 활성</div>
            {q.workers.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {q.workers.map((w) => (
                  <li key={w.id || w.addr}>
                    &bull; {w.addr || w.id} — idle {Math.floor(w.idle / 1000)}s
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-red-600">활성 워커 없음</p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-muted p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Terminal className="h-3 w-3" />
          명령어
        </div>
        <div className="space-y-1.5">
          {COMMANDS.map((cmd) => (
            <div key={cmd.label} className="flex items-center gap-2">
              <span className="w-16 text-xs text-muted-foreground">{cmd.label}</span>
              <code className="flex-1 rounded bg-background px-2 py-1 font-mono text-xs">
                {cmd.command}
              </code>
              <CopyButton text={cmd.command} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/workers-tab.tsx
git commit -m "feat: 워커 탭에 상황별 가이드 + 다중 명령어 추가

down/stuck/warn 상태별 권장 조치 배너, 재시작/로그/중지 명령어 각각 복사

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 프론트엔드 — 시스템 탭 (D2 Redis + D3 감사 로그)

**Files:**

- Create: `apps/web/src/components/admin/worker-management/system-tab.tsx`

- [ ] **Step 1: system-tab.tsx 작성**

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Database, ScrollText, RefreshCw } from 'lucide-react';
import { trpcClient } from '@/lib/trpc';

const ACTION_LABELS: Record<string, string> = {
  pause: '큐 일시정지',
  resume: '큐 재개',
  drain: '큐 비우기',
  'remove-stalled': 'Stalled 정리',
  'retry-failed': 'Failed 재시도',
  'remove-failed': 'Failed 삭제',
  'remove-job': 'Job 제거',
  'cleanup-orphaned': '고아 정리',
};

export function SystemTab() {
  const { data: redisInfo, isLoading: redisLoading } = useQuery({
    queryKey: ['admin', 'workerMgmt', 'redisInfo'],
    queryFn: () => trpcClient.admin.workerMgmt.getRedisInfo.query(),
    refetchInterval: 30_000,
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['admin', 'workerMgmt', 'auditLogs'],
    queryFn: () => trpcClient.admin.workerMgmt.getAuditLogs.query(),
    refetchInterval: 10_000,
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pt-4">
      <div>
        <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <Database className="h-4 w-4" />
          Redis 현황
        </div>
        {redisLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" /> 로딩 중...
          </div>
        ) : redisInfo ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="font-medium">{redisInfo.usedMemory}</div>
                <div className="text-muted-foreground">사용 메모리</div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="font-medium">{redisInfo.maxMemory || '무제한'}</div>
                <div className="text-muted-foreground">최대 메모리</div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="font-medium">{redisInfo.totalKeys.toLocaleString()}</div>
                <div className="text-muted-foreground">총 키 수</div>
              </div>
            </div>
            {redisInfo.prefixCounts.length > 0 && (
              <div className="rounded-lg bg-muted p-3">
                <div className="mb-1.5 text-xs text-muted-foreground">Prefix별 키 분포</div>
                <div className="space-y-1">
                  {redisInfo.prefixCounts.map((p) => (
                    <div key={p.prefix} className="flex justify-between text-xs">
                      <code>{p.prefix}:*</code>
                      <span>{p.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <ScrollText className="h-4 w-4" />
          감사 로그
        </div>
        {auditLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" /> 로딩 중...
          </div>
        ) : auditLogs && auditLogs.length > 0 ? (
          <div className="rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">시간</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">액션</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">대상</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">결과</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => (
                  <tr key={`${log.timestamp}-${i}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-3 py-1.5">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{log.target}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={
                          log.result === 'success' ? 'text-green-600' : 'text-red-600'
                        }
                      >
                        {log.result}
                      </span>
                      {log.count !== undefined && (
                        <span className="ml-1 text-muted-foreground">({log.count})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            감사 로그가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/system-tab.tsx
git commit -m "feat: 시스템 탭 컴포넌트 구현

Redis 메모리/키 현황 + 감사 로그 테이블

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 프론트엔드 — 모달에 시스템 탭 연결 + 타입 업데이트

**Files:**

- Modify: `apps/web/src/components/admin/worker-management/types.ts`
- Modify: `apps/web/src/components/admin/worker-management-modal.tsx`

- [ ] **Step 1: types.ts에 'system' 탭 추가**

기존:

```typescript
export type WorkerModalTab = 'queue-status' | 'stalled' | 'failed' | 'workers';
```

변경:

```typescript
export type WorkerModalTab = 'queue-status' | 'stalled' | 'failed' | 'workers' | 'system';
```

- [ ] **Step 2: worker-management-modal.tsx에 시스템 탭 추가**

import 추가:

```typescript
import { SystemTab } from './worker-management/system-tab';
```

TabsList 내부, `<TabsTrigger value="workers">워커</TabsTrigger>` 뒤에 추가:

```tsx
<TabsTrigger value="system">시스템</TabsTrigger>
```

TabsContent 블록에 추가 (workers TabsContent 뒤):

```tsx
<TabsContent value="system">
  <SystemTab />
</TabsContent>
```

- [ ] **Step 3: 빌드 확인**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build --filter web`

- [ ] **Step 4: 커밋**

```bash
git add apps/web/src/components/admin/worker-management/types.ts apps/web/src/components/admin/worker-management-modal.tsx
git commit -m "feat: 모달에 시스템 탭 연결

WorkerModalTab에 'system' 추가, SystemTab 컴포넌트 렌더링

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 전체 빌드 + 브라우저 통합 테스트

- [ ] **Step 1: 전체 빌드**

Run: `cd /home/gon/projects/ai/ai-signalcraft && pnpm build`

- [ ] **Step 2: 개발 서버 시작 및 확인**

Run: `pnpm dev`

브라우저에서 `/admin` 이동 → 워커 배지 클릭:

1. 큐 상태 탭: drain 버튼 표시, AlertDialog 확인 동작
2. 큐 상태 탭: active job이 있으면 collapsible 표시
3. 워커 탭: 상황별 가이드 배너 (down/stuck/warn)
4. 워커 탭: 3개 명령어 각각 복사 가능
5. 시스템 탭: Redis 메모리/키 현황 표시
6. 시스템 탭: 감사 로그 테이블 (mutation 실행 후 기록 확인)

---

## 검증 체크리스트

| #   | 검증 항목           | 방법                                                 |
| --- | ------------------- | ---------------------------------------------------- |
| 1   | A3: 큐 비우기       | drain 버튼 → AlertDialog → 실행 → 대기 job 제거 확인 |
| 2   | B3: Active Job 상세 | active job 있을 때 collapsible 펼침 → 개별 제거      |
| 3   | C2: 상황별 가이드   | 워커 down 상태에서 빨간 배너 표시 확인               |
| 4   | C2: 다중 명령어     | 재시작/로그/중지 각각 복사 확인                      |
| 5   | D2: Redis 현황      | 시스템 탭에서 메모리, 키 수, prefix 분포 확인        |
| 6   | D3: 감사 로그 기록  | pause 실행 후 시스템 탭에서 로그 확인                |
| 7   | D3: 감사 로그 표시  | 시간, 액션, 대상, 결과 테이블 확인                   |
| 8   | 전체 빌드           | `pnpm build` 에러 없음                               |
