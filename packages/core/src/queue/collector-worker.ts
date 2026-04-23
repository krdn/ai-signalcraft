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
import { createLogger, logError } from '../utils/logger';
import { progressKey, countBySourceType } from './worker-config';

const logger = createLogger('collector-worker');

interface CollectorResult {
  source: string;
  items: unknown[];
  count: number;
}

export function createCollectorHandler(): (job: Job) => Promise<CollectorResult> {
  return async (job: Job): Promise<CollectorResult> => {
    const { source, keyword, startDate, endDate, maxItems, maxItemsPerDay, maxComments, dbJobId } =
      job.data;
    const dataSourceSnapshot = job.data.dataSourceSnapshot as DataSourceSnapshot | undefined;
    const reusePlan = job.data.reusePlan as
      | {
          skipUrls: string[];
          refetchCommentsFor: Array<{
            url: string;
            articleId?: number;
            videoId?: number;
            lastCommentsFetchedAt: string | null;
          }>;
        }
      | undefined;

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
        maxItemsPerDay,
        maxComments,
        reusePlan,
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
        // 옵션 1: 어댑터가 보고한 종료 통계를 events에 기록 (운영 진단용).
        // getLastRunStats를 구현한 어댑터(BrowserCollector 계열)에서만 동작.
        const stats = (collector as { getLastRunStats?: () => unknown }).getLastRunStats?.();
        if (stats) {
          const s = stats as {
            endReason: string;
            lastPage: number;
            perDayCount: Record<string, number>;
            perDayCapSkip?: number;
            preFilterSkip?: number;
            outOfRange?: number;
            pageEmptyCount?: number;
            quotaUsed?: number;
            quotaRemaining?: number;
            usedFallback?: boolean;
          };
          const distStr = Object.entries(s.perDayCount)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([d, n]) => `${d}=${n}`)
            .join(' ');
          const quotaInfo =
            s.quotaUsed != null
              ? ` quota=${s.quotaUsed}/${s.quotaUsed + (s.quotaRemaining ?? 0)}`
              : '';
          const fallbackInfo = s.usedFallback ? ' [innertube-fallback]' : '';
          appendJobEvent(
            dbJobId,
            'info',
            `[${source}] 종료: reason=${s.endReason} lastPage=${s.lastPage}${quotaInfo}${fallbackInfo} 분포(KST)={${distStr}} capSkip=${s.perDayCapSkip ?? 0} preFilterSkip=${s.preFilterSkip ?? 0} outOfRange=${s.outOfRange ?? 0} pageEmpty=${s.pageEmptyCount ?? 0}`,
          ).catch((err) => logError('collector-worker', err));
        }
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
        appendJobEvent(dbJobId, 'error', `${source} 수집 실패: ${errMsg}`).catch((err) =>
          logError('collector-worker', err),
        );
      }
      return { source, items: [], count: 0 };
    }
  };
}
