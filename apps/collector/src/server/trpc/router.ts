import { router } from './init';
import { subscriptionsRouter } from './subscriptions';
import { itemsRouter } from './items';
import { runsRouter } from './runs';
import { healthRouter } from './health';
import { queueRouter } from './queue';
import { sourcesRouter } from './sources';

/**
 * collector 공개 API — ai-signalcraft 분석 시스템 및 운영 툴이 소비.
 */
export const appRouter = router({
  subscriptions: subscriptionsRouter,
  items: itemsRouter,
  runs: runsRouter,
  health: healthRouter,
  queue: queueRouter,
  sources: sourcesRouter,
});

export type AppRouter = typeof appRouter;
