import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions, rawItems } from '../db/schema';
import { collectLayerA } from './collect-run';

describe('collectLayerA', () => {
  let subId: number;
  const runId = randomUUID();
  const SOURCE = 'naver-news';

  beforeEach(async () => {
    const [sub] = await getDb()
      .insert(keywordSubscriptions)
      .values({
        keyword: 'layer-a-test',
        sources: [SOURCE],
        intervalHours: 6,
        limits: { maxPerRun: 10 },
      })
      .returning();
    subId = sub.id;
    await getDb().insert(collectionRuns).values({
      time: new Date(),
      runId,
      subscriptionId: subId,
      source: SOURCE,
      status: 'running',
      triggerType: 'manual',
    });
  });

  afterEach(async () => {
    await getDb().delete(rawItems).where(eq(rawItems.fetchedFromRun, runId));
    await getDb().delete(collectionRuns).where(eq(collectionRuns.runId, runId));
    await getDb().delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, subId));
  });

  it('필수 필드를 모두 채운다', async () => {
    const result = await collectLayerA(runId, SOURCE);
    expect(result.runId).toBe(runId);
    expect(result.source).toBe(SOURCE);
    expect(result.jobId).toBe(`${runId}-${SOURCE}`);
    expect(result.subscription?.keyword).toBe('layer-a-test');
    expect(result.partialRawItemsCount).toBe(0);
    expect(result.partialRawItemsByType).toEqual({ article: 0, video: 0, comment: 0 });
    expect(result.collectionRunsRow?.status).toBe('running');
  });

  it('raw_items count를 type별로 집계', async () => {
    await getDb()
      .insert(rawItems)
      .values([
        {
          time: new Date(),
          subscriptionId: subId,
          source: SOURCE,
          sourceId: 'a1',
          itemType: 'article',
          rawPayload: {},
          fetchedFromRun: runId,
        },
        {
          time: new Date(),
          subscriptionId: subId,
          source: SOURCE,
          sourceId: 'a2',
          itemType: 'article',
          rawPayload: {},
          fetchedFromRun: runId,
        },
      ]);
    const result = await collectLayerA(runId, SOURCE);
    expect(result.partialRawItemsCount).toBe(2);
    expect(result.partialRawItemsByType.article).toBe(2);
  });

  it('collection_runs row가 없으면 null 반환', async () => {
    const unknownRun = randomUUID();
    const result = await collectLayerA(unknownRun, SOURCE);
    expect(result.collectionRunsRow).toBeNull();
    expect(result.subscription).toBeNull();
  });

  it('지연 ≤ 500ms (성능 sanity)', async () => {
    const t0 = Date.now();
    await collectLayerA(runId, SOURCE);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
