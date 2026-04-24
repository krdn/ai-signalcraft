// BullMQ Queue.getWorkers() 기반 워커 헬스 조회 + Worker heartbeat 기록
import { Queue, type Worker } from 'bullmq';
import { getQueue } from '../pipeline/queue-management';
import { getBullMQOptions, getBullPrefix, getRedisConnection } from './connection';

export type WorkerHealthStatus = 'healthy' | 'idle' | 'stuck' | 'down' | 'warn';

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
  health: WorkerHealthStatus;
}

// ── Worker heartbeat 타입 ──────────────────────────────────────────

export interface WorkerHeartbeat {
  timestamp: number;
  activeJobs: number;
  waitingJobs: number;
  uptime: number;
}

// ── 기존 getWorkerStatus ──────────────────────────────────────────

function deriveHealth(
  workerCount: number,
  counts: { active: number; waiting: number; delayed: number },
  workers: Array<{ idle: number }>,
): WorkerHealthStatus {
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

// ── Worker health heartbeat ───────────────────────────────────────
// Redis에 주기적으로 Worker 상태를 기록하여 모니터 페이지에서 생존/활성 job 수 확인 가능.

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5분
const HEARTBEAT_TTL_MS = 15 * 60 * 1000; // 15분 (heartbeat 3회 누락 시 만료)

let intervalId: ReturnType<typeof setInterval> | null = null;
let redis: any = null;

/**
 * Worker heartbeat 시작.
 * 여러 Worker(collector, pipeline, analysis)를 받아
 * 각 Worker의 큐에서 active/waiting 카운트를 합산 기록.
 */
export function startWorkerHealthHeartbeat(workers: Worker[]): void {
  const prefix = getBullPrefix();
  const hostname = process.env.HOSTNAME || 'unknown';
  const key = `${prefix}:worker-health:${hostname}`;
  const startTime = Date.now();

  // Worker에서 큐 이름을 추출하여 Queue 인스턴스 캐싱
  const queueCache = new Map<string, Queue>();

  const getQueueForWorker = (worker: Worker): Queue | null => {
    const queueName = (worker as any).name;
    if (!queueName) return null;
    if (!queueCache.has(queueName)) {
      queueCache.set(queueName, new Queue(queueName, getBullMQOptions()));
    }
    return queueCache.get(queueName)!;
  };

  const tick = async () => {
    try {
      if (!redis) {
        const Redis = await import('ioredis');
        redis = new Redis.default(getRedisConnection() as any);
      }

      let activeJobs = 0;
      let waitingJobs = 0;

      for (const worker of workers) {
        try {
          const queue = getQueueForWorker(worker);
          if (!queue) continue;
          const counts = await queue.getJobCounts('active', 'waiting');
          activeJobs += counts.active ?? 0;
          waitingJobs += counts.waiting ?? 0;
        } catch {
          // Worker가 이미 close되었거나 큐 조회 실패 시 무시
        }
      }

      const health: WorkerHeartbeat = {
        timestamp: Date.now(),
        activeJobs,
        waitingJobs,
        uptime: Date.now() - startTime,
      };

      await redis.set(key, JSON.stringify(health), 'PX', HEARTBEAT_TTL_MS);
    } catch (err) {
      console.error(
        '[worker-health] heartbeat 기록 실패:',
        err instanceof Error ? err.message : err,
      );
    }
  };

  // 즉시 1회 실행 후 인터벌 시작
  tick().catch(() => {});
  intervalId = setInterval(tick, HEARTBEAT_INTERVAL_MS);
}

/**
 * Heartbeat 정지 (graceful shutdown 시 호출).
 */
export function stopWorkerHealthHeartbeat(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
