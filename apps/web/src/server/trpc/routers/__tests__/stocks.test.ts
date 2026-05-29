import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeProtectedCtx, mockDbSelect } from '../../__tests__/test-helpers';
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

function makeInsertSpy() {
  return vi.fn(() => ({ values: () => ({ returning: () => Promise.resolve([{ id: 1 }]) }) }));
}

// insert 호출 여부를 검증할 수 있도록 spy로 감싼 ctx 빌더.
function ctxWithInsertSpy(insertSpy: ReturnType<typeof makeInsertSpy>) {
  const ctx = makeProtectedCtx() as Record<string, unknown>;
  (ctx as { db: unknown }).db = {
    ...(ctx.db as object),
    insert: insertSpy,
  };
  return ctx as never;
}

// select 체인이 주어진 rows를 반환하도록 모킹한 ctx 빌더 (list/getById용).
// 미들웨어의 첫 select(teamMembers 조회)는 기본 동작을 유지하고,
// 라우터 본문의 두 번째 select부터 mockDbSelect(rows)로 응답한다.
function ctxWithSelect<T>(rows: T[]) {
  const ctx = makeProtectedCtx() as Record<string, unknown>;
  const membershipSelect = (ctx.db as { select: (...a: unknown[]) => unknown }).select;
  const bodySelect = mockDbSelect(rows);
  let firstCall = true;
  (ctx as { db: unknown }).db = {
    select: (...args: unknown[]) => {
      if (firstCall) {
        firstCall = false;
        return membershipSelect(...args);
      }
      return bodySelect();
    },
  };
  return ctx as never;
}

describe('stocksRouter.analyze', () => {
  beforeEach(() => {
    analyzeTickerMock.mockReset();
  });

  it('잘못된 티커 형식은 입력 검증에서 거부', async () => {
    const caller = stocksRouter.createCaller(ctxWithInsertSpy(makeInsertSpy()));
    await expect(caller.analyze({ ticker: '123!@#', depth: 'lite' })).rejects.toThrow();
    expect(analyzeTickerMock).not.toHaveBeenCalled();
  });

  it('meta.completed===0이면 INTERNAL_SERVER_ERROR + DB insert 미호출', async () => {
    analyzeTickerMock.mockResolvedValue({
      ticker: 'AAPL',
      asOf: '2026-05-29T00:00:00Z',
      perspectives: {},
      meta: { completed: 0, failed: 12, durationMs: 100, depth: 'lite' },
    });
    const insertSpy = makeInsertSpy();
    const caller = stocksRouter.createCaller(ctxWithInsertSpy(insertSpy));
    await expect(caller.analyze({ ticker: 'AAPL', depth: 'lite' })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('부분 성공(completed>0)이면 DB 저장 후 결과 반환', async () => {
    analyzeTickerMock.mockResolvedValue({
      ticker: 'AAPL',
      asOf: '2026-05-29T00:00:00Z',
      perspectives: {},
      meta: { completed: 8, failed: 4, durationMs: 100, depth: 'lite', totalCostUsd: 0.12 },
    });
    const caller = stocksRouter.createCaller(ctxWithInsertSpy(makeInsertSpy()));
    const res = await caller.analyze({ ticker: 'AAPL', depth: 'lite' });
    expect(res.ticker).toBe('AAPL');
    expect(analyzeTickerMock).toHaveBeenCalledWith('AAPL', { depth: 'lite' });
  });
});

describe('stocksRouter.getById', () => {
  it('조회 결과 없으면 NOT_FOUND', async () => {
    const caller = stocksRouter.createCaller(ctxWithSelect([]));
    await expect(caller.getById({ id: 999 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('stocksRouter.list', () => {
  it('limit 지정 시 행 배열 반환', async () => {
    const rows = [
      {
        id: 2,
        ticker: 'TSLA',
        depth: 'lite',
        requestedBy: 'u1',
        asOf: new Date(),
        createdAt: new Date(),
      },
    ];
    const caller = stocksRouter.createCaller(ctxWithSelect(rows));
    const res = await caller.list({ limit: 5 });
    expect(res).toEqual(rows);
  });
});
