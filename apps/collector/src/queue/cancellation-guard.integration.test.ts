// isCancellationRequested 통합 테스트 — startup-recovery 재큐잉 가드의 핵심 조회.
// 취소된 run이 워커 재시작마다 재큐잉→즉시 취소 실패를 반복하던 루프의 회귀 방지.
import { randomUUID } from 'node:crypto';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { runCancellations } from '../db/schema';
import { isCancellationRequested } from './cancellation';

const SOURCE = 'naver-news';

describe('isCancellationRequested', () => {
  const runIds: string[] = [];

  afterEach(async () => {
    for (const rid of runIds) {
      await getDb().delete(runCancellations).where(eq(runCancellations.runId, rid));
    }
    runIds.length = 0;
  });

  it('취소 요청이 없으면 false', async () => {
    const runId = randomUUID();
    expect(await isCancellationRequested(runId, SOURCE)).toBe(false);
  });

  it('cancelling 상태면 true', async () => {
    const runId = randomUUID();
    runIds.push(runId);
    await getDb().insert(runCancellations).values({
      runId,
      source: SOURCE,
      status: 'cancelling',
      mode: 'force',
      triggeredBy: 'integration-test',
    });
    expect(await isCancellationRequested(runId, SOURCE)).toBe(true);
  });

  it('cancelled(최종) 상태면 true, 다른 source는 false', async () => {
    const runId = randomUUID();
    runIds.push(runId);
    await getDb().insert(runCancellations).values({
      runId,
      source: SOURCE,
      status: 'cancelled',
      mode: 'graceful',
      triggeredBy: 'integration-test',
      finalizedAt: new Date(),
    });
    expect(await isCancellationRequested(runId, SOURCE)).toBe(true);
    expect(await isCancellationRequested(runId, 'youtube')).toBe(false);
  });
});
