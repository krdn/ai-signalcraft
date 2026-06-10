// ensureRunningRun 멱등성 통합 테스트
// 워커 강제 종료 후 startup-recovery 재실행 시 collection_runs에 같은
// (runId, source) running 행이 중복 INSERT되던 버그의 회귀 방지.
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions } from '../db/schema';
import { ensureRunningRun } from './executor';

const SOURCE = 'naver-comments';

describe('ensureRunningRun', () => {
  let subId: number;
  const runIds: string[] = [];

  beforeEach(async () => {
    const [sub] = await getDb()
      .insert(keywordSubscriptions)
      .values({
        keyword: 'run-row-idem-test',
        sources: ['naver-news'],
        intervalHours: 6,
        limits: { maxPerRun: 10 },
      })
      .returning();
    subId = sub.id;
  });

  afterEach(async () => {
    for (const rid of runIds) {
      await getDb().delete(collectionRuns).where(eq(collectionRuns.runId, rid));
    }
    runIds.length = 0;
    await getDb().delete(keywordSubscriptions).where(eq(keywordSubscriptions.id, subId));
  });

  it('running 행이 없으면 생성하고, 재호출(재실행 시뮬레이션) 시 재사용한다', async () => {
    const runId = randomUUID();
    runIds.push(runId);
    const params = { runId, subscriptionId: subId, source: SOURCE, triggerType: 'manual' as const };

    await ensureRunningRun(params);
    await ensureRunningRun(params); // startup-recovery 재실행 시뮬레이션

    const rows = await getDb().select().from(collectionRuns).where(eq(collectionRuns.runId, runId));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('running');
  });

  it('이전 행이 finalize된 뒤에는 새 running 행을 생성한다 (재시도 이력 보존)', async () => {
    const runId = randomUUID();
    runIds.push(runId);
    const params = { runId, subscriptionId: subId, source: SOURCE, triggerType: 'manual' as const };

    await ensureRunningRun(params);
    await getDb()
      .update(collectionRuns)
      .set({ status: 'failed' })
      .where(eq(collectionRuns.runId, runId));
    await ensureRunningRun(params);

    const rows = await getDb().select().from(collectionRuns).where(eq(collectionRuns.runId, runId));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'running')).toHaveLength(1);
  });
});
