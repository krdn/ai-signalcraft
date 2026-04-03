// 파이프라인 제어 함수 — 중지, 일시정지, 재개, 모듈 스킵, 비용 한도
import { Queue } from 'bullmq';
import { eq, and, notInArray } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults } from '../db/schema/analysis';
import { getRedisConnection } from '../queue/connection';

// 큐 인스턴스 (lazy)
let _collectors: Queue | null = null;
let _pipeline: Queue | null = null;
let _analysis: Queue | null = null;

// 완료된 작업 자동 정리 — Redis 메모리 누적 방지
const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 3600, count: 200 }, // 1시간 경과 또는 200개 초과 시 제거
  removeOnFail: { age: 86400, count: 100 }, // 24시간 경과 또는 100개 초과 시 제거
};

function getQueue(name: string): Queue {
  const conn = getRedisConnection();
  const opts = { connection: conn, defaultJobOptions: DEFAULT_JOB_OPTIONS };
  if (name === 'collectors') return (_collectors ??= new Queue('collectors', opts));
  if (name === 'pipeline') return (_pipeline ??= new Queue('pipeline', opts));
  return (_analysis ??= new Queue('analysis', opts));
}

/**
 * 파이프라인 완전 중지
 *
 * 전략: DB 상태를 먼저 cancelled로 변경하여 모든 Worker 핸들러가
 * isPipelineCancelled()로 취소를 감지하고 자체 종료하게 만듦.
 * BullMQ의 대기 중(waiting/delayed) 작업만 안전하게 제거.
 * active 작업은 건드리지 않음 — Worker 핸들러가 자체 종료 후
 * BullMQ가 정상적으로 완료/실패 처리.
 */
export async function cancelPipeline(
  jobId: number,
): Promise<{ cancelled: boolean; message: string }> {
  const db = getDb();

  // 현재 상태 확인
  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { cancelled: false, message: '작업을 찾을 수 없습니다' };

  // cancelled/failed는 즉시 반환, completed는 분석 진행 중일 수 있으므로 취소 허용
  if (job.status === 'cancelled') {
    return { cancelled: false, message: '이미 cancelled 상태입니다' };
  }
  if (job.status === 'failed') {
    return { cancelled: false, message: '이미 failed 상태입니다' };
  }

  // 1단계: DB 상태를 먼저 cancelled로 변경
  // 이것이 핵심 — 모든 Worker 핸들러가 isPipelineCancelled()로 확인하고 조기 종료
  await db
    .update(collectionJobs)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  // 2단계: 진행 중/대기 중인 분석 모듈을 failed로 표시 (완료된 결과는 보존)
  await db
    .update(analysisResults)
    .set({ status: 'failed', errorMessage: '사용자에 의해 중지됨', updatedAt: new Date() })
    .where(
      and(
        eq(analysisResults.jobId, jobId),
        notInArray(analysisResults.status, ['completed', 'skipped']),
      ),
    );

  // 3단계: 대기 중인 BullMQ 작업만 안전하게 제거
  // active 작업은 건드리지 않음 — 핸들러가 isPipelineCancelled()로 자체 종료
  try {
    await removeWaitingBullMQJobs(jobId);
  } catch {
    // 정리 실패해도 DB 상태는 이미 cancelled → 핸들러가 자체 종료
  }

  return { cancelled: true, message: '파이프라인이 중지되었습니다' };
}

/**
 * 파이프라인 일시정지
 * - BullMQ 큐 일시정지 (해당 jobId의 작업만 영향)
 * - DB 상태를 paused로 업데이트
 */
export async function pausePipeline(jobId: number): Promise<{ paused: boolean; message: string }> {
  const db = getDb();

  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { paused: false, message: '작업을 찾을 수 없습니다' };
  if (job.status !== 'running')
    return { paused: false, message: `현재 ${job.status} 상태에서는 일시정지할 수 없습니다` };

  // 분석 큐만 일시정지 (수집은 이미 진행 중이면 중단 어려움)
  try {
    const analysisQueue = getQueue('analysis');
    await analysisQueue.pause();
  } catch {
    // 큐 연결 실패 시 무시
  }

  await db
    .update(collectionJobs)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { paused: true, message: '파이프라인이 일시정지되었습니다' };
}

/**
 * 파이프라인 재개
 * - BullMQ 큐 재개
 * - DB 상태를 running으로 복원
 */
export async function resumePipeline(
  jobId: number,
): Promise<{ resumed: boolean; message: string }> {
  const db = getDb();

  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { resumed: false, message: '작업을 찾을 수 없습니다' };
  if (job.status !== 'paused')
    return { resumed: false, message: `현재 ${job.status} 상태에서는 재개할 수 없습니다` };

  try {
    const analysisQueue = getQueue('analysis');
    await analysisQueue.resume();
  } catch {
    // 큐 연결 실패 시 무시
  }

  await db
    .update(collectionJobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { resumed: true, message: '파이프라인이 재개되었습니다' };
}

/**
 * 분석 모듈 스킵 설정
 * - skippedModules 목록을 DB에 저장
 * - runner에서 실행 전 체크하여 해당 모듈 건너뜀
 */
export async function setSkippedModules(
  jobId: number,
  modules: string[],
): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { success: false, message: '작업을 찾을 수 없습니다' };

  await db
    .update(collectionJobs)
    .set({ skippedModules: modules, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { success: true, message: `${modules.length}개 모듈이 스킵 설정되었습니다` };
}

/**
 * 비용 한도 설정
 * - costLimitUsd를 DB에 저장
 * - runner에서 매 모듈 실행 후 체크하여 초과 시 자동 중지
 */
export async function setCostLimit(
  jobId: number,
  limitUsd: number | null,
): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { success: false, message: '작업을 찾을 수 없습니다' };

  await db
    .update(collectionJobs)
    .set({ costLimitUsd: limitUsd, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  const msg =
    limitUsd != null
      ? `비용 한도가 $${limitUsd.toFixed(2)}로 설정되었습니다`
      : '비용 한도가 해제되었습니다';
  return { success: true, message: msg };
}

/**
 * 파이프라인이 취소되었는지 확인 (runner에서 호출)
 */
export async function isPipelineCancelled(jobId: number): Promise<boolean> {
  const db = getDb();
  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  // DB에 없거나 cancelled 상태이면 취소된 것으로 간주
  return !job || job.status === 'cancelled';
}

/**
 * 파이프라인이 일시정지되었는지 확인 + 재개 대기 (runner에서 호출)
 * 최대 30분 대기 후 타임아웃으로 취소 처리
 */
export async function waitIfPaused(jobId: number): Promise<boolean> {
  const db = getDb();
  const maxWaitMs = 30 * 60 * 1000; // 30분
  const pollIntervalMs = 3000; // 3초
  let waited = 0;

  while (waited < maxWaitMs) {
    const [job] = await db
      .select({ status: collectionJobs.status })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (!job || job.status === 'cancelled') return false; // 취소됨
    if (job.status !== 'paused') return true; // 재개됨 또는 진행 중

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    waited += pollIntervalMs;
  }

  // 타임아웃 — 자동 취소
  await cancelPipeline(jobId);
  return false;
}

/**
 * 현재 누적 비용 확인 + 한도 초과 체크 (runner에서 호출)
 */
export async function checkCostLimit(
  jobId: number,
): Promise<{ exceeded: boolean; currentCost: number; limit: number | null }> {
  const db = getDb();

  const [job] = await db
    .select({ costLimitUsd: collectionJobs.costLimitUsd })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job || job.costLimitUsd == null) return { exceeded: false, currentCost: 0, limit: null };

  // 완료된 모듈의 토큰 사용량 조회
  const results = await db
    .select({ usage: analysisResults.usage })
    .from(analysisResults)
    .where(eq(analysisResults.jobId, jobId));

  const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 0.005, output: 0.025 },
    'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005 },
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
    'gpt-4.1-nano': { input: 0.00005, output: 0.0002 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gemini-2.5-pro': { input: 0.00125, output: 0.01 },
    'gemini-2.5-flash': { input: 0.0003, output: 0.0025 },
    'gemini-2.5-flash-lite': { input: 0.0001, output: 0.0004 },
    'deepseek-chat': { input: 0.00028, output: 0.00042 },
    'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
  };

  let totalCost = 0;
  for (const row of results) {
    const usage = row.usage as {
      inputTokens?: number;
      outputTokens?: number;
      model?: string;
    } | null;
    if (!usage) continue;
    const cost = TOKEN_COST_PER_1K[usage.model ?? ''];
    if (cost) {
      totalCost +=
        ((usage.inputTokens ?? 0) / 1000) * cost.input +
        ((usage.outputTokens ?? 0) / 1000) * cost.output;
    }
  }

  return {
    exceeded: totalCost >= job.costLimitUsd,
    currentCost: Math.round(totalCost * 10000) / 10000,
    limit: job.costLimitUsd,
  };
}

/**
 * 스킵 모듈 목록 조회 (runner에서 호출)
 */
export async function getSkippedModules(jobId: number): Promise<string[]> {
  const db = getDb();
  const [job] = await db
    .select({ skippedModules: collectionJobs.skippedModules })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  return (job?.skippedModules as string[]) ?? [];
}

/**
 * 대기 중인 BullMQ 작업만 안전하게 제거 (active 작업은 건드리지 않음)
 *
 * 핵심 원칙:
 * - active 작업의 Redis 데이터(해시, lock)를 삭제하면 Worker 내부 상태가 오염됨
 * - active 작업은 핸들러의 isPipelineCancelled() 체크에 의존하여 자체 종료
 * - waiting/delayed 작업만 BullMQ Queue API로 안전하게 제거
 * - waiting-children 상태의 부모는 자식이 완료/실패하면 자동 정리됨
 */
export async function removeWaitingBullMQJobs(jobId: number): Promise<number> {
  let cleaned = 0;

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);

    // waiting, delayed, waiting-children 상태의 작업 모두 제거
    // waiting-children: FlowProducer 부모 작업이 자식 완료 대기 중인 상태
    // 이전에는 waiting/delayed만 제거하여 부모 작업이 남아 concurrency 슬롯 점유
    try {
      const jobs = await queue.getJobs(['waiting', 'delayed', 'waiting-children']);
      for (const job of jobs) {
        if (!job?.data?.dbJobId || job.data.dbJobId !== jobId) continue;
        try {
          await job.remove();
          cleaned++;
        } catch {
          // 이미 제거되었거나 상태 변경됨 — 무시
        }
      }
    } catch {
      // 큐 접근 실패 — 무시
    }

    // active 작업은 건드리지 않음 — 핸들러의 isPipelineCancelled() 체크로 자체 종료
    // BullMQ 외부에서 active 작업을 조작하면 Worker 내부 상태 오염 위험
  }

  return cleaned;
}

/**
 * BullMQ 큐 상태 조회 — 큐별 작업 수 및 상세 목록
 * 디버깅/모니터링용: Worker가 어떤 작업을 처리 중인지 확인
 */
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
      // Redis 연결 실패 등 — 해당 큐는 에러 표시
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

/**
 * purgeAllBullMQJobs — 하위 호환용 wrapper
 * startup-cleanup.ts 등에서 호출하는 경우를 위해 유지
 * 새 코드에서는 removeWaitingBullMQJobs 사용 권장
 */
export async function purgeAllBullMQJobs(jobId: number): Promise<number> {
  return removeWaitingBullMQJobs(jobId);
}

/**
 * 새 파이프라인 실행 전 이전 잔여 작업 전체 정리
 *
 * 문제: 이전 파이프라인 취소 시 waiting/waiting-children 작업이 큐에 남아있으면
 * 새 작업보다 먼저 처리되거나 concurrency 계산에 영향을 줌
 *
 * 전략: waiting, delayed, waiting-children 상태의 고아 작업만 안전하게 제거
 * active 작업은 건드리지 않음 — 핸들러가 isPipelineCancelled()로 자체 종료
 */
export async function cleanupBeforeNewPipeline(): Promise<number> {
  const db = getDb();
  let cleaned = 0;

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);

    try {
      const jobs = await queue.getJobs(['waiting', 'delayed', 'waiting-children']);
      for (const job of jobs) {
        if (!job?.data?.dbJobId) continue;

        // DB에서 해당 작업의 상태 확인
        const [dbJob] = await db
          .select({ status: collectionJobs.status })
          .from(collectionJobs)
          .where(eq(collectionJobs.id, job.data.dbJobId))
          .limit(1);

        // DB에 없거나 cancelled/failed 상태이면 잔여물 → 제거
        const shouldRemove = !dbJob || dbJob.status === 'cancelled' || dbJob.status === 'failed';
        if (!shouldRemove) continue;

        try {
          await job.remove();
          cleaned++;
        } catch {
          // 이미 상태 변경됨 — 무시
        }
      }
    } catch {
      // 큐 접근 실패 — 무시
    }
  }

  return cleaned;
}
