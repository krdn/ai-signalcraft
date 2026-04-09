// BullMQ Queue.getWorkers() 기반 워커 헬스 조회
import { getQueue } from '../pipeline/queue-management';

export type WorkerHealth = 'healthy' | 'idle' | 'stuck' | 'down' | 'warn';

export interface QueueHealth {
  queue: string;
  workerCount: number;
  workers: Array<{
    id: string;
    addr: string;
    started: number;
    idle: number;
  }>;
  counts: {
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
    paused: number;
  };
  isPaused: boolean;
  health: WorkerHealth;
}

function deriveHealth(
  workerCount: number,
  counts: { active: number; waiting: number; delayed: number },
  workers: Array<{ idle: number }>,
): WorkerHealth {
  if (workerCount === 0) return 'down';
  if (counts.active > 0) {
    if (workers.some((w) => w.idle < 60_000)) return 'healthy';
    return 'warn';
  }
  if (counts.waiting > 0 || counts.delayed > 0) return 'stuck';
  return 'idle';
}

export async function getWorkerStatus(): Promise<QueueHealth[]> {
  const queueNames = ['collectors', 'pipeline', 'analysis'] as const;
  const result: QueueHealth[] = [];

  for (const name of queueNames) {
    try {
      const queue = getQueue(name);
      const rawWorkers = await queue.getWorkers();
      const workers = rawWorkers.map((w) => ({
        id: String((w as { id?: string }).id ?? ''),
        addr: String((w as { addr?: string }).addr ?? ''),
        started: Number((w as { started?: number }).started ?? 0),
        idle: Number((w as { idle?: number }).idle ?? 0),
      }));
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'paused');
      const isPaused = await queue.isPaused();
      result.push({
        queue: name,
        workerCount: workers.length,
        workers,
        counts: {
          active: counts.active ?? 0,
          waiting: counts.waiting ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          paused: counts.paused ?? 0,
        },
        isPaused,
        health: deriveHealth(
          workers.length,
          {
            active: counts.active ?? 0,
            waiting: counts.waiting ?? 0,
            delayed: counts.delayed ?? 0,
          },
          workers,
        ),
      });
    } catch (error) {
      console.error(`[worker-health] ${name} 큐 상태 조회 실패:`, error);
      result.push({
        queue: name,
        workerCount: 0,
        workers: [],
        counts: { active: 0, waiting: 0, delayed: 0, failed: 0, paused: 0 },
        isPaused: false,
        health: 'down',
      });
    }
  }
  return result;
}
