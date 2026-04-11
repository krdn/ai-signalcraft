// 파이프라인 제어 함수 — 중지, 일시정지, 재개, 모듈 스킵, 비용 한도
import { eq, and, notInArray } from 'drizzle-orm';
import type { ResumeMode } from '../types/breakpoints';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults } from '../db/schema/analysis';
import { getQueue, removeWaitingBullMQJobs } from './queue-management';

// re-export — 기존 import 경로 유지
export {
  isPipelineCancelled,
  waitIfPaused,
  checkCostLimit,
  getSkippedModules,
} from './pipeline-checks';
export {
  removeWaitingBullMQJobs,
  getQueueStatus,
  purgeAllBullMQJobs,
  cleanupBeforeNewPipeline,
  getJobDiagnostic,
  forceCleanupActiveJob,
} from './queue-management';

/**
 * 파이프라인 완전 중지
 * DB 상태를 먼저 cancelled로 변경하여 모든 Worker가 자체 종료하게 만듦.
 */
export async function cancelPipeline(
  jobId: number,
): Promise<{ cancelled: boolean; message: string }> {
  const db = getDb();

  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { cancelled: false, message: '작업을 찾을 수 없습니다' };

  if (job.status === 'cancelled') return { cancelled: false, message: '이미 cancelled 상태입니다' };
  if (job.status === 'failed') return { cancelled: false, message: '이미 failed 상태입니다' };

  await db
    .update(collectionJobs)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  await db
    .update(analysisResults)
    .set({ status: 'failed', errorMessage: '사용자에 의해 중지됨', updatedAt: new Date() })
    .where(
      and(
        eq(analysisResults.jobId, jobId),
        notInArray(analysisResults.status, ['completed', 'skipped']),
      ),
    );

  try {
    await removeWaitingBullMQJobs(jobId);
  } catch {
    // 정리 실패해도 DB 상태는 이미 cancelled
  }

  return { cancelled: true, message: '파이프라인이 중지되었습니다' };
}

/** 파이프라인 일시정지 */
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

  try {
    const analysisQueue = getQueue('analysis');
    await analysisQueue.pause();
  } catch {
    /* 큐 연결 실패 시 무시 */
  }

  await db
    .update(collectionJobs)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { paused: true, message: '파이프라인이 일시정지되었습니다' };
}

/** 파이프라인 재개 */
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
    /* 큐 연결 실패 시 무시 */
  }

  await db
    .update(collectionJobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));

  return { resumed: true, message: '파이프라인이 재개되었습니다' };
}

/** 분석 모듈 스킵 설정 */
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

/** 비용 한도 설정 */
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
 * 브레이크포인트 정지 상태에서 모드 지정 재개
 * - 'continue': 다음 BP까지 진행
 * - 'step-once': 한 단계만 실행 후 다시 정지
 */
export async function resumePipelineWithMode(
  jobId: number,
  mode: ResumeMode,
): Promise<{ resumed: boolean; message: string }> {
  const db = getDb();
  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job) return { resumed: false, message: '작업을 찾을 수 없습니다' };
  if (job.status !== 'paused') {
    return { resumed: false, message: `현재 ${job.status} 상태에서는 재개할 수 없습니다` };
  }
  await db
    .update(collectionJobs)
    .set({ status: 'running', resumeMode: mode, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));
  return { resumed: true, message: `재개됨 (${mode})` };
}

/** 모든 BP를 무시하고 끝까지 실행 */
export async function runToEndPipeline(
  jobId: number,
): Promise<{ resumed: boolean; message: string }> {
  const db = getDb();
  await db
    .update(collectionJobs)
    .set({
      status: 'running',
      breakpoints: [],
      resumeMode: null,
      pausedAt: null,
      pausedAtStage: null,
      updatedAt: new Date(),
    })
    .where(eq(collectionJobs.id, jobId));
  return { resumed: true, message: '모든 브레이크포인트를 무시하고 끝까지 진행합니다' };
}

/** 실행 중에 브레이크포인트 목록 변경 */
export async function updateBreakpoints(
  jobId: number,
  breakpoints: string[],
): Promise<{ updated: boolean; message: string }> {
  const db = getDb();
  await db
    .update(collectionJobs)
    .set({ breakpoints, updatedAt: new Date() })
    .where(eq(collectionJobs.id, jobId));
  return { updated: true, message: '브레이크포인트가 업데이트되었습니다' };
}
