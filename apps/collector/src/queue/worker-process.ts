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
import { recoverOrphanedJobs, recoverStaleRunningRuns } from './startup-recovery';

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

/** worker.on('failed')가 전달하는 job 중 finalize 판정에 필요한 최소 형태 */
interface FailedJobInfo {
  data: { runId: string };
  attemptsMade: number;
  finishedOn?: number;
}

/**
 * executor의 catch를 거치지 않는 실패 경로(stalled 한도 초과 등)에서
 * collection_runs가 status='running'으로 영구 orphan이 되는 것을 방지.
 *
 * terminal 판정은 attemptsMade 비교가 아니라 finishedOn 유무로 한다:
 * BullMQ는 재시도 예정 실패(moveToDelayed/retryJob)에서는 finishedOn을 설정하지
 * 않고, terminal 실패(attempts 소진·stalled 한도 초과(UnrecoverableError)·discard)
 * 에서만 moveToFinished로 설정한 뒤 'failed'를 emit한다. stalled 한도 초과는
 * attemptsMade < attempts 상태에서도 terminal이라(2026-06-11 run 2bbdb301 사건)
 * attemptsMade 비교는 이 경우 finalize를 놓쳐 영구 running 좀비를 만든다.
 */
export async function finalizeTerminalFailedRun(
  source: CollectorSource,
  job: FailedJobInfo | undefined,
  err: Error,
): Promise<void> {
  if (!job) return;
  if (job.finishedOn == null) return; // 재시도 예정 — terminal 실패만 finalize

  const runId = job.data.runId;
  const reason = (err.message ?? 'unknown').slice(0, 500);
  try {
    await getDb()
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
      );
  } catch (dbErr) {
    console.error(
      `[worker:${source}] failed-hook DB finalize 실패 runId=${runId}:`,
      dbErr instanceof Error ? dbErr.message : dbErr,
    );
  }
}

/**
 * 프로세스 레벨 크래시 가드 (이슈 #154 유형 B 진단).
 *
 * 핸들러가 없으면 uncaughtException/unhandledRejection이 무로그 즉사로 이어져
 * 사망 원인 추적이 불가능하다 (2026-06-11 하루 9회 재부팅 중 다수가 원인 미상).
 * 프로세스 상태는 이미 불확정이므로 복구를 시도하지 않고, 원인을 로그한 뒤
 * exit(1)로 종료해 docker restart(unless-stopped)가 깨끗하게 재기동하게 한다.
 */
export function registerProcessGuards(): void {
  process.on('uncaughtException', (err) => {
    console.error('[worker-process] uncaughtException — 종료 후 재기동:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[worker-process] unhandledRejection — 종료 후 재기동:', reason);
    process.exit(1);
  });
}

function buildWorker(source: CollectorSource): Worker<CollectionJobData, CollectionJobResult> {
  const opts: WorkerOptions = {
    ...getBullMQOptions(),
    concurrency: CONCURRENCY[source],
    // 임베딩(Xenova CPU 추론)이 이벤트 루프를 장시간 점유하면 lock 갱신이 밀린다.
    // lockDuration이 실제 잡 시간(naver-comments 1만 댓글 = 30~50분)보다 짧으면
    // BullMQ가 stalled로 오판해 같은 잡을 재배달하는데, 기존 실행은 죽지 않고 계속
    // 돌아 이중 실행(유령 실행)이 릴레이처럼 이어진다 — 2026-06-10 분석: 한 run이
    // 17일간 시간당 1~2회 재수집 루프를 돌며 OOM(exit 137) 크래시까지 유발.
    // 최대 잡 시간보다 넉넉한 60분으로 설정. 워커 사망 시 복구는 startup-recovery 담당.
    lockDuration: 3_600_000,
    // 5분마다 stall check — 60분 lock에서 2분 체크는 과도.
    stalledInterval: 300_000,
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
    void finalizeTerminalFailedRun(source, job, err);
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
  registerProcessGuards();
  console.warn('[worker-process] verifying hypertable constraints...');
  await assertHypertableConstraints();
  // Worker 시작 전 orphaned job 복구
  await recoverOrphanedJobs().catch((err) =>
    console.error('[startup-recovery] 복구 실패 (무시하고 계속):', err),
  );
  // 어떤 finalize 경로도 못 탄 좀비 running 행 정리 (terminal 실패 직전 크래시 등)
  await recoverStaleRunningRuns().catch((err) =>
    console.error('[startup-recovery] stale running 정리 실패 (무시하고 계속):', err),
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
