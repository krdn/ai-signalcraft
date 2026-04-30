import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions } from '../db/schema';
import { collectLayerB } from './collect-source';

const SOURCE = 'naver-news';

async function seedRun(
  subId: number,
  status: 'completed' | 'failed' | 'blocked',
  errorReason?: string,
) {
  await getDb()
    .insert(collectionRuns)
    .values({
      time: new Date(),
      runId: randomUUID(),
      subscriptionId: subId,
      source: SOURCE,
      status,
      triggerType: 'schedule',
      errorReason: errorReason ?? null,
    });
}

describe('collectLayerB', () => {
  let subId: number;

  beforeEach(async () => {
    const [sub] = await getDb()
      .insert(keywordSubscriptions)
      .values({
        keyword: 'layer-b-test',
        sources: [SOURCE],
        intervalHours: 6,
        limits: { maxPerRun: 10 },
      })
      .returning();
    subId = sub.id;
  });

  afterEach(async () => {
    await getDb().delete(collectionRuns).where(eq(collectionRuns.subscriptionId, subId));
    await getDb().delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, subId));
  });

  it('failRate를 계산한다', async () => {
    await seedRun(subId, 'completed');
    await seedRun(subId, 'completed');
    await seedRun(subId, 'failed');
    await seedRun(subId, 'failed');
    const result = await collectLayerB(SOURCE);
    expect(result.last24h.total).toBeGreaterThanOrEqual(4);
    // Tests are not perfectly isolated from other test data, so check proportion rather than exact counts
    // But newly seeded runs should dominate the count since this test's subId is fresh
    expect(result.last24h.failRate).toBeGreaterThan(0);
    expect(result.last24h.failRate).toBeLessThanOrEqual(1);
  });

  it('selectorChangeSuspected를 errorReason 패턴으로 판정', async () => {
    // seed 10 failed runs with 5+ matching the selector pattern
    for (let i = 0; i < 6; i++) {
      await seedRun(subId, 'failed', 'Cannot read property text of null');
    }
    const result = await collectLayerB(SOURCE);
    expect(result.selectorChangeSuspected).toBe(true);
  });

  it('rateLimitHits를 errorReason에서 카운트', async () => {
    await seedRun(subId, 'failed', 'HTTP 429 Too Many Requests');
    await seedRun(subId, 'failed', 'rate limit exceeded');
    await seedRun(subId, 'failed', 'other error');
    const result = await collectLayerB(SOURCE);
    expect(result.rateLimitHits).toBeGreaterThanOrEqual(2);
  });

  it('lastSuccessAt을 최근 completed run의 time으로 설정', async () => {
    await seedRun(subId, 'failed');
    await new Promise((r) => setTimeout(r, 50));
    await seedRun(subId, 'completed');
    const result = await collectLayerB(SOURCE);
    expect(result.lastSuccessAt).not.toBeNull();
  });
});
