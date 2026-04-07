// BullMQ Worker 실행 프로세스 -- Next.js와 별도 프로세스로 실행
// 실행: pnpm worker (루트) 또는 pnpm --filter @ai-signalcraft/core worker
//
// 진입점: env 로드 -> 수집기 등록 -> Worker 3개 기동 -> graceful shutdown
import { initEnv, validateApiKeys, registerAllCollectors } from './worker-config';
import { createCollectorWorker, createPipelineWorker } from './workers';
import { createCollectorHandler } from './collector-worker';
import { createPipelineHandler } from './pipeline-worker';
import { createAnalysisWorker } from './analysis-worker';
import { getBullPrefix } from './connection';

// 1. 환경 설정
initEnv();
validateApiKeys();
registerAllCollectors();

// 1.5. Worker 시작 시 정리
// a) cancelled/삭제된 작업의 Redis 잔류물 제거
import('./startup-cleanup').then(({ cleanupOrphanedRedisJobs }) =>
  cleanupOrphanedRedisJobs().catch((err) =>
    console.error('[startup-cleanup] 정리 실패 (무시하고 계속):', err),
  ),
);
// b) 좀비 running 상태 복구
import('../analysis/stale-recovery').then(({ recoverStaleJobs }) =>
  recoverStaleJobs(30).catch((err) =>
    console.error('[stale-recovery] 복구 실패 (무시하고 계속):', err),
  ),
);

// 2. Worker 기동
const collectorWorker = createCollectorWorker(createCollectorHandler());
const pipelineWorker = createPipelineWorker(createPipelineHandler());
const analysisWorker = createAnalysisWorker();

// 현재 BullMQ prefix 표시 — 개발/운영 구분 명시
const prefix = getBullPrefix();
const envLabel = process.env.NODE_ENV === 'production' ? '운영' : '개발';
console.log(`Workers started [${envLabel} / BullMQ prefix='${prefix}']. Waiting for jobs...`);
console.log(`  - Collector worker (${prefix}:collectors queue)`);
console.log(`  - Pipeline worker (${prefix}:pipeline queue)`);
console.log(`  - Analysis worker (${prefix}:analysis queue)`);

// 3. Graceful shutdown
process.on('SIGTERM', async () => {
  await collectorWorker.close();
  await pipelineWorker.close();
  await analysisWorker.close();
  process.exit(0);
});
