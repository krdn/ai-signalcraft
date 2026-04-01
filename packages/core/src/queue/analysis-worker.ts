// 분석 Worker -- analysis 큐
import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { runAnalysisPipeline } from '../analysis/runner';
import { createLogger } from '../utils/logger';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { getRedisConnection } from './connection';

const logger = createLogger('analysis-worker');

export function createAnalysisWorker(): Worker {
  return new Worker(
    'analysis',
    async (job: Job) => {
      const { dbJobId, keyword, resumeOptions } = job.data;

      if (job.name === 'run-analysis') {
        const isResume = !!resumeOptions;
        logger.info(
          `분석 ${isResume ? '재실행' : '시작'}: job=${dbJobId}, keyword=${keyword}${isResume ? `, options=${JSON.stringify(resumeOptions)}` : ''}`,
        );
        const result = await runAnalysisPipeline(dbJobId, resumeOptions);

        await job.updateProgress({
          completedModules: result.completedModules,
          failedModules: result.failedModules,
        });

        // 분석 완료 후 작업 상태 업데이트 (재실행 시에도 상태 반영)
        const realFailed = result.failedModules.filter((m) => {
          const r = result.results[m];
          return r?.errorMessage !== '사용자에 의해 스킵됨';
        });
        const finalStatus = result.cancelledByUser
          ? 'cancelled'
          : result.costLimitExceeded
            ? 'partial_failure'
            : realFailed.length > 0
              ? 'partial_failure'
              : 'completed';

        await getDb()
          .update(collectionJobs)
          .set({ status: finalStatus, updatedAt: new Date() })
          .where(eq(collectionJobs.id, dbJobId));

        logger.info(
          `분석 완료: completed=${result.completedModules.length}, failed=${result.failedModules.length}, status=${finalStatus}`,
        );
        return result;
      }
    },
    { connection: getRedisConnection() },
  );
}
