import { Worker, type WorkerOptions } from 'bullmq';
import { getBullMQOptions } from './connection';
import {
  COLLECTOR_SOURCES,
  type CollectorSource,
  type CollectionJobData,
  type CollectionJobResult,
} from './types';
import { executeCollectionJob } from './executor';

/**
 * 소스별 Worker 동시성.
 *
 * 대상 사이트마다 차단 민감도가 달라서 개별 조정이 필요하다.
 * - naver-news: 비교적 관대 — 2
 * - youtube: API quota 기반 — 2
 * - community(dc/fm/clien): 브라우저 크롤 — 1 (직렬)
 */
const CONCURRENCY: Record<CollectorSource, number> = {
  'naver-news': 2,
  youtube: 2,
  dcinside: 1,
  fmkorea: 1,
  clien: 1,
};

function buildWorker(source: CollectorSource): Worker<CollectionJobData, CollectionJobResult> {
  const opts: WorkerOptions = {
    ...getBullMQOptions(),
    concurrency: CONCURRENCY[source],
    // 차단 방지: 작업 간 최소 간격 (ms). 소스별로 별도 튜닝 여지.
    limiter: {
      max: source === 'youtube' ? 5 : 2,
      duration: 1000,
    },
  };

  const worker = new Worker<CollectionJobData, CollectionJobResult>(
    `collect-${source}`,
    async (job) => executeCollectionJob(job),
    opts,
  );

  worker.on('completed', (job, result) => {
    console.warn(
      `[worker:${source}] completed runId=${result.runId} items=${result.itemsCollected} new=${result.itemsNew} dur=${result.durationMs}ms`,
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[worker:${source}] failed runId=${job?.data.runId} attempt=${job?.attemptsMade}: ${err.message}`,
    );
  });

  worker.on('error', (err) => {
    console.error(`[worker:${source}] error: ${err.message}`);
  });

  return worker;
}

export function startAllWorkers(): Array<{ source: CollectorSource; worker: Worker }> {
  return COLLECTOR_SOURCES.map((source) => ({
    source,
    worker: buildWorker(source),
  }));
}

export async function shutdownWorkers(
  workers: Array<{ source: CollectorSource; worker: Worker }>,
): Promise<void> {
  await Promise.all(
    workers.map(async ({ source, worker }) => {
      console.warn(`[worker:${source}] closing...`);
      await worker.close();
    }),
  );
}

/**
 * 단독 실행 진입점 — `tsx apps/collector/src/queue/worker-process.ts`.
 * docker-compose의 collector-worker 서비스가 사용.
 */
async function main() {
  console.warn('[worker-process] starting all source workers...');
  const workers = startAllWorkers();
  console.warn(
    `[worker-process] ${workers.length} workers running: ${workers.map((w) => w.source).join(', ')}`,
  );

  const shutdown = async (signal: string) => {
    console.warn(`[worker-process] ${signal} received, draining...`);
    await shutdownWorkers(workers);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// ESM 진입점 판정 (tsx 호환)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[worker-process] fatal:', err);
    process.exit(1);
  });
}
