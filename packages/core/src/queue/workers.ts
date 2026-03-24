import { Worker, Job } from 'bullmq';
import { redisConnection } from './connection';

// Worker 프로세스 -- Next.js와 별도 프로세스로 실행 (RESEARCH Pitfall 4 참고)
export function createCollectorWorker(processJob: (job: Job) => Promise<any>) {
  return new Worker('collectors', processJob, {
    connection: redisConnection,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 10000,  // 10초당 최대 5개 작업 (네이버 rate limit 대응)
    },
  });
}

export function createPipelineWorker(processJob: (job: Job) => Promise<any>) {
  return new Worker('pipeline', processJob, {
    connection: redisConnection,
    concurrency: 1,
  });
}
