import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const verifyJobOwnership = vi.fn();
const verifySubscriptionOwnership = vi.fn();
const dbSelect = vi.fn();

// next-auth / next 의존성 차단 — init.ts → auth.ts → next-auth → next/server 해결 불가 방지
vi.mock('../../../auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));
vi.mock('next-auth', () => ({
  default: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({ get: vi.fn() }),
}));

vi.mock('../../shared/verify-job-ownership', () => ({
  verifyJobOwnership: (...args: unknown[]) => verifyJobOwnership(...args),
}));
vi.mock('../../shared/verify-subscription-ownership', () => ({
  verifySubscriptionOwnership: (...args: unknown[]) => verifySubscriptionOwnership(...args),
}));
vi.mock('@ai-signalcraft/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@ai-signalcraft/core');
  return {
    ...actual,
    getDb: () => ({
      select: (...args: unknown[]) => dbSelect(...args),
    }),
  };
});

// protectedProcedure middleware: session.user が必要 + ctx.db.select から teamMembers を照会
const fakeCtxDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([{ teamId: 1, role: 'admin' }]),
      }),
    }),
  }),
};

const ctx = {
  session: { user: { id: 'u1', role: 'admin' } },
  db: fakeCtxDb,
  userId: 'u1',
  teamId: 1,
} as never;

describe('manipulationRouter', () => {
  beforeEach(() => {
    verifyJobOwnership.mockReset();
    verifySubscriptionOwnership.mockReset();
    dbSelect.mockReset();
  });

  it('getRunByJobId — 권한 거부는 verifyJobOwnership throw를 그대로 전파', async () => {
    verifyJobOwnership.mockRejectedValueOnce(
      new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' }),
    );
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    await expect(caller.getRunByJobId({ jobId: 999 })).rejects.toThrow('작업을 찾을 수 없습니다');
  });

  it('getRunByJobId — manipulation_runs 행 없으면 null', async () => {
    verifyJobOwnership.mockResolvedValueOnce(undefined);
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    });
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    const result = await caller.getRunByJobId({ jobId: 273 });
    expect(result).toBeNull();
  });

  it('getRunByJobId — 정상 흐름은 run + signals + evidence를 합쳐 반환', async () => {
    verifyJobOwnership.mockResolvedValueOnce(undefined);
    const run = { id: 'r1', jobId: 273, status: 'completed', manipulationScore: 57.2 };
    const signals = [{ id: 's1', signal: 'burst', score: 99 }];
    const evidence = [{ id: 'e1', signal: 'burst', rank: 1, severity: 'high' }];
    dbSelect
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ orderBy: () => ({ limit: () => Promise.resolve([run]) }) }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve(signals) }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({ orderBy: () => Promise.resolve(evidence) }),
        }),
      });
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    const result = await caller.getRunByJobId({ jobId: 273 });
    expect(result).toMatchObject({ id: 'r1', signals, evidence });
  });

  it('listRunsBySubscription — 권한 거부 throw 전파', async () => {
    verifySubscriptionOwnership.mockRejectedValueOnce(
      new TRPCError({ code: 'FORBIDDEN', message: '접근 거부' }),
    );
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    await expect(caller.listRunsBySubscription({ subscriptionId: 99, limit: 30 })).rejects.toThrow(
      '접근 거부',
    );
  });

  it('listRunsBySubscription — limit 적용, startedAt DESC 요약 반환', async () => {
    verifySubscriptionOwnership.mockResolvedValueOnce(undefined);
    const rows = [
      {
        id: 'r2',
        jobId: 280,
        manipulationScore: 60.1,
        confidenceFactor: 0.8,
        startedAt: new Date('2026-04-28'),
        status: 'completed',
      },
      {
        id: 'r1',
        jobId: 273,
        manipulationScore: 57.2,
        confidenceFactor: 0.84,
        startedAt: new Date('2026-04-26'),
        status: 'completed',
      },
    ];
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rows) }) }),
      }),
    });
    const { manipulationRouter } = await import('../manipulation');
    const caller = manipulationRouter.createCaller(ctx);
    const result = await caller.listRunsBySubscription({ subscriptionId: 37, limit: 30 });
    expect(result).toEqual(rows);
  });
});
