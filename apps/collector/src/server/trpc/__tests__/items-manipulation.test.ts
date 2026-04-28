import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMock = vi.fn();

vi.mock('../../../db', () => ({
  getDb: () => ({ execute: execMock }),
}));

const ctx = { db: { execute: execMock }, isAuthenticated: true };

describe('itemsManipulationRouter.fetchManipulationBaselines', () => {
  beforeEach(() => {
    execMock.mockReset();
    process.env.COLLECTOR_API_KEY = 'test-key';
  });

  it('byHour 객체로 시간대별 일별 카운트를 반환', async () => {
    execMock.mockResolvedValueOnce({
      rows: [
        { hour: 9, counts: [12, 14, 11, 13] },
        { hour: 14, counts: [80, 82, 79, 81] },
      ],
    });

    const { itemsManipulationRouter } = await import('../items-manipulation');
    const caller = itemsManipulationRouter.createCaller(ctx as never);
    const result = await caller.fetchManipulationBaselines({
      subscriptionId: 42,
      referenceEnd: new Date('2026-04-28T00:00:00Z').toISOString(),
      referenceStart: new Date('2026-04-21T00:00:00Z').toISOString(),
      days: 30,
    });

    expect(result.byHour).toEqual({
      '9': [12, 14, 11, 13],
      '14': [80, 82, 79, 81],
    });
  });

  it('빈 결과면 byHour는 빈 객체', async () => {
    execMock.mockResolvedValueOnce({ rows: [] });

    const { itemsManipulationRouter } = await import('../items-manipulation');
    const caller = itemsManipulationRouter.createCaller(ctx as never);
    const result = await caller.fetchManipulationBaselines({
      subscriptionId: 99,
      referenceEnd: new Date('2026-04-28T00:00:00Z').toISOString(),
      referenceStart: new Date('2026-04-21T00:00:00Z').toISOString(),
      days: 30,
    });

    expect(result.byHour).toEqual({});
  });

  it('subscriptionId, referenceStart, days를 SQL 바인딩에 전달', async () => {
    execMock.mockResolvedValueOnce({ rows: [] });

    const { itemsManipulationRouter } = await import('../items-manipulation');
    const caller = itemsManipulationRouter.createCaller(ctx as never);
    await caller.fetchManipulationBaselines({
      subscriptionId: 42,
      referenceEnd: new Date('2026-04-28T00:00:00Z').toISOString(),
      referenceStart: new Date('2026-04-21T00:00:00Z').toISOString(),
      days: 14,
    });

    expect(execMock).toHaveBeenCalledTimes(1);
    const sqlArg = execMock.mock.calls[0][0];
    const serialized = JSON.stringify(sqlArg);
    expect(serialized).toContain('42');
    expect(serialized).toContain('14');
    expect(serialized).toContain('2026-04-21');
  });
});
