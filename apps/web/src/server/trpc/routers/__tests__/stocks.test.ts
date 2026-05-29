import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeProtectedCtx } from '../../__tests__/test-helpers';
import { stocksRouter } from '../stocks';

// vi.mock은 파일 최상단에서 호이스팅되어야 하므로 setupTrpcTestEnv() 대신 직접 정의
vi.mock('../../../auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock('next-auth', () => ({ default: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockReturnValue({ get: vi.fn() }) }));

const analyzeTickerMock = vi.fn();
vi.mock('@ai-signalcraft/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@ai-signalcraft/core');
  return {
    ...actual,
    analyzeTicker: (...a: unknown[]) => analyzeTickerMock(...a),
    getDb: () => ({}),
    redisConnection: {},
  };
});

function ctxWithInsert() {
  const ctx = makeProtectedCtx() as Record<string, unknown>;
  (ctx as { db: unknown }).db = {
    ...(ctx.db as object),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([{ id: 1 }]) }) }),
  };
  return ctx as never;
}

describe('stocksRouter.analyze', () => {
  beforeEach(() => {
    analyzeTickerMock.mockReset();
  });

  it('잘못된 티커 형식은 입력 검증에서 거부', async () => {
    const caller = stocksRouter.createCaller(ctxWithInsert());
    await expect(caller.analyze({ ticker: '123!@#', depth: 'lite' })).rejects.toThrow();
    expect(analyzeTickerMock).not.toHaveBeenCalled();
  });

  it('meta.completed===0이면 TRPCError로 전체 실패 처리', async () => {
    analyzeTickerMock.mockResolvedValue({
      ticker: 'AAPL',
      asOf: '2026-05-29T00:00:00Z',
      perspectives: {},
      meta: { completed: 0, failed: 12, durationMs: 100, depth: 'lite' },
    });
    const caller = stocksRouter.createCaller(ctxWithInsert());
    await expect(caller.analyze({ ticker: 'AAPL', depth: 'lite' })).rejects.toThrow();
  });

  it('부분 성공(completed>0)이면 DB 저장 후 결과 반환', async () => {
    analyzeTickerMock.mockResolvedValue({
      ticker: 'AAPL',
      asOf: '2026-05-29T00:00:00Z',
      perspectives: {},
      meta: { completed: 8, failed: 4, durationMs: 100, depth: 'lite', totalCostUsd: 0.12 },
    });
    const caller = stocksRouter.createCaller(ctxWithInsert());
    const res = await caller.analyze({ ticker: 'AAPL', depth: 'lite' });
    expect(res.ticker).toBe('AAPL');
    expect(analyzeTickerMock).toHaveBeenCalledWith('AAPL', { depth: 'lite' });
  });
});
