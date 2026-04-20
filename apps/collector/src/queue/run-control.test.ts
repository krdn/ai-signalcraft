import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import {
  collectionRuns,
  keywordSubscriptions,
  runCancellations,
  runRetryLinks,
  runDiagnostics,
} from '../db/schema';
import { cancelRun, retryRun, cancelBySubscription } from './run-control';

const SOURCE = 'naver-news';

async function seed() {
  const [sub] = await getDb()
    .insert(keywordSubscriptions)
    .values({
      keyword: 'rc-test',
      sources: [SOURCE],
      intervalHours: 6,
      limits: { maxPerRun: 10 },
      lastRunAt: new Date(),
    })
    .returning();
  const runId = randomUUID();
  await getDb().insert(collectionRuns).values({
    time: new Date(),
    runId,
    subscriptionId: sub.id,
    source: SOURCE,
    status: 'running',
    triggerType: 'manual',
  });
  return { subId: sub.id, runId };
}

async function cleanup(subId: number, runIds: string[]) {
  await getDb().delete(runDiagnostics);
  await getDb().delete(runCancellations);
  await getDb().delete(runRetryLinks);
  for (const rid of runIds) {
    await getDb().delete(collectionRuns).where(eq(collectionRuns.runId, rid));
  }
  await getDb().delete(collectionRuns).where(eq(collectionRuns.subscriptionId, subId));
  await getDb().delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, subId));
}

describe('cancelRun', () => {
  let ctx: { subId: number; runId: string };
  const extraRunIds: string[] = [];
  beforeEach(async () => {
    extraRunIds.length = 0;
    ctx = await seed();
  });
  afterEach(async () => {
    await cleanup(ctx.subId, [ctx.runId, ...extraRunIds]);
  });

  it('status를 cancelling으로 기록하고 diagnostic을 생성', async () => {
    const res = await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    expect(res.diagnosticId).toBeTruthy();
    const [cancel] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, ctx.runId), eq(runCancellations.source, SOURCE)));
    expect(cancel.status).toBe('cancelling');
    expect(cancel.mode).toBe('graceful');
    const [diag] = await getDb()
      .select()
      .from(runDiagnostics)
      .where(eq(runDiagnostics.id, res.diagnosticId));
    expect(diag.triggeredBy).toBe('user_cancel');
    expect(diag.layerA).toBeTruthy();
  });

  it('중복 graceful 호출은 alreadyCancelling', async () => {
    await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    const res = await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    expect(res.alreadyCancelling).toBe(true);
  });

  it('graceful → force 승격은 허용', async () => {
    await cancelRun(ctx.runId, SOURCE, 'graceful', 'test');
    const res = await cancelRun(ctx.runId, SOURCE, 'force', 'test');
    expect(res.alreadyCancelling).toBeUndefined();
    const [cancel] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, ctx.runId), eq(runCancellations.source, SOURCE)));
    expect(cancel.mode).toBe('force');
  });
});

describe('retryRun', () => {
  let ctx: { subId: number; runId: string };
  const extraRunIds: string[] = [];
  beforeEach(async () => {
    extraRunIds.length = 0;
    ctx = await seed();
  });
  afterEach(async () => {
    await cleanup(ctx.subId, [ctx.runId, ...extraRunIds]);
  });

  it('새 runId를 발급하고 run_retry_links에 기록', async () => {
    const res = await retryRun(ctx.runId, SOURCE, 'test');
    extraRunIds.push(res.newRunId);
    expect(res.reused).toBe(false);
    expect(res.newRunId).not.toBe(ctx.runId);
    const [link] = await getDb()
      .select()
      .from(runRetryLinks)
      .where(eq(runRetryLinks.originalRunId, ctx.runId));
    expect(link.newRunId).toBe(res.newRunId);
  });

  it('중복 호출은 동일 newRunId 반환 (reused=true)', async () => {
    const first = await retryRun(ctx.runId, SOURCE, 'test');
    extraRunIds.push(first.newRunId);
    const second = await retryRun(ctx.runId, SOURCE, 'test');
    expect(second.newRunId).toBe(first.newRunId);
    expect(second.reused).toBe(true);
  });

  it('체인 3회 초과 시 거부', async () => {
    let current = ctx.runId;
    for (let i = 0; i < 3; i++) {
      const r = await retryRun(current, SOURCE, 'test');
      extraRunIds.push(r.newRunId);
      // chain depth 계산은 newRunId→originalRunId 역추적이므로 신규 run도 row가 있어야 함
      await getDb().insert(collectionRuns).values({
        time: new Date(),
        runId: r.newRunId,
        subscriptionId: ctx.subId,
        source: SOURCE,
        status: 'failed',
        triggerType: 'manual',
      });
      current = r.newRunId;
    }
    await expect(retryRun(current, SOURCE, 'test')).rejects.toThrow(/체인|exceed/i);
  });
});

describe('cancelBySubscription', () => {
  let ctx: { subId: number; runId: string };
  beforeEach(async () => {
    ctx = await seed();
  });
  afterEach(async () => {
    await cleanup(ctx.subId, [ctx.runId]);
  });

  it('해당 구독의 running run을 모두 cancelling으로 전이', async () => {
    const res = await cancelBySubscription(ctx.subId, 'graceful', 'test');
    expect(res.cancelled).toBeGreaterThanOrEqual(1);
    expect(res.runIds).toContain(ctx.runId);
  });
});
