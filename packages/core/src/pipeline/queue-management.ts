// BullMQ 큐 관리 — 작업 정리, 상태 조회
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults } from '../db/schema/analysis';
import { getBullMQOptions } from '../queue/connection';

let _collectors: Queue | null = null;
let _pipeline: Queue | null = null;
let _analysis: Queue | null = null;

const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 3600, count: 200 },
  removeOnFail: { age: 86400, count: 100 },
};

export function getQueue(name: string): Queue {
  // prefix 주입으로 개발/운영 네임스페이스 분리 (BULL_PREFIX 환경변수)
  const opts = { ...getBullMQOptions(), defaultJobOptions: DEFAULT_JOB_OPTIONS };
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

/** 새 파이프라인 실행 전 이전 잔여 작업 전체 정리 (active 포함 — stalled 고아 제거) */
export async function cleanupBeforeNewPipeline(): Promise<number> {
  const db = getDb();
  let cleaned = 0;
  const TERMINAL_STATUSES = ['cancelled', 'failed', 'completed'];

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);
    try {
      // waiting/delayed/waiting-children + active 모두 검사
      const jobs = await queue.getJobs(['waiting', 'delayed', 'waiting-children', 'active']);
      for (const job of jobs) {
        if (!job?.data?.dbJobId) continue;

        const [dbJob] = await db
          .select({ status: collectionJobs.status })
          .from(collectionJobs)
          .where(eq(collectionJobs.id, job.data.dbJobId))
          .limit(1);

        const shouldRemove = !dbJob || TERMINAL_STATUSES.includes(dbJob.status);
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

/** 특정 job의 BullMQ 고아 active job을 강제 제거 */
export async function forceCleanupActiveJob(dbJobId: number): Promise<number> {
  let cleaned = 0;

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);
    try {
      const activeJobs = await queue.getJobs(['active', 'stalled']);
      for (const job of activeJobs) {
        if (job.data?.dbJobId !== dbJobId) continue;
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

/** 특정 job의 BullMQ 상태 + DB 상태 진단 */
export async function getJobDiagnostic(dbJobId: number) {
  const db = getDb();
  const now = Date.now();
  const LOCK_DURATION = 600_000; // analysis-worker의 lockDuration

  // DB 상태 조회
  const [dbJob] = await db
    .select()
    .from(collectionJobs)
    .where(eq(collectionJobs.id, dbJobId))
    .limit(1);

  const dbModules = await db
    .select({
      module: analysisResults.module,
      status: analysisResults.status,
      errorMessage: analysisResults.errorMessage,
      updatedAt: analysisResults.updatedAt,
    })
    .from(analysisResults)
    .where(eq(analysisResults.jobId, dbJobId));

  // BullMQ 상태 조회
  const bullmqJobs: Array<{
    queue: string;
    id: string;
    name: string;
    state: string;
    processedOn: number | null;
    failedReason: string | null;
    isStalled: boolean;
    elapsedMs: number | null;
  }> = [];

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);
    try {
      const jobs = await queue.getJobs(['active', 'waiting', 'delayed', 'failed', 'stalled']);
      for (const job of jobs) {
        if (job.data?.dbJobId !== dbJobId) continue;
        let state = 'unknown';
        try {
          state = await job.getState();
        } catch {
          /* ignore */
        }
        const elapsedMs = job.processedOn ? now - job.processedOn : null;
        const isStalled =
          state === 'active' && elapsedMs !== null && elapsedMs > LOCK_DURATION * 1.2;
        bullmqJobs.push({
          queue: queueName,
          id: job.id ?? '',
          name: job.name,
          state,
          processedOn: job.processedOn ?? null,
          failedReason: job.failedReason ?? null,
          isStalled,
          elapsedMs,
        });
      }
    } catch {
      // 큐 접근 실패
    }
  }

  // 문제 감지
  const issues: Array<{ type: string; message: string; severity: 'error' | 'warning' | 'info' }> =
    [];

  // DB running 모듈인데 BullMQ active job 없음 → 고아 상태
  const runningModules = dbModules.filter((m) => m.status === 'running');
  const hasActiveBullMQJob = bullmqJobs.some((j) => j.state === 'active');
  if (runningModules.length > 0 && !hasActiveBullMQJob) {
    issues.push({
      type: 'orphaned_running',
      message: `DB에 running 모듈 ${runningModules.length}개가 있으나 BullMQ active job이 없습니다. 워커가 종료되어 고아 상태입니다.`,
      severity: 'error',
    });
  }

  // BullMQ active job이 lock 만료 시간을 초과한 경우
  const stalledJobs = bullmqJobs.filter((j) => j.isStalled);
  if (stalledJobs.length > 0) {
    issues.push({
      type: 'lock_expired',
      message: `BullMQ active job이 lock 만료 시간(${LOCK_DURATION / 60000}분)을 초과했습니다. stalled 처리 예정입니다.`,
      severity: 'warning',
    });
  }

  // DB completed인데 BullMQ active 잔류
  if (dbJob?.status && ['cancelled', 'failed', 'completed'].includes(dbJob.status)) {
    const orphanActive = bullmqJobs.filter((j) => j.state === 'active');
    if (orphanActive.length > 0) {
      issues.push({
        type: 'zombie_active',
        message: `DB job이 ${dbJob.status} 상태인데 BullMQ에 active job ${orphanActive.length}개가 남아있습니다.`,
        severity: 'error',
      });
    }
  }

  // 모두 정상
  if (issues.length === 0 && dbJob) {
    issues.push({
      type: 'ok',
      message: '정상 상태입니다.',
      severity: 'info',
    });
  }

  return {
    dbJob: dbJob ?? null,
    dbModules,
    bullmqJobs,
    issues,
    checkedAt: now,
  };
}
