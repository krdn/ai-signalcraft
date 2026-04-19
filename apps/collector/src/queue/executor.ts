import type { Job } from 'bullmq';
import { sql, eq } from 'drizzle-orm';
import { getCollector } from '@ai-signalcraft/collectors';
import { getDb } from '../db';
import { rawItems, collectionRuns, fetchErrors, keywordSubscriptions } from '../db/schema';
import { mapToRawItem } from './item-mapper';
import type { CollectionJobData, CollectionJobResult, CollectorSource } from './types';

/**
 * 주어진 source에 대한 collector 선택.
 *
 * 기존 packages/collectors는 registry 기반으로 source 문자열로 lookup.
 * comments는 별도 source이지만 논리적으로 같은 소스의 일부 — 여기서는 기사/영상만 수집하고
 * 댓글은 P3에서 별도 job으로 확장.
 */
function resolveCollector(source: CollectorSource) {
  const collector = getCollector(source);
  if (!collector) {
    throw new Error(`No collector registered for source: ${source}`);
  }
  return collector;
}

function itemTypeFor(source: CollectorSource): 'article' | 'video' | 'comment' {
  if (source === 'youtube') return 'video';
  return 'article';
}

/**
 * 하나의 수집 job 실행.
 *
 * 흐름:
 *   1) collection_runs 레코드 생성 (status=running)
 *   2) 기존 어댑터 collect() 호출 — AsyncGenerator로 청크 수신
 *   3) 각 청크를 raw_items 스키마로 매핑해 배치 삽입 (ON CONFLICT DO NOTHING)
 *   4) 종료 시 collection_runs 업데이트 + subscription의 lastRunAt/nextRunAt 갱신
 *   5) 실패 시 fetch_errors 기록 + subscription.lastError 업데이트
 */
export async function executeCollectionJob(
  job: Job<CollectionJobData>,
): Promise<CollectionJobResult> {
  const { runId, subscriptionId, source, keyword, limits, options, dateRange, triggerType } =
    job.data;
  const db = getDb();
  const startedAt = Date.now();

  await db.insert(collectionRuns).values({
    time: new Date(),
    runId,
    subscriptionId,
    source,
    status: 'running',
    triggerType,
  });

  let itemsCollected = 0;
  let itemsNew = 0;
  let blocked = false;

  try {
    const collector = resolveCollector(source);
    const itemType = itemTypeFor(source);

    const iter = collector.collect({
      keyword,
      startDate: dateRange.startISO,
      endDate: dateRange.endISO,
      maxItems: limits.maxPerRun,
      maxComments: limits.commentsPerItem,
      collectTranscript: options?.collectTranscript,
    });

    for await (const chunk of iter) {
      if (!Array.isArray(chunk) || chunk.length === 0) continue;
      itemsCollected += chunk.length;

      const rows = chunk.map((raw) =>
        mapToRawItem(raw as Record<string, unknown>, {
          subscriptionId,
          source,
          itemType,
          runId,
        }),
      );

      // TimescaleDB는 UNIQUE 제약이 시간 컬럼을 포함해야 하므로 애플리케이션 레벨에서
      // ON CONFLICT DO NOTHING 효과를 위해 dedup 인덱스를 활용.
      const result = await db
        .insert(rawItems)
        .values(rows)
        .onConflictDoNothing({
          target: [rawItems.source, rawItems.sourceId, rawItems.itemType, rawItems.time],
        })
        .returning({ insertedAt: rawItems.fetchedAt });

      itemsNew += result.length;

      await job.updateProgress({ itemsCollected, itemsNew });
    }

    const durationMs = Date.now() - startedAt;

    await db
      .update(collectionRuns)
      .set({
        status: 'completed',
        itemsCollected,
        itemsNew,
        blocked: false,
        durationMs,
      })
      .where(eq(collectionRuns.runId, runId));

    // subscription 상태 업데이트 (source 중 하나라도 완료되면 lastRunAt 갱신)
    const nextRunAt = await computeNextRunAt(subscriptionId);
    await db
      .update(keywordSubscriptions)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        status: 'active',
        lastError: null,
      })
      .where(eq(keywordSubscriptions.id, subscriptionId));

    return { runId, itemsCollected, itemsNew, blocked, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    blocked = /block|captcha|429|forbidden|rate.?limit/i.test(message);

    await db
      .update(collectionRuns)
      .set({
        status: blocked ? 'blocked' : 'failed',
        itemsCollected,
        itemsNew,
        blocked,
        errorReason: message.slice(0, 500),
        durationMs,
      })
      .where(eq(collectionRuns.runId, runId));

    await db.insert(fetchErrors).values({
      time: new Date(),
      subscriptionId,
      source,
      errorType: blocked ? 'blocked' : 'other',
      errorMessage: message.slice(0, 1000),
    });

    await db
      .update(keywordSubscriptions)
      .set({
        lastErrorAt: new Date(),
        lastError: message.slice(0, 500),
      })
      .where(eq(keywordSubscriptions.id, subscriptionId));

    throw err;
  }
}

/**
 * 다음 실행 시각 — subscription.intervalHours 기반.
 */
async function computeNextRunAt(subscriptionId: number): Promise<Date> {
  const db = getDb();
  const [row] = await db
    .select({ intervalHours: keywordSubscriptions.intervalHours })
    .from(keywordSubscriptions)
    .where(eq(keywordSubscriptions.id, subscriptionId))
    .limit(1);
  const hours = row?.intervalHours ?? 6;
  return new Date(Date.now() + hours * 3600 * 1000);
}

// sql import used implicitly by drizzle query builders above — suppress unused
void sql;
