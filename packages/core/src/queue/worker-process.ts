// BullMQ Worker 실행 프로세스 -- Next.js와 별도 프로세스로 실행
// 실행: pnpm worker (루트) 또는 pnpm --filter @ai-signalcraft/core worker
//
// 진입점: env 로드 -> 수집기 등록 -> Worker 3개 기동 -> graceful shutdown
import { initEnv, validateApiKeys, registerAllCollectors } from './worker-config';
import { createCollectorWorker, createPipelineWorker } from './workers';
import { createCollectorHandler } from './collector-worker';
import { createPipelineHandler } from './pipeline-worker';
import { createAnalysisWorker } from './analysis-worker';

// 1. 환경 설정
initEnv();
validateApiKeys();
registerAllCollectors();

// 2. Worker 기동
const collectorWorker = createCollectorWorker(createCollectorHandler());
const pipelineWorker = createPipelineWorker(createPipelineHandler());
const analysisWorker = createAnalysisWorker();

console.log('Workers started. Waiting for jobs...');
console.log('  - Collector worker (collectors queue)');
console.log('  - Pipeline worker (pipeline queue)');
console.log('  - Analysis worker (analysis queue)');

// 3. Graceful shutdown
process.on('SIGTERM', async () => {
  await collectorWorker.close();
  await pipelineWorker.close();
  await analysisWorker.close();
  process.exit(0);
});
