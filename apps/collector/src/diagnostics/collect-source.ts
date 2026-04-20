import { and, desc, eq, gte } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns } from '../db/schema';
import type { LayerBPayload } from '../db/schema';

/**
 * Layer B — 소스 건강도 24h 집계. 비동기 (diagnostics 큐). 지연 민감도 낮음.
 *
 * selectorChangeSuspected: 최근 10건 실패 중 5건 이상이 selector 관련 패턴 매치.
 * rateLimitHits: errorReason에 429/rate limit/too many 패턴 매치 개수.
 */

// 주의: 이 정규식 패턴들은 fetch 실패 메시지 문자열에 대해 매우 보수적으로 설계됨.
// 실제 errorReason 샘플이 축적되면 튜닝 필요.
const SELECTOR_PATTERN = /selector|querySelector|Cannot read|text of null|is not a function/i;
const RATE_LIMIT_PATTERN = /429|rate[- ]?limit|too many/i;

const SELECTOR_SUSPECT_THRESHOLD = 5; // 최근 10건 실패 중 이 수치 이상이면 의심
const RECENT_FAIL_WINDOW = 10;

export async function collectLayerB(source: string): Promise<LayerBPayload> {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const rows = await db
    .select()
    .from(collectionRuns)
    .where(and(eq(collectionRuns.source, source), gte(collectionRuns.time, since)))
    .orderBy(desc(collectionRuns.time))
    .limit(500);

  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const blocked = rows.filter((r) => r.status === 'blocked').length;
  const failRate = total > 0 ? (failed + blocked) / total : 0;

  // consecutiveFailures — 최신부터 이어지는 실패 개수 (첫 성공에서 멈춤)
  let consecutiveFailures = 0;
  for (const r of rows) {
    if (r.status === 'failed' || r.status === 'blocked') consecutiveFailures++;
    else break;
  }

  // selectorChangeSuspected — 최근 RECENT_FAIL_WINDOW 실패 중 임계 이상 selector 패턴
  const recentFails = rows
    .filter((r) => r.status === 'failed' || r.status === 'blocked')
    .slice(0, RECENT_FAIL_WINDOW);
  const selectorHits = recentFails.filter(
    (r) => r.errorReason && SELECTOR_PATTERN.test(r.errorReason),
  ).length;
  const selectorChangeSuspected = selectorHits >= SELECTOR_SUSPECT_THRESHOLD;

  const rateLimitHits = rows.filter(
    (r) =>
      (r.status === 'failed' || r.status === 'blocked') &&
      r.errorReason &&
      RATE_LIMIT_PATTERN.test(r.errorReason),
  ).length;

  const lastSuccess = rows.find((r) => r.status === 'completed');

  return {
    source,
    last24h: { total, completed, failed, blocked, failRate },
    consecutiveFailures,
    selectorChangeSuspected,
    rateLimitHits,
    lastSuccessAt: lastSuccess?.time.toISOString() ?? null,
  };
}
