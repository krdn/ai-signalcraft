// 분석 Worker -- analysis 큐
import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './connection';
import { runAnalysisPipeline } from '../analysis/runner';
import { createLogger } from '../utils/logger';

const logger = createLogger('analysis-worker');

export function createAnalysisWorker(): Worker {
  return new Worker('analysis', async (job: Job) => {
    const { dbJobId, keyword } = job.data;

    if (job.name === 'run-analysis') {
      logger.info(`분석 시작: job=${dbJobId}, keyword=${keyword}`);
      const result = await runAnalysisPipeline(dbJobId);

      await job.updateProgress({
        completedModules: result.completedModules,
        failedModules: result.failedModules,
      });

      logger.info(`분석 완료: completed=${result.completedModules.length}, failed=${result.failedModules.length}`);
      return result;
    }
  }, { connection: getRedisConnection() });
}
