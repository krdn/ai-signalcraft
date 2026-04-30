// classify 핸들러 — 증분 item-analysis + analysis 트리거
import type { Job } from 'bullmq';
import { isPipelineCancelled } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { appendJobEvent } from '../pipeline';
import { analyzeItems } from '../analysis/item-analyzer';
import { createLogger, logError } from '../utils/logger';
import { triggerAnalysis } from './flows';

const logger = createLogger('pipeline-worker');

export async function handleClassify(job: Job): Promise<unknown> {
  const { dbJobId: classifyJobId, keyword: classifyKeyword } = job.data;

  if (await isPipelineCancelled(classifyJobId)) {
    logger.info(`[classify] 취소됨 — 스킵 (dbJobId=${classifyJobId})`);
    return { skipped: true, reason: 'cancelled' };
  }

  // 증분 item-analysis — 실패해도 분석은 계속 진행
  try {
    await analyzeItems(classifyJobId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[classify] item-analysis 실패 (분석은 계속): ${msg}`);
    await appendJobEvent(
      classifyJobId,
      'warn',
      `개별 감정 분석 실패 (분석은 계속 진행됨): ${msg}`,
    ).catch((err) => logError('pipeline-worker', err));
  }

  // BP 게이트: 정규화 완료 후 (analysis 트리거 직전)
  if (!(await awaitStageGate(classifyJobId, 'normalize'))) {
    logger.info(`[classify] 게이트 미통과 — 분석 트리거 건너뜀 (dbJobId=${classifyJobId})`);
    return { cancelled: true };
  }

  if (classifyKeyword) {
    await triggerAnalysis(classifyJobId, classifyKeyword);
    logger.info(
      `[classify] 분석 파이프라인 트리거됨: job=${classifyJobId}, keyword=${classifyKeyword}`,
    );
  }
  return { classified: true };
}
