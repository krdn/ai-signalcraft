import { getCollectQueueStatus } from '../../queue/health';
import { router, protectedProcedure } from './init';

export const queueRouter = router({
  /**
   * 모든 수집 큐(source별)의 상태 — worker 수/idle, job 카운트(waiting/active/...), isPaused.
   * 모니터 UI의 큐 적체 바 + Layer C 공용.
   */
  status: protectedProcedure.query(async () => {
    return getCollectQueueStatus();
  }),
});
