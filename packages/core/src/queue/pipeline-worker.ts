// 파이프라인 Worker 핸들러 — pipeline 큐 dispatcher
import type { Job } from 'bullmq';
import { createLogger } from '../utils/logger';
import { handleNormalize } from './pipeline-worker-normalize';
import { handlePersist } from './pipeline-worker-persist';
import { handleClassify } from './pipeline-worker-classify';

const logger = createLogger('pipeline-worker');

export function createPipelineHandler(): (job: Job) => Promise<unknown> {
  return async (job: Job) => {
    const { dbJobId } = job.data;
    const jobStartTime = Date.now();
    logger.info(`[${job.name}] 시작 (dbJobId=${dbJobId})`);

    if (job.name.startsWith('normalize-')) {
      return handleNormalize(job, jobStartTime);
    }

    if (job.name === 'persist') {
      return handlePersist(job, jobStartTime);
    }

    if (job.name === 'classify') {
      return handleClassify(job);
    }

    // 알 수 없는 job.name — 명시적 미처리 신호
    logger.warn(`[${job.name}] 알 수 없는 job.name (dbJobId=${dbJobId})`);
    return undefined;
  };
}
