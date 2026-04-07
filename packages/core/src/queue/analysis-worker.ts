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

        // 장시간 분석 중 lock 만료 방지 — 2분마다 lock 갱신
        let lockLost = false;
        const lockExtender = setInterval(async () => {
          try {
            await job.extendLock(job.token!, 600_000);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.warn(`lock 갱신 실패 (job=${dbJobId}): ${msg}`);
            // lock 연속 실패 시 중복 실행 방지를 위해 플래그 설정
            lockLost = true;
          }
        }, 120_000);

        let result;
        try {
          result = await runAnalysisPipeline(dbJobId, resumeOptions);
        } finally {
          clearInterval(lockExtender);
        }

        // lock 손실 감지 — 다른 워커가 동일 작업을 이미 처리 중일 수 있음
        if (lockLost) {
          logger.warn(`lock 손실 감지 (job=${dbJobId}) — 결과 저장 전 작업 상태 확인`);
          const db = getDb();
          const [currentJob] = await db
            .select({ status: collectionJobs.status })
            .from(collectionJobs)
            .where(eq(collectionJobs.id, dbJobId));
          if (currentJob?.status === 'completed' || currentJob?.status === 'cancelled') {
            logger.warn(
              `작업이 이미 ${currentJob.status} 상태 (job=${dbJobId}) — 중복 저장 건너뜀`,
            );
            return result;
          }
        }

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
    {
      connection: getRedisConnection(),
      // AI 분석은 수분~수십분 소요 — 기본 30초 lockDuration은 stall 발생
      lockDuration: 600_000, // 10분
      stalledInterval: 300_000, // 5분마다 stall check
    },
  );
}
