import { Worker, Job } from 'bullmq';
import { getBullMQOptions } from './connection';

// Worker 프로세스 -- Next.js와 별도 프로세스로 실행 (RESEARCH Pitfall 4 참고)
// getBullMQOptions()으로 lazy 평가 -- dotenv 로드 후 실제 env를 읽음
// prefix 주입으로 개발/운영 네임스페이스 분리 (BULL_PREFIX 환경변수)
export function createCollectorWorker(processJob: (job: Job) => Promise<any>) {
  return new Worker('collectors', processJob, {
    ...getBullMQOptions(),
    concurrency: 2,
    limiter: {
      max: 8,
      duration: 10000, // 10초당 최대 8개 작업 (각 수집기 내부 딜레이가 rate limit 대응)
    },
    // 수집은 분 단위 소요 (네이버 200기사 + 댓글 수집은 수분) — 기본 30초 lockDuration은 stall 발생
    lockDuration: 600_000, // 10분
    stalledInterval: 300_000, // 5분마다 stall check
    maxStalledCount: 2,
  });
}

export function createPipelineWorker(processJob: (job: Job) => Promise<any>) {
  return new Worker('pipeline', processJob, {
    ...getBullMQOptions(),
    concurrency: 3, // normalize-naver, normalize-youtube, normalize-community를 병렬 처리
    // normalize/persist는 상대적으로 짧지만 대량 insert 시 수십초 가능 — 안전하게 10분
    lockDuration: 600_000,
    stalledInterval: 300_000,
    maxStalledCount: 2,
  });
}
