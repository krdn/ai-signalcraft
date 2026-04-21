import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns } from '../db/schema';
import type { CollectorSource } from '../queue/types';

// 한 소스가 연속 0건으로 수집되어도 subscription.lastRunAt은 다른 소스 성공으로 갱신되므로,
// 소스별 startISO를 subscription.lastRunAt 하나로 계산하면 "영구 0건" 상태가 발생한다.
// (실제 사례: 구독 225 — clien 4연속 0건 + dcinside/fmkorea/naver는 수집 성공)
// 해결: collection_runs에서 subscription+source 범위의 최근 "성공 수집" 시각을 별도로 추적한다.
// 성공 수집이 없거나 MAX_STALENESS_MS 이전이면 "지난 N일"로 확장해 초기 수집 기회를 보장.
export const MAX_STALENESS_MS = 7 * 24 * 3600 * 1000;

export type WindowReason = 'source-last-success' | 'stale-fallback' | 'first-run';

export interface SourceWindow {
  startISO: string;
  reason: WindowReason;
  lastSuccessAt: Date | null;
}

/**
 * subscription+source 쌍의 수집 시작 시각(startISO)을 계산한다.
 *
 * 원칙:
 *   1) 해당 source로 items_collected > 0 이었던 가장 최근 run의 time을 lastSuccessAt으로 본다
 *   2) lastSuccessAt이 존재하고 (now - lastSuccessAt) <= MAX_STALENESS_MS 이면 lastSuccessAt - overlap
 *   3) 존재하지 않거나 너무 오래됐으면 now - MAX_STALENESS_MS (초기 수집 기회 확보)
 *
 * overlap은 호출자가 intervalMs * ROLLING_OVERLAP_RATIO로 계산해 전달.
 */
export async function computeSourceStart(params: {
  subscriptionId: number;
  source: CollectorSource;
  now: Date;
  overlapMs: number;
}): Promise<SourceWindow> {
  const { subscriptionId, source, now, overlapMs } = params;
  const db = getDb();

  // items_collected > 0 인 가장 최근 성공 수집 run.
  // status='completed'로 끝났어도 items=0이면 "수집 성공"으로 보지 않는다 — 그게 영구 0건의 원인.
  const [lastSuccess] = await db
    .select({ time: collectionRuns.time })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.subscriptionId, subscriptionId),
        eq(collectionRuns.source, source),
        eq(collectionRuns.status, 'completed'),
        gt(collectionRuns.itemsCollected, 0),
      ),
    )
    .orderBy(desc(collectionRuns.time))
    .limit(1);

  const staleCutoff = new Date(now.getTime() - MAX_STALENESS_MS);

  if (lastSuccess && lastSuccess.time > staleCutoff) {
    return {
      startISO: new Date(lastSuccess.time.getTime() - overlapMs).toISOString(),
      reason: 'source-last-success',
      lastSuccessAt: lastSuccess.time,
    };
  }

  return {
    startISO: staleCutoff.toISOString(),
    reason: lastSuccess ? 'stale-fallback' : 'first-run',
    lastSuccessAt: lastSuccess?.time ?? null,
  };
}

/**
 * 배치 쿼리 — 여러 source를 한 번의 SELECT로 처리해 스캐너 RT를 줄인다.
 * 반환 Map 은 source별 결과. 입력 sources에 있지만 해당 row가 없는 소스는 first-run으로 처리.
 */
export async function computeSourceStartBatch(params: {
  subscriptionId: number;
  sources: CollectorSource[];
  now: Date;
  overlapMs: number;
}): Promise<Map<CollectorSource, SourceWindow>> {
  const { subscriptionId, sources, now, overlapMs } = params;
  const result = new Map<CollectorSource, SourceWindow>();
  if (sources.length === 0) return result;

  const db = getDb();
  // 각 source별로 최신 성공 시각을 한 번에 뽑는다.
  // DISTINCT ON(source) + ORDER BY source, time DESC 로 source별 최신 1건만 반환.
  const rows = await db
    .selectDistinctOn([collectionRuns.source], {
      source: collectionRuns.source,
      time: collectionRuns.time,
    })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.subscriptionId, subscriptionId),
        inArray(collectionRuns.source, sources),
        eq(collectionRuns.status, 'completed'),
        gt(collectionRuns.itemsCollected, 0),
      ),
    )
    .orderBy(collectionRuns.source, desc(collectionRuns.time));

  const lastSuccessMap = new Map<string, Date>();
  for (const r of rows) lastSuccessMap.set(r.source, r.time);

  const staleCutoff = new Date(now.getTime() - MAX_STALENESS_MS);

  for (const source of sources) {
    const lastSuccess = lastSuccessMap.get(source) ?? null;
    if (lastSuccess && lastSuccess > staleCutoff) {
      result.set(source, {
        startISO: new Date(lastSuccess.getTime() - overlapMs).toISOString(),
        reason: 'source-last-success',
        lastSuccessAt: lastSuccess,
      });
    } else {
      result.set(source, {
        startISO: staleCutoff.toISOString(),
        reason: lastSuccess ? 'stale-fallback' : 'first-run',
        lastSuccessAt: lastSuccess,
      });
    }
  }

  return result;
}
