// BullMQ Worker 실행 프로세스 -- Next.js와 별개 프로세스로 실행
// 실행: pnpm worker (루트) 또는 pnpm --filter @ai-signalcraft/core worker
//
// 진입점: env 로드 -> 수집기 등록 -> 정리 -> Worker 3개 기동 -> graceful shutdown
import { ensureGeminiTokenFresh, startGeminiTokenAutoRefresh } from '../utils/gemini-token-refresh';
import { initEnv, validateApiKeys, registerAllCollectors } from './worker-config';
import { createCollectorWorker, createPipelineWorker } from './workers';
import { createCollectorHandler } from './collector-worker';
import { createPipelineHandler } from './pipeline-worker';
import { createAnalysisWorker } from './analysis-worker';
import { getBullPrefix } from './connection';
import { sendToDLQ } from './dlq';
import { startWorkerHealthHeartbeat, stopWorkerHealthHeartbeat } from './worker-health';

async function main() {
  // 1. 환경 설정
  initEnv();
  validateApiKeys();
  registerAllCollectors();

  // 1.5. Worker 시작 시 정리 (완료 후 Worker 기동)
  // a) cancelled/삭제된 작업의 Redis 잔류물 제거 + orphaned active job 복구
  await import('./startup-cleanup')
    .then(({ cleanupOrphanedRedisJobs }) => cleanupOrphanedRedisJobs())
    .catch((err) => console.error('[startup-cleanup] 정리 실패 (무시하고 계속):', err));
  // b) DB running이지만 BullMQ에 없는 collection_jobs orphan 복구
  await import('./startup-cleanup')
    .then(({ recoverOrphanedCollectionJobs }) => recoverOrphanedCollectionJobs(10))
    .catch((err) => console.error('[startup-cleanup] orphan 복구 실패 (무시하고 계속):', err));
  // c) 좀비 running 상태 복구
  await import('../analysis/stale-recovery')
    .then(({ recoverStaleJobs }) => recoverStaleJobs(30))
    .catch((err) => console.error('[stale-recovery] 복구 실패 (무시하고 계속):', err));
  // c) Gemini CLI OAuth 토큰 사전 갱신 + 자동 갱신 스케줄러 시작
  await ensureGeminiTokenFresh().catch((err) =>
    console.error('[gemini-token] 시작 시 갱신 실패 (무시하고 계속):', err),
  );
  startGeminiTokenAutoRefresh();

  // 2. Worker 기동
  const collectorWorker = createCollectorWorker(createCollectorHandler());
  const pipelineWorker = createPipelineWorker(createPipelineHandler());
  const analysisWorker = createAnalysisWorker();

  // 2.5. DLQ: 실패한 잡을 데드 레터 큐로 전송
  for (const worker of [collectorWorker, pipelineWorker, analysisWorker]) {
    worker.on('failed', (job, err) => {
      if (job) sendToDLQ(job, err);
    });
  }

  // 2.6. Worker health heartbeat 시작
  startWorkerHealthHeartbeat([collectorWorker, pipelineWorker, analysisWorker]);

  // 현재 BullMQ prefix 표시 — 개발/운영 구분 명시
  const prefix = getBullPrefix();
  const envLabel = process.env.NODE_ENV === 'production' ? '운영' : '개발';
  console.log(`Workers started [${envLabel} / BullMQ prefix='${prefix}']. Waiting for jobs...`);
  console.log(`  - Collector worker (${prefix}:collectors queue)`);
  console.log(`  - Pipeline worker (${prefix}:pipeline queue)`);
  console.log(`  - Analysis worker (${prefix}:analysis queue)`);

  // 3. Graceful shutdown
  const shutdown = async () => {
    stopWorkerHealthHeartbeat();
    await collectorWorker.close();
    await pipelineWorker.close();
    await analysisWorker.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// ESM 진입점 판정 (tsx 호환)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[worker-process] fatal:', err);
    process.exit(1);
  });
}
