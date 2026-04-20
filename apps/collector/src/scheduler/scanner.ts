import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { keywordSubscriptions } from '../db/schema';
import { enqueueCollectionJob } from '../queue/queues';
import { isSourcePaused } from '../queue/source-pause';
import type { CollectorSource } from '../queue/types';

const SCAN_INTERVAL_MS = 60_000;

// Rolling overlap window: 이전 실행 종료 시점에서 interval의 15% 만큼 겹치게 다시 검사해
// 늦게 인덱싱된 기사(publish와 검색결과 노출 사이의 지연)를 포착한다.
// raw_items UNIQUE(source, source_id, item_type, time)로 중복 저장은 자동 차단되므로
// 비용은 네트워크/파싱뿐이다.
const ROLLING_OVERLAP_RATIO = 0.15;

/**
 * 1분마다 실행:
 *   - status='active' AND (next_run_at IS NULL OR next_run_at <= now()) 조회
 *   - subscription.sources 각각에 대해 수집 job enqueue
 *   - runId는 subscription 단위로 발급 (동일 트리거 내 여러 source는 공유)
 *
 * 수집 범위:
 *   - startDate = lastRunAt - (intervalHours * ROLLING_OVERLAP_RATIO) — 늦게 노출되는 기사 재검증
 *   - endDate   = now
 *   - lastRunAt이 없으면 최초 실행이므로 intervalHours 이전부터 긁는다
 *
 * 동시 실행 방지:
 *   - next_run_at을 즉시 +intervalHours로 업데이트해 다음 틱에 중복 enqueue 되지 않게 함
 *   - 실제 실행은 worker에서 다시 갱신 (성공 시점 기준)
 */
export async function scanAndEnqueue(): Promise<number> {
  const db = getDb();
  const now = new Date();

  const due = await db
    .select()
    .from(keywordSubscriptions)
    .where(
      and(
        eq(keywordSubscriptions.status, 'active'),
        or(isNull(keywordSubscriptions.nextRunAt), lte(keywordSubscriptions.nextRunAt, now)),
      ),
    )
    .limit(50);

  if (due.length === 0) return 0;

  let enqueued = 0;

  for (const sub of due) {
    const runId = randomUUID();
    const intervalMs = sub.intervalHours * 3600 * 1000;
    const overlapMs = Math.floor(intervalMs * ROLLING_OVERLAP_RATIO);
    const nextRunAt = new Date(now.getTime() + intervalMs);
    const startISO = sub.lastRunAt
      ? new Date(sub.lastRunAt.getTime() - overlapMs).toISOString()
      : new Date(now.getTime() - intervalMs).toISOString();
    const endISO = now.toISOString();

    // 선점: 다음 next_run_at을 미리 잡아 중복 실행 방지
    await db
      .update(keywordSubscriptions)
      .set({ nextRunAt })
      .where(
        and(
          eq(keywordSubscriptions.id, sub.id),
          // 경합 방지: 다른 스캐너가 이미 바꿨다면 현재 값이 일치하지 않음
          sub.nextRunAt
            ? eq(keywordSubscriptions.nextRunAt, sub.nextRunAt)
            : sql`next_run_at IS NULL`,
        ),
      );

    for (const source of sub.sources as CollectorSource[]) {
      if (await isSourcePaused(source)) {
        console.warn(`[scanner] skip paused source=${source} subscription=${sub.id}`);
        continue;
      }
      await enqueueCollectionJob({
        runId,
        subscriptionId: sub.id,
        source,
        keyword: sub.keyword,
        limits: sub.limits,
        options: sub.options ?? undefined,
        dateRange: { startISO, endISO },
        triggerType: 'schedule',
        mode: 'incremental',
        windowDays: 1,
      });
      enqueued += 1;
    }
  }

  return enqueued;
}

let _timer: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  if (_timer) return;
  console.warn(`[scheduler] starting (interval=${SCAN_INTERVAL_MS}ms)`);
  const tick = async () => {
    try {
      const n = await scanAndEnqueue();
      if (n > 0) console.warn(`[scheduler] enqueued ${n} jobs`);
    } catch (err) {
      console.error('[scheduler] scan failed:', err);
    }
  };
  // 즉시 1회 + 주기 반복
  void tick();
  _timer = setInterval(() => void tick(), SCAN_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

async function main() {
  startScheduler();
  const shutdown = () => {
    console.warn('[scheduler] shutdown');
    stopScheduler();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[scheduler] fatal:', err);
    process.exit(1);
  });
}
