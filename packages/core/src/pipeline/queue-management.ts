// BullMQ 큐 관리 — 작업 정리, 상태 조회
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { getRedisConnection } from '../queue/connection';

let _collectors: Queue | null = null;
let _pipeline: Queue | null = null;
let _analysis: Queue | null = null;

const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 3600, count: 200 },
  removeOnFail: { age: 86400, count: 100 },
};

export function getQueue(name: string): Queue {
  const conn = getRedisConnection();
  const opts = { connection: conn, defaultJobOptions: DEFAULT_JOB_OPTIONS };
  if (name === 'collectors') return (_collectors ??= new Queue('collectors', opts));
  if (name === 'pipeline') return (_pipeline ??= new Queue('pipeline', opts));
  return (_analysis ??= new Queue('analysis', opts));
}

/** 대기 중인 BullMQ 작업만 안전하게 제거 (active 작업은 건드리지 않음) */
export async function removeWaitingBullMQJobs(jobId: number): Promise<number> {
  let cleaned = 0;

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);
    try {
      const jobs = await queue.getJobs(['waiting', 'delayed', 'waiting-children']);
      for (const job of jobs) {
        if (!job?.data?.dbJobId || job.data.dbJobId !== jobId) continue;
        try {
          await job.remove();
          cleaned++;
        } catch {
          // 이미 제거되었거나 상태 변경됨
        }
      }
    } catch {
      // 큐 접근 실패
    }
  }

  return cleaned;
}

/** BullMQ 큐 상태 조회 — 디버깅/모니터링용 */
export async function getQueueStatus() {
  const result = [];

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    try {
      const queue = getQueue(queueName);

      const counts = await queue.getJobCounts(
        'active',
        'waiting',
        'delayed',
        'waiting-children',
        'completed',
        'failed',
      );

      const allJobs = await queue.getJobs(
        ['active', 'waiting', 'delayed', 'waiting-children', 'failed'],
        0,
        50,
      );

      const jobs = await Promise.all(
        allJobs.map(async (job) => {
          let state = 'unknown';
          try {
            state = await job.getState();
          } catch {
            /* ignore */
          }
          return {
            id: job.id ?? '',
            name: job.name,
            state,
            dbJobId: (job.data?.dbJobId as number) ?? null,
            timestamp: job.timestamp ?? null,
            processedOn: job.processedOn ?? null,
            failedReason: job.failedReason ?? null,
          };
        }),
      );

      result.push({ name: queueName, counts, jobs });
    } catch (err) {
      result.push({
        name: queueName,
        counts: {
          active: 0,
          waiting: 0,
          delayed: 0,
          'waiting-children': 0,
          completed: 0,
          failed: 0,
        },
        jobs: [],
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { queues: result };
}

/** 하위 호환용 wrapper */
export async function purgeAllBullMQJobs(jobId: number): Promise<number> {
  return removeWaitingBullMQJobs(jobId);
}

/** 새 파이프라인 실행 전 이전 잔여 작업 전체 정리 */
export async function cleanupBeforeNewPipeline(): Promise<number> {
  const db = getDb();
  let cleaned = 0;

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);
    try {
      const jobs = await queue.getJobs(['waiting', 'delayed', 'waiting-children']);
      for (const job of jobs) {
        if (!job?.data?.dbJobId) continue;

        const [dbJob] = await db
          .select({ status: collectionJobs.status })
          .from(collectionJobs)
          .where(eq(collectionJobs.id, job.data.dbJobId))
          .limit(1);

        const shouldRemove = !dbJob || dbJob.status === 'cancelled' || dbJob.status === 'failed';
        if (!shouldRemove) continue;

        try {
          await job.remove();
          cleaned++;
        } catch {
          /* 이미 상태 변경됨 */
        }
      }
    } catch {
      // 큐 접근 실패
    }
  }

  return cleaned;
}
