// 좀비 running 행 finalize 통합 테스트
// 2026-06-11 사건 회귀 방지: BullMQ stalled 한도 초과 실패는 attemptsMade < attempts
// 상태에서도 terminal(UnrecoverableError, finishedOn 설정)인데, 기존 isLastAttempt
// 가드가 finalize를 건너뛰어 collection_runs가 영구 running으로 방치됐다 (run 2bbdb301).
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionRuns, keywordSubscriptions } from '../db/schema';
import { ensureRunningRun } from './executor';
import { finalizeTerminalFailedRun } from './worker-process';
import { recoverStaleRunningRuns } from './startup-recovery';

const SOURCE = 'dcinside';

describe('zombie running run finalize', () => {
  let subId: number;
  const runIds: string[] = [];

  beforeEach(async () => {
    const [sub] = await getDb()
      .insert(keywordSubscriptions)
      .values({
        keyword: 'zombie-finalize-test',
        sources: ['dcinside'],
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

  async function insertRunningRun(runId: string): Promise<void> {
    runIds.push(runId);
    await ensureRunningRun({
      runId,
      subscriptionId: subId,
      source: SOURCE,
      triggerType: 'manual' as const,
    });
  }

  async function getRun(runId: string) {
    const rows = await getDb()
      .select()
      .from(collectionRuns)
      .where(and(eq(collectionRuns.runId, runId), eq(collectionRuns.source, SOURCE)));
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  describe('finalizeTerminalFailedRun (worker.on failed 훅)', () => {
    it('stalled 한도 초과(terminal, attemptsMade < attempts)면 running 행을 failed로 마킹한다', async () => {
      const runId = randomUUID();
      await insertRunningRun(runId);

      // 사건 당시 잡 상태 재현: attempts 3 중 attemptsMade 2, finishedOn 설정(terminal)
      await finalizeTerminalFailedRun(
        SOURCE,
        { data: { runId }, attemptsMade: 2, finishedOn: Date.now() },
        new Error('job stalled more than allowable limit'),
      );

      const row = await getRun(runId);
      expect(row.status).toBe('failed');
      expect(row.errorReason).toContain('job stalled more than allowable limit');
    });

    it('재시도 예정 실패(finishedOn 미설정)면 행을 running으로 유지한다', async () => {
      const runId = randomUUID();
      await insertRunningRun(runId);

      await finalizeTerminalFailedRun(
        SOURCE,
        { data: { runId }, attemptsMade: 1 },
        new Error('Connection terminated due to connection timeout'),
      );

      const row = await getRun(runId);
      expect(row.status).toBe('running');
    });

    it('job이 undefined여도 throw하지 않는다', async () => {
      await expect(
        finalizeTerminalFailedRun(SOURCE, undefined, new Error('boom')),
      ).resolves.toBeUndefined();
    });
  });

  describe('recoverStaleRunningRuns (워커 기동 시 sweeper)', () => {
    it('임계(90분) 이상 무진행 running 행을 failed로 정리하고 건수를 반환한다', async () => {
      const runId = randomUUID();
      await insertRunningRun(runId);
      const staleTime = new Date(Date.now() - 91 * 60_000);
      await getDb()
        .update(collectionRuns)
        .set({ time: staleTime, lastProgressAt: staleTime })
        .where(eq(collectionRuns.runId, runId));

      const swept = await recoverStaleRunningRuns(90);

      expect(swept).toBeGreaterThanOrEqual(1);
      const row = await getRun(runId);
      expect(row.status).toBe('failed');
      expect(row.errorReason).toContain('stale');
    });

    it('임계 미만의 running 행은 건드리지 않는다', async () => {
      const runId = randomUUID();
      await insertRunningRun(runId);
      const recentTime = new Date(Date.now() - 30 * 60_000);
      await getDb()
        .update(collectionRuns)
        .set({ time: recentTime, lastProgressAt: recentTime })
        .where(eq(collectionRuns.runId, runId));

      await recoverStaleRunningRuns(90);

      const row = await getRun(runId);
      expect(row.status).toBe('running');
    });

    it('이미 finalize된 행은 건드리지 않는다', async () => {
      const runId = randomUUID();
      await insertRunningRun(runId);
      const staleTime = new Date(Date.now() - 120 * 60_000);
      await getDb()
        .update(collectionRuns)
        .set({ time: staleTime, lastProgressAt: staleTime, status: 'completed' })
        .where(eq(collectionRuns.runId, runId));

      await recoverStaleRunningRuns(90);

      const row = await getRun(runId);
      expect(row.status).toBe('completed');
    });
  });
});
