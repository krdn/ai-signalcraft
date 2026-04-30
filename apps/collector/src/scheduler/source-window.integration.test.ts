import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions } from '../db/schema';
import type { CollectorSource } from '../queue/types';
import { MAX_STALENESS_MS, computeSourceStart, computeSourceStartBatch } from './source-window';

async function seedRun(
  subId: number,
  source: CollectorSource,
  opts: {
    time: Date;
    status?: 'completed' | 'failed' | 'blocked';
    itemsCollected?: number;
  },
) {
  await getDb()
    .insert(collectionRuns)
    .values({
      time: opts.time,
      runId: randomUUID(),
      subscriptionId: subId,
      source,
      status: opts.status ?? 'completed',
      triggerType: 'schedule',
      itemsCollected: opts.itemsCollected ?? 0,
    });
}

describe('computeSourceStart / computeSourceStartBatch', () => {
  let subId: number;

  beforeEach(async () => {
    const [sub] = await getDb()
      .insert(keywordSubscriptions)
      .values({
        keyword: `source-window-test-${randomUUID().slice(0, 8)}`,
        sources: ['clien'],
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

  it('성공 run이 없으면 first-run — now-MAX_STALENESS 반환', async () => {
    const now = new Date('2026-04-21T01:00:00Z');
    const w = await computeSourceStart({
      subscriptionId: subId,
      source: 'clien',
      now,
      overlapMs: 3240_000,
    });
    expect(w.reason).toBe('first-run');
    expect(w.lastSuccessAt).toBeNull();
    expect(new Date(w.startISO).getTime()).toBe(now.getTime() - MAX_STALENESS_MS);
  });

  it('items=0 completed run만 있으면 first-run으로 간주 (영구 0건 방지)', async () => {
    const now = new Date('2026-04-21T01:00:00Z');
    // 최근 '성공처럼 보이는' run이지만 items=0 — 이걸 lastSuccess로 쓰면 원래 버그 재현됨
    await seedRun(subId, 'clien', {
      time: new Date(now.getTime() - 3600_000),
      status: 'completed',
      itemsCollected: 0,
    });
    const w = await computeSourceStart({
      subscriptionId: subId,
      source: 'clien',
      now,
      overlapMs: 3240_000,
    });
    expect(w.reason).toBe('first-run');
    expect(w.lastSuccessAt).toBeNull();
  });

  it('recent items>0 run이 있으면 source-last-success — overlap 적용', async () => {
    const now = new Date('2026-04-21T01:00:00Z');
    const lastSuccess = new Date(now.getTime() - 6 * 3600_000); // 6h 전
    await seedRun(subId, 'clien', {
      time: lastSuccess,
      status: 'completed',
      itemsCollected: 10,
    });
    const overlapMs = 3240_000;
    const w = await computeSourceStart({
      subscriptionId: subId,
      source: 'clien',
      now,
      overlapMs,
    });
    expect(w.reason).toBe('source-last-success');
    expect(w.lastSuccessAt).toEqual(lastSuccess);
    expect(new Date(w.startISO).getTime()).toBe(lastSuccess.getTime() - overlapMs);
  });

  it('items>0 run이 MAX_STALENESS보다 오래됐으면 stale-fallback', async () => {
    const now = new Date('2026-04-21T01:00:00Z');
    const tooOld = new Date(now.getTime() - MAX_STALENESS_MS - 3600_000); // 7일+1시간 전
    await seedRun(subId, 'clien', {
      time: tooOld,
      status: 'completed',
      itemsCollected: 10,
    });
    const w = await computeSourceStart({
      subscriptionId: subId,
      source: 'clien',
      now,
      overlapMs: 3240_000,
    });
    expect(w.reason).toBe('stale-fallback');
    expect(w.lastSuccessAt).toEqual(tooOld);
    expect(new Date(w.startISO).getTime()).toBe(now.getTime() - MAX_STALENESS_MS);
  });

  it('다른 source의 성공은 무관 (소스별 독립 계산)', async () => {
    const now = new Date('2026-04-21T01:00:00Z');
    await seedRun(subId, 'dcinside', {
      time: new Date(now.getTime() - 3600_000),
      status: 'completed',
      itemsCollected: 50,
    });
    const w = await computeSourceStart({
      subscriptionId: subId,
      source: 'clien',
      now,
      overlapMs: 3240_000,
    });
    expect(w.reason).toBe('first-run');
    expect(w.lastSuccessAt).toBeNull();
  });

  it('배치 — 여러 source를 한 번에 계산하며 각각 독립', async () => {
    const now = new Date('2026-04-21T01:00:00Z');
    // clien: 실패만 있음 → first-run
    await seedRun(subId, 'clien', {
      time: new Date(now.getTime() - 3600_000),
      status: 'completed',
      itemsCollected: 0,
    });
    // dcinside: 성공 있음 → source-last-success
    const dcSuccess = new Date(now.getTime() - 6 * 3600_000);
    await seedRun(subId, 'dcinside', {
      time: dcSuccess,
      status: 'completed',
      itemsCollected: 30,
    });
    const overlapMs = 3240_000;
    const map = await computeSourceStartBatch({
      subscriptionId: subId,
      sources: ['clien', 'dcinside', 'fmkorea'],
      now,
      overlapMs,
    });
    expect(map.get('clien')?.reason).toBe('first-run');
    expect(map.get('dcinside')?.reason).toBe('source-last-success');
    expect(new Date(map.get('dcinside')!.startISO).getTime()).toBe(dcSuccess.getTime() - overlapMs);
    expect(map.get('fmkorea')?.reason).toBe('first-run');
  });
});
