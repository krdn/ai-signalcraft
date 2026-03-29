// 파이프라인 제어 함수 — 중지, 일시정지, 재개, 모듈 스킵, 비용 한도
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults } from '../db/schema/analysis';
import { getRedisConnection } from '../queue/connection';

import Redis from 'ioredis';

// 큐 인스턴스 (lazy)
let _collectors: Queue | null = null;
let _pipeline: Queue | null = null;
let _analysis: Queue | null = null;

// 완료된 작업 자동 정리 — Redis 메모리 누적 방지
const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 3600, count: 200 },   // 1시간 경과 또는 200개 초과 시 제거
  removeOnFail: { age: 86400, count: 100 },       // 24시간 경과 또는 100개 초과 시 제거
};

function getQueue(name: string): Queue {
  const conn = getRedisConnection();
  const opts = { connection: conn, defaultJobOptions: DEFAULT_JOB_OPTIONS };
  if (name === 'collectors') return _collectors ??= new Queue('collectors', opts);
  if (name === 'pipeline') return _pipeline ??= new Queue('pipeline', opts);
  return _analysis ??= new Queue('analysis', opts);
}

/**
 * 파이프라인 완전 중지
 * - 대기 중인 BullMQ 작업 제거
 * - DB 상태를 cancelled로 업데이트
 * - 이미 완료된 분석 결과는 보존
 */
export async function cancelPipeline(jobId: number): Promise<{ cancelled: boolean; message: string }> {
  const db = getDb();

  // 현재 상태 확인
  const [job] = await db.select({ status: collectionJobs.status })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  if (!job) return { cancelled: false, message: '작업을 찾을 수 없습니다' };

  const terminalStatuses = ['completed', 'failed', 'cancelled'];
  if (terminalStatuses.includes(job.status)) {
    return { cancelled: false, message: `이미 ${job.status} 상태입니다` };
  }

  // BullMQ 큐에서 모든 상태의 작업 제거 (waiting + delayed + active)
  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
    const queue = getQueue(queueName);
    try {
      const waiting = await queue.getWaiting();
      const delayed = await queue.getDelayed();
      const active = await queue.getActive();
      for (const qJob of [...waiting, ...delayed, ...active]) {
        if (qJob.data?.dbJobId === jobId) {
          try {
            await qJob.moveToFailed(new Error('사용자에 의해 중지됨'), '0', true);
          } catch {
            // moveToFailed 실패 시 강제 제거
            try { await qJob.remove(); } catch { /* 무시 */ }
          }
        }
      }
    } catch {
      // 큐 연결 실패 시 무시 (DB 상태만이라도 업데이트)
    }
  }

  // Redis에 남은 고아 active 작업 강제 정리
  try {
    await cleanStalledActiveJobs(jobId);
  } catch {
    // 정리 실패해도 DB 상태 업데이트는 계속 진행
  }

  // 진행 중인 분석 모듈을 cancelled로 표시
  await db.update(analysisResults)
    .set({ status: 'failed', errorMessage: '사용자에 의해 중지됨', updatedAt: new Date() })
    .where(eq(analysisResults.jobId, jobId));

  // DB 상태 업데이트
  await db.update(collectionJobs)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { cancelled: true, message: '파이프라인이 중지되었습니다' };
}

/**
 * 파이프라인 일시정지
 * - BullMQ 큐 일시정지 (해당 jobId의 작업만 영향)
 * - DB 상태를 paused로 업데이트
 */
export async function pausePipeline(jobId: number): Promise<{ paused: boolean; message: string }> {
  const db = getDb();

  const [job] = await db.select({ status: collectionJobs.status })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  if (!job) return { paused: false, message: '작업을 찾을 수 없습니다' };
  if (job.status !== 'running') return { paused: false, message: `현재 ${job.status} 상태에서는 일시정지할 수 없습니다` };

  // 분석 큐만 일시정지 (수집은 이미 진행 중이면 중단 어려움)
  try {
    const analysisQueue = getQueue('analysis');
    await analysisQueue.pause();
  } catch {
    // 큐 연결 실패 시 무시
  }

  await db.update(collectionJobs)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { paused: true, message: '파이프라인이 일시정지되었습니다' };
}

/**
 * 파이프라인 재개
 * - BullMQ 큐 재개
 * - DB 상태를 running으로 복원
 */
export async function resumePipeline(jobId: number): Promise<{ resumed: boolean; message: string }> {
  const db = getDb();

  const [job] = await db.select({ status: collectionJobs.status })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  if (!job) return { resumed: false, message: '작업을 찾을 수 없습니다' };
  if (job.status !== 'paused') return { resumed: false, message: `현재 ${job.status} 상태에서는 재개할 수 없습니다` };

  try {
    const analysisQueue = getQueue('analysis');
    await analysisQueue.resume();
  } catch {
    // 큐 연결 실패 시 무시
  }

  await db.update(collectionJobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { resumed: true, message: '파이프라인이 재개되었습니다' };
}

/**
 * 분석 모듈 스킵 설정
 * - skippedModules 목록을 DB에 저장
 * - runner에서 실행 전 체크하여 해당 모듈 건너뜀
 */
export async function setSkippedModules(jobId: number, modules: string[]): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  const [job] = await db.select({ status: collectionJobs.status })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  if (!job) return { success: false, message: '작업을 찾을 수 없습니다' };

  await db.update(collectionJobs)
    .set({ skippedModules: modules, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { success: true, message: `${modules.length}개 모듈이 스킵 설정되었습니다` };
}

/**
 * 비용 한도 설정
 * - costLimitUsd를 DB에 저장
 * - runner에서 매 모듈 실행 후 체크하여 초과 시 자동 중지
 */
export async function setCostLimit(jobId: number, limitUsd: number | null): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  const [job] = await db.select({ status: collectionJobs.status })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  if (!job) return { success: false, message: '작업을 찾을 수 없습니다' };

  await db.update(collectionJobs)
    .set({ costLimitUsd: limitUsd, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  const msg = limitUsd != null ? `비용 한도가 $${limitUsd.toFixed(2)}로 설정되었습니다` : '비용 한도가 해제되었습니다';
  return { success: true, message: msg };
}

/**
 * 파이프라인이 취소되었는지 확인 (runner에서 호출)
 */
export async function isPipelineCancelled(jobId: number): Promise<boolean> {
  const db = getDb();
  const [job] = await db.select({ status: collectionJobs.status })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  return job?.status === 'cancelled';
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
    const [job] = await db.select({ status: collectionJobs.status })
      .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);

    if (!job || job.status === 'cancelled') return false; // 취소됨
    if (job.status !== 'paused') return true; // 재개됨 또는 진행 중

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    waited += pollIntervalMs;
  }

  // 타임아웃 — 자동 취소
  await cancelPipeline(jobId);
  return false;
}

/**
 * 현재 누적 비용 확인 + 한도 초과 체크 (runner에서 호출)
 */
export async function checkCostLimit(jobId: number): Promise<{ exceeded: boolean; currentCost: number; limit: number | null }> {
  const db = getDb();

  const [job] = await db.select({ costLimitUsd: collectionJobs.costLimitUsd })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  if (!job || job.costLimitUsd == null) return { exceeded: false, currentCost: 0, limit: null };

  // 완료된 모듈의 토큰 사용량 조회
  const results = await db.select({ usage: analysisResults.usage })
    .from(analysisResults)
    .where(eq(analysisResults.jobId, jobId));

  const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  };

  let totalCost = 0;
  for (const row of results) {
    const usage = row.usage as { inputTokens?: number; outputTokens?: number; model?: string } | null;
    if (!usage) continue;
    const cost = TOKEN_COST_PER_1K[usage.model ?? ''];
    if (cost) {
      totalCost += ((usage.inputTokens ?? 0) / 1000) * cost.input + ((usage.outputTokens ?? 0) / 1000) * cost.output;
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
  const [job] = await db.select({ skippedModules: collectionJobs.skippedModules })
    .from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  return (job?.skippedModules as string[]) ?? [];
}

/**
 * Redis에 남은 고아 active 작업 강제 정리
 * BullMQ API로 제거 실패한 경우 Redis에 직접 접근하여 정리
 */
export async function cleanStalledActiveJobs(jobId: number): Promise<number> {
  const conn = getRedisConnection() as { host?: string; port?: number };
  const redis = new Redis({ host: conn.host ?? 'localhost', port: conn.port ?? 6379 });
  let cleaned = 0;

  try {
    for (const queueName of ['collectors', 'pipeline', 'analysis']) {
      // 1) active 리스트에서 해당 jobId 작업 제거
      const activeKey = `bull:${queueName}:active`;
      const activeJobIds = await redis.lrange(activeKey, 0, -1);

      for (const bullJobId of activeJobIds) {
        if (await removeIfMatches(redis, queueName, bullJobId, activeKey, jobId, 'lrem')) {
          cleaned++;
        }
      }

      // 2) waiting-children (sorted set)에서 해당 jobId 작업 제거
      const wcKey = `bull:${queueName}:waiting-children`;
      const wcJobIds = await redis.zrange(wcKey, 0, -1);

      for (const bullJobId of wcJobIds) {
        if (await removeIfMatches(redis, queueName, bullJobId, wcKey, jobId, 'zrem')) {
          cleaned++;
        }
      }
    }
  } finally {
    await redis.quit();
  }

  return cleaned;
}

/** Redis에서 특정 dbJobId에 해당하는 BullMQ 작업을 제거하는 헬퍼 */
async function removeIfMatches(
  redis: Redis,
  queueName: string,
  bullJobId: string,
  listKey: string,
  dbJobId: number,
  removeType: 'lrem' | 'zrem',
): Promise<boolean> {
  const dataStr = await redis.hget(`bull:${queueName}:${bullJobId}`, 'data');
  if (!dataStr) return false;

  try {
    const data = JSON.parse(dataStr);
    if (data.dbJobId === dbJobId) {
      if (removeType === 'lrem') {
        await redis.lrem(listKey, 0, bullJobId);
      } else {
        await redis.zrem(listKey, bullJobId);
      }
      await redis.del(`bull:${queueName}:${bullJobId}`);
      await redis.del(`bull:${queueName}:${bullJobId}:lock`);
      return true;
    }
  } catch {
    // JSON 파싱 실패 시 무시
  }
  return false;
}
