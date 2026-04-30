import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { runCancellations } from '../db/schema';
import { checkCancellation, finalizeCancellationIfDone, CancelledError } from './cancellation';

const RUN_ID = '11111111-1111-1111-1111-111111111111';
const SOURCE = 'naver-news';

async function clearRow() {
  await getDb()
    .delete(runCancellations)
    .where(and(eq(runCancellations.runId, RUN_ID), eq(runCancellations.source, SOURCE)));
}

describe('checkCancellation', () => {
  beforeEach(clearRow);
  afterEach(clearRow);

  it('row가 없으면 throw하지 않는다', async () => {
    await expect(checkCancellation(RUN_ID, SOURCE)).resolves.toBeUndefined();
  });

  it('status=cancelling이면 CancelledError throw', async () => {
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelling',
      mode: 'graceful',
      triggeredBy: 'test',
    });
    await expect(checkCancellation(RUN_ID, SOURCE)).rejects.toThrow(CancelledError);
  });

  it('status=cancelled여도 CancelledError throw', async () => {
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelled',
      mode: 'graceful',
      triggeredBy: 'test',
    });
    await expect(checkCancellation(RUN_ID, SOURCE)).rejects.toThrow(CancelledError);
  });
});

describe('finalizeCancellationIfDone', () => {
  beforeEach(clearRow);
  afterEach(clearRow);

  it('cancelling → cancelled로 전이', async () => {
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelling',
      mode: 'graceful',
      triggeredBy: 'test',
    });
    await finalizeCancellationIfDone(RUN_ID, SOURCE);
    const [row] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, RUN_ID), eq(runCancellations.source, SOURCE)));
    expect(row.status).toBe('cancelled');
    expect(row.finalizedAt).not.toBeNull();
  });

  it('이미 cancelled이면 no-op (finalizedAt 유지)', async () => {
    const t0 = new Date(Date.now() - 60_000);
    await getDb().insert(runCancellations).values({
      runId: RUN_ID,
      source: SOURCE,
      status: 'cancelled',
      mode: 'graceful',
      triggeredBy: 'test',
      finalizedAt: t0,
    });
    await finalizeCancellationIfDone(RUN_ID, SOURCE);
    const [row] = await getDb()
      .select()
      .from(runCancellations)
      .where(and(eq(runCancellations.runId, RUN_ID), eq(runCancellations.source, SOURCE)));
    expect(row.finalizedAt?.getTime()).toBe(t0.getTime());
  });

  it('row 없으면 no-op', async () => {
    await expect(finalizeCancellationIfDone(RUN_ID, SOURCE)).resolves.toBeUndefined();
  });
});
