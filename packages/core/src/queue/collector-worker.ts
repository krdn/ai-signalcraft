// 수집 Worker 핸들러 -- collectors 큐
// D-04: 부분 실패 허용 -- 개별 소스 실패 시 빈 결과 반환 (파이프라인 중단 방지)
import type { Job } from 'bullmq';
import {
  getCollector,
  buildDynamicCollector,
  type DataSourceSnapshot,
} from '@ai-signalcraft/collectors';
import { updateJobProgress, appendJobEvent } from '../pipeline';
import { isPipelineCancelled } from '../pipeline/control';
import { createLogger } from '../utils/logger';
import { progressKey, countBySourceType } from './worker-config';

const logger = createLogger('collector-worker');

interface CollectorResult {
  source: string;
  items: unknown[];
  count: number;
}

export function createCollectorHandler(): (job: Job) => Promise<CollectorResult> {
  return async (job: Job): Promise<CollectorResult> => {
    const { source, keyword, startDate, endDate, maxItems, maxComments, dbJobId } = job.data;
    const dataSourceSnapshot = job.data.dataSourceSnapshot as DataSourceSnapshot | undefined;

    // 동적 소스(RSS/HTML)면 factory로 인스턴스 생성, 아니면 기존 정적 registry 조회
    const collector = dataSourceSnapshot
      ? buildDynamicCollector(dataSourceSnapshot)
      : getCollector(source);
    if (!collector) throw new Error(`Unknown source: ${source}`);

    const pKey = progressKey(source, dataSourceSnapshot?.id);

    const startTime = Date.now();
    logger.info(`[${source}] 수집 시작 (keyword=${keyword}, maxItems=${maxItems})`);

    try {
      // DB: 수집 시작 상태
      if (dbJobId) {
        await updateJobProgress(
          dbJobId,
          {
            [pKey]: { status: 'running', ...countBySourceType(source, []) },
          },
          'running',
        );
      }

      const allItems: unknown[] = [];
      for await (const chunk of collector.collect({
        keyword,
        startDate,
        endDate,
        maxItems,
        maxComments,
      })) {
        // 취소 확인 — DB에서 cancelled 상태이면 즉시 중단
        if (dbJobId && (await isPipelineCancelled(dbJobId))) {
          logger.info(`[${source}] 사용자에 의해 수집 중지됨 (${allItems.length}건 수집 후)`);
          return { source, items: allItems, count: allItems.length };
        }
        allItems.push(...chunk);
        await job.updateProgress({ collected: allItems.length });
        // DB: 실시간 진행 업데이트
        if (dbJobId) {
          await updateJobProgress(dbJobId, {
            [pKey]: { status: 'running', ...countBySourceType(source, allItems) },
          });
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`[${source}] 수집 완료: ${allItems.length}건, ${elapsed}초 소요`);

      // DB: 수집 완료
      if (dbJobId) {
        await updateJobProgress(dbJobId, {
          [pKey]: { status: 'completed', ...countBySourceType(source, allItems) },
        });
      }

      return { source, items: allItems, count: allItems.length };
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`[${source}] 수집 실패 (${elapsed}초, 부분 실패 허용):`, errMsg);
      // DB: 수집 실패
      if (dbJobId) {
        await updateJobProgress(dbJobId, {
          [pKey]: { status: 'failed', ...countBySourceType(source, []) },
        });
        appendJobEvent(dbJobId, 'error', `${source} 수집 실패: ${errMsg}`).catch(() => {});
      }
      return { source, items: [], count: 0 };
    }
  };
}
