import type { LayerCPayload } from '../db/schema';
import { getAllCollectQueues } from './queues';

/**
 * 각 source별 BullMQ 큐의 상태를 수집. 모니터 UI + Layer C 공통.
 * 한 큐 조회 실패 시 해당 큐만 워커 0 + 카운트 0으로 표시하고 계속 진행.
 */
export async function getCollectQueueStatus(): Promise<LayerCPayload['queues']> {
  const entries = getAllCollectQueues();
  const out: LayerCPayload['queues'] = {};

  for (const { source, queue } of entries) {
    try {
      const rawWorkers = await queue.getWorkers();
      const workers = rawWorkers.map((w) => ({
        id: String((w as { id?: string }).id ?? ''),
        addr: String((w as { addr?: string }).addr ?? ''),
        idleMs: Number((w as { idle?: number }).idle ?? 0),
      }));
      const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'paused');
      const isPaused = await queue.isPaused();
      out[`collect-${source}`] = {
        workerCount: workers.length,
        workers,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          paused: counts.paused ?? 0,
        },
        isPaused,
      };
    } catch (err) {
      console.warn(
        `[queue-health] collect-${source} 조회 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
      out[`collect-${source}`] = {
        workerCount: 0,
        workers: [],
        counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
        isPaused: false,
      };
    }
  }
  return out;
}
