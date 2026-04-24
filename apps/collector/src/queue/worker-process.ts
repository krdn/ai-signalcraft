import 'dotenv/config';
import { Worker, type WorkerOptions } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { hasYoutubeApiKey } from '@ai-signalcraft/collectors';
import { assertHypertableConstraints } from '../db/migrations/verify-hypertable-constraints';
import { getDb } from '../db';
import { collectionRuns } from '../db/schema';
import { getBullMQOptions } from './connection';
import {
  COLLECTOR_SOURCES,
  type CollectorSource,
  type CollectionJobData,
  type CollectionJobResult,
} from './types';
import { executeCollectionJob } from './executor';
import { recoverOrphanedJobs } from './startup-recovery';

/**
 * 소스별 기동 전 환경 검증.
 * 누락 시 워커는 여전히 기동하되(다른 소스 보존) 매우 눈에 띄는 경고를 남긴다.
 * 실제 수집 실행은 개별 작업에서 throw되어 run 상태가 failed로 기록된다.
 */
function logSourcePreflight(source: CollectorSource): void {
  if (source === 'youtube' && !hasYoutubeApiKey()) {
    console.error(
      `[worker:youtube] ⚠ YOUTUBE_API_KEY missing — 실행 시도 시 모든 작업이 failed로 기록됩니다. .env.production 및 compose env_file 확인 필요.`,
    );
  }
}

/**
 * 소스별 Worker 동시성.
 *
 * 대상 사이트마다 차단 민감도가 달라서 개별 조정이 필요하다.
 * - naver-news: 비교적 관대 — 2
 * - naver-comments: 비공식 JSONP, 500ms 인터벌 — 서로 다른 subscription 간 병렬 2
 * - youtube: API quota 기반 — 2
 * - community(dc/fm/clien): 브라우저 크롤 — 1 (직렬)
 */
const CONCURRENCY: Record<CollectorSource, number> = {
  'naver-news': 2,
  'naver-comments': 2,
  youtube: 2,
  dcinside: 1,
  fmkorea: 1,
  clien: 1,
};

function buildWorker(source: CollectorSource): Worker<CollectionJobData, CollectionJobResult> {
  const opts: WorkerOptions = {
    ...getBullMQOptions(),
    concurrency: CONCURRENCY[source],
    // 대량 수집(특히 youtube 수천건 댓글 + 임베딩)은 한 job이 수 분 이상 걸린다.
    // BullMQ 기본 lockDuration=30s로는 CPU가 임베딩 추론에 점유될 때 갱신 실패 →
    // "stalled" 오판으로 같은 job이 중복 재실행되거나 실패 기록됨.
    // 5분으로 늘려 정상적으로 오래 걸리는 작업을 stalled로 오판하지 않도록 한다.
    // YouTube 대량 수집(수천 건 비디오+댓글+임베딩)은 5분 이상 소요 가능.
    // 10분으로 늘려 stalled 오판 방지.
    lockDuration: 600_000,
    // 2분마다 stall check — 10분 lockDuration의 1/5.
    stalledInterval: 120_000,
    // Worker 재시작 시 orphaned job 복구 허용. 수집은 멱등.
    maxStalledCount: 1,
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

    // executor의 catch를 거치지 않는 실패 경로(stalled 초과 등)에서
    // collection_runs가 status='running'으로 영구 orphan이 되는 것을 방지.
    // 재시도 경쟁을 피하려고 '마지막 시도'일 때만 finalize.
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade >= maxAttempts;
    if (!isLastAttempt) return;

    const runId = job.data.runId;
    const reason = (err.message ?? 'unknown').slice(0, 500);
    void getDb()
      .update(collectionRuns)
      .set({
        status: 'failed',
        errorReason: `worker.failed: ${reason}`,
      })
      .where(
        and(
          eq(collectionRuns.runId, runId),
          eq(collectionRuns.source, source),
          eq(collectionRuns.status, 'running'),
        ),
      )
      .catch((dbErr) => {
        console.error(
          `[worker:${source}] failed-hook DB finalize 실패 runId=${runId}:`,
          dbErr instanceof Error ? dbErr.message : dbErr,
        );
      });
  });

  worker.on('error', (err) => {
    console.error(`[worker:${source}] error: ${err.message}`);
  });

  return worker;
}

export function startAllWorkers(): Array<{ source: CollectorSource; worker: Worker }> {
  return COLLECTOR_SOURCES.map((source) => {
    logSourcePreflight(source);
    return {
      source,
      worker: buildWorker(source),
    };
  });
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
  console.warn('[worker-process] verifying hypertable constraints...');
  await assertHypertableConstraints();
  // Worker 시작 전 orphaned job 복구
  await recoverOrphanedJobs().catch((err) =>
    console.error('[startup-recovery] 복구 실패 (무시하고 계속):', err),
  );
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
