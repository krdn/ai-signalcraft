// 수집 Worker 핸들러 -- collectors 큐
// D-04: 부분 실패 허용 -- 개별 소스 실패 시 빈 결과 반환 (파이프라인 중단 방지)
import type { Job } from 'bullmq';
import { getCollector } from '@ai-signalcraft/collectors';
import { updateJobProgress } from '../pipeline';
import { progressKey, countBySourceType } from './worker-config';
import { createLogger } from '../utils/logger';

const logger = createLogger('collector-worker');

interface CollectorResult {
  source: string;
  items: unknown[];
  count: number;
}

export function createCollectorHandler(): (job: Job) => Promise<CollectorResult> {
  return async (job: Job): Promise<CollectorResult> => {
    const { source, keyword, startDate, endDate, maxItems, maxComments, dbJobId } = job.data;
    const collector = getCollector(source);
    if (!collector) throw new Error(`Unknown source: ${source}`);

    const pKey = progressKey(source);

    try {
      // DB: 수집 시작 상태
      if (dbJobId) {
        await updateJobProgress(dbJobId, {
          [pKey]: { status: 'running', ...countBySourceType(source, []) }
        }, 'running');
      }

      const allItems: unknown[] = [];
      for await (const chunk of collector.collect({ keyword, startDate, endDate, maxItems, maxComments })) {
        allItems.push(...chunk);
        await job.updateProgress({ collected: allItems.length });
        // DB: 실시간 진행 업데이트
        if (dbJobId) {
          await updateJobProgress(dbJobId, {
            [pKey]: { status: 'running', ...countBySourceType(source, allItems) }
          });
        }
      }

      // DB: 수집 완료
      if (dbJobId) {
        await updateJobProgress(dbJobId, {
          [pKey]: { status: 'completed', ...countBySourceType(source, allItems) }
        });
      }

      return { source, items: allItems, count: allItems.length };
    } catch (err) {
      logger.warn(`[${source}] 수집 실패 (부분 실패 허용):`, err instanceof Error ? err.message : err);
      // DB: 수집 실패
      if (dbJobId) {
        await updateJobProgress(dbJobId, {
          [pKey]: { status: 'failed', ...countBySourceType(source, []) }
        });
      }
      return { source, items: [], count: 0 };
    }
  };
}
