import { Worker, Job } from 'bullmq';
import { getBullMQOptions } from './connection';

// Worker 프로세스 -- Next.js와 별도 프로세스로 실행 (RESEARCH Pitfall 4 참고)
// getBullMQOptions()으로 lazy 평가 -- dotenv 로드 후 실제 env를 읽음
// prefix 주입으로 개발/운영 네임스페이스 분리 (BULL_PREFIX 환경변수)
export function createCollectorWorker(processJob: (job: Job) => Promise<any>) {
  return new Worker('collectors', processJob, {
    ...getBullMQOptions(),
    // ⚠️ concurrency=1: 같은 워커 프로세스 안에서 잡이 동시에 실행되면 일자별 cap의
    //   dayCount Map이 잡마다 별개라도 stalled 재실행과 결합 시 중복 누적 가능.
    //   안전을 위해 직렬 실행. 처리량은 한 잡당 페이스가 결정적이라 큰 손해 없음.
    concurrency: 1,
    limiter: {
      max: 8,
      duration: 10000,
    },
    // lockDuration을 길게 잡아 fmkorea 같은 안티봇 사이트의 분 단위 지연에서도 stalled를 방지.
    // stalled는 dayCount Map 리셋으로 cap을 우회시키는 결정적 위반 원인이 되므로 보수적으로 30분.
    lockDuration: 1_800_000, // 30분
    stalledInterval: 600_000, // 10분마다 stall check
    // stalled 재실행 허용 (1회). 수집은 ON CONFLICT DO NOTHING으로 멱등성 보장.
    // executor의 dayCount Map은 job 재시작 시 초기화되지만,
    // TimescaleDB에서 이미 수집된 날짜의 데이터는 중복 저장되지 않음.
    maxStalledCount: 1,
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
    // 일시적 장애(네트워크, DB 연결) 시 자동 재시도
    settings: {
      backoffStrategy: (attemptsMade: number) =>
        Math.min(30_000 * Math.pow(2, attemptsMade), 300_000),
    },
  });
}
