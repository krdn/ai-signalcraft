import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { manipulationAlertsRouter } from '../manipulation-alerts';

const verifySubscriptionOwnership = vi.fn();
const dbSelect = vi.fn();
const dbInsert = vi.fn();
const dbUpdate = vi.fn();
const dbDelete = vi.fn();

vi.mock('../../../auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock('next-auth', () => ({ default: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockReturnValue({ get: vi.fn() }) }));
vi.mock('../../shared/verify-subscription-ownership', () => ({
  verifySubscriptionOwnership: (...args: unknown[]) => verifySubscriptionOwnership(...args),
}));
vi.mock('@ai-signalcraft/core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@ai-signalcraft/core');
  return {
    ...actual,
    getDb: () => ({
      select: (...args: unknown[]) => dbSelect(...args),
      insert: (...args: unknown[]) => dbInsert(...args),
      update: (...args: unknown[]) => dbUpdate(...args),
      delete: (...args: unknown[]) => dbDelete(...args),
    }),
  };
});

const ctx = {
  session: { user: { id: 'u1', role: 'admin' } },
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ teamId: 1, role: 'admin' }]) }),
      }),
    }),
  },
  userId: 'u1',
  teamId: 1,
} as never;

const slackChannel = {
  type: 'slack' as const,
  webhookUrl: 'https://hooks.slack.com/services/T0/B0/X',
};

describe('manipulationAlertsRouter', () => {
  beforeEach(() => {
    verifySubscriptionOwnership.mockReset();
    dbSelect.mockReset();
    dbInsert.mockReset();
    dbUpdate.mockReset();
    dbDelete.mockReset();
  });

  it('1. listBySubscription — 권한 거부는 throw 전파', async () => {
    verifySubscriptionOwnership.mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: '권한 없음' }),
    );
    await expect(
      manipulationAlertsRouter.createCaller(ctx).listBySubscription({ subscriptionId: 37 }),
    ).rejects.toThrow(/권한 없음/);
  });

  it('2. listBySubscription — 정상 조회', async () => {
    verifySubscriptionOwnership.mockResolvedValue(undefined);
    const rows = [{ id: 1, subscriptionId: 37, name: 'r1', enabled: true, scoreThreshold: 60 }];
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(rows) }) }),
    });
    const result = await manipulationAlertsRouter
      .createCaller(ctx)
      .listBySubscription({ subscriptionId: 37 });
    expect(result).toEqual(rows);
  });

  it('3. create — 정상 INSERT', async () => {
    verifySubscriptionOwnership.mockResolvedValue(undefined);
    const created = { id: 1, subscriptionId: 37, name: '기본', scoreThreshold: 60 };
    dbInsert.mockReturnValue({
      values: () => ({ returning: () => Promise.resolve([created]) }),
    });
    const result = await manipulationAlertsRouter.createCaller(ctx).create({
      subscriptionId: 37,
      name: '기본',
      scoreThreshold: 60,
      cooldownMinutes: 360,
      enabled: true,
      channel: slackChannel,
    });
    expect(result).toEqual(created);
  });

  it('4. create — Slack URL 도메인 위반 시 Zod throw', async () => {
    await expect(
      manipulationAlertsRouter.createCaller(ctx).create({
        subscriptionId: 37,
        name: '나쁜 규칙',
        scoreThreshold: 60,
        cooldownMinutes: 360,
        enabled: true,
        channel: { type: 'slack', webhookUrl: 'https://example.com/hook' },
      }),
    ).rejects.toThrow();
    expect(verifySubscriptionOwnership).not.toHaveBeenCalled();
  });

  it('5. update — rule 권한 거부 전파', async () => {
    dbSelect.mockReturnValue({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ subscriptionId: 99 }]) }),
      }),
    });
    verifySubscriptionOwnership.mockRejectedValue(
      new TRPCError({ code: 'FORBIDDEN', message: '권한 없음' }),
    );

    await expect(
      manipulationAlertsRouter.createCaller(ctx).update({
        ruleId: 1,
        patch: { scoreThreshold: 80 },
      }),
    ).rejects.toThrow(/권한 없음/);
    expect(dbUpdate).not.toHaveBeenCalled();
  });
});
