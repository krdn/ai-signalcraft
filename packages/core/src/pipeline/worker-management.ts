// 워커 관리 — pause/resume, stalled/failed job 조회·정리, 고아 job 확인
import { Job } from 'bullmq';
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
