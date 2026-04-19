import { router } from './init';
import { subscriptionsRouter } from './subscriptions';

/**
 * P1 단계 — subscriptions CRUD 만 노출.
 * P3에서 items/runs/health 라우터 추가 예정.
 */
export const appRouter = router({
  subscriptions: subscriptionsRouter,
});

export type AppRouter = typeof appRouter;
