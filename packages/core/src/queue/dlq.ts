// 데드 레터 큐(DLQ) — 실패한 잡을 보존하여 원인 분석 및 재시도 지원
import { Queue, Job } from 'bullmq';
import { logError } from '../utils/logger';
import { getBullMQOptions } from './connection';

const DLQ_QUEUE_NAME = 'dlq';

let dlqQueue: Queue | null = null;

function getDLQQueue(): Queue {
  if (!dlqQueue) {
    dlqQueue = new Queue(DLQ_QUEUE_NAME, getBullMQOptions());
  }
  return dlqQueue;
}

export interface DLQEntry {
  originalQueue: string;
  originalName: string;
  data: unknown;
  attemptsMade: number;
  failedReason: string;
  originalId?: string;
  failedAt: string;
}

/** 실패한 잡을 DLQ에 저장 */
export async function sendToDLQ(job: Job, err: unknown): Promise<void> {
  try {
    const entry: DLQEntry = {
      originalQueue: job.queueName,
      originalName: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: err instanceof Error ? err.message : String(err),
      originalId: job.id ?? undefined,
      failedAt: new Date().toISOString(),
    };
    await getDLQQueue().add('dead-letter', entry, {
      removeOnComplete: { age: 86400 * 30 }, // 30일 보관
      removeOnFail: { age: 86400 * 90 },
    });
  } catch (dlqErr) {
    logError('dlq/send', dlqErr);
  }
}

/** DLQ 항목 목록 조회 */
export async function listDLQEntries(limit = 50): Promise<DLQEntry[]> {
  const queue = getDLQQueue();
  const jobs = await queue.getJobs(
    ['waiting', 'delayed', 'active', 'completed', 'failed'],
    0,
    limit - 1,
  );
  return jobs
    .map((j) => j.data as DLQEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime());
}

/** DLQ 항목 수 */
export async function getDLQCount(): Promise<number> {
  const queue = getDLQQueue();
  const counts = await queue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
  return Object.values(counts).reduce((sum, c) => sum + c, 0);
}

/** DLQ 비우기 */
export async function purgeDLQ(): Promise<number> {
  const queue = getDLQQueue();
  const jobs = await queue.getJobs(['waiting', 'delayed', 'active', 'completed', 'failed']);
  await queue.obliterate({ force: true });
  return jobs.length;
}
