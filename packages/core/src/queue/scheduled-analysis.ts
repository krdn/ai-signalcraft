// 예약/반복 분석 — BullMQ repeatable job 기반 자동 정기 분석 관리
import { Queue } from 'bullmq';
import { createLogger } from '../utils/logger';
import { getBullMQOptions } from './connection';

const logger = createLogger('scheduled-analysis');

const analysisQueue = new Queue('analysis', getBullMQOptions());

export interface ScheduleConfig {
  jobId: number; // 설정을 복제할 템플릿 작업 ID
  cronExpression: string; // 예: '0 */6 * * *' (6시간마다)
  enabled: boolean;
}

// 예약 분석 생성/수정
export async function setAnalysisSchedule(config: ScheduleConfig): Promise<void> {
  const key = `scheduled-analysis-${config.jobId}`;

  if (!config.enabled) {
    await analysisQueue.removeRepeatableByKey(key);
    logger.info(`예약 분석 비활성화: jobId=${config.jobId}`);
    return;
  }

  await analysisQueue.add(
    'run-analysis',
    {
      dbJobId: config.jobId,
      keyword: '', // 템플릿 작업에서 로드됨
      useCollectorLoader: true,
      isScheduled: true,
    },
    {
      repeat: { pattern: config.cronExpression },
      jobId: key,
    },
  );
  logger.info(`예약 분석 설정: jobId=${config.jobId}, cron=${config.cronExpression}`);
}

// 모든 예약 분석 목록 조회
export async function listSchedules(): Promise<
  Array<{ key: string; pattern: string; nextRun: Date }>
> {
  const repeatableJobs = await analysisQueue.getRepeatableJobs();
  return repeatableJobs
    .filter((j) => j.key.startsWith('scheduled-analysis-') && j.next != null)
    .map((j) => ({ key: j.key, pattern: j.pattern ?? '', nextRun: new Date(j.next!) }));
}

// 예약 분석 제거
export async function removeSchedule(jobId: number): Promise<void> {
  const key = `scheduled-analysis-${jobId}`;
  await analysisQueue.removeRepeatableByKey(key);
  logger.info(`예약 분석 제거: jobId=${jobId}`);
}
