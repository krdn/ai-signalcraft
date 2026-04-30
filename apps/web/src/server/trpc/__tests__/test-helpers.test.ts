// 테스트 헬퍼 자체 검증 — 추후 헬퍼 리팩토링 시 회귀 방지.
import { describe, it, expect } from 'vitest';
import { makeProtectedCtx, mockDbSelect } from './test-helpers';

describe('makeProtectedCtx', () => {
  it('기본값으로 admin/team 1 ctx 생성', () => {
    const ctx = makeProtectedCtx() as {
      session: { user: { id: string; role: string } };
      userId: string;
      teamId: number;
    };
    expect(ctx.session.user.id).toBe('u1');
    expect(ctx.session.user.role).toBe('admin');
    expect(ctx.userId).toBe('u1');
    expect(ctx.teamId).toBe(1);
  });

  it('options로 userId/teamId/role 오버라이드', () => {
    const ctx = makeProtectedCtx({
      userId: 'alice',
      teamId: 42,
      role: 'analyst',
    }) as {
      session: { user: { id: string; role: string } };
      userId: string;
      teamId: number;
    };
    expect(ctx.userId).toBe('alice');
    expect(ctx.teamId).toBe(42);
    expect(ctx.session.user.role).toBe('analyst');
  });

  it('teamMembershipRow=null이면 빈 배열 반환 (권한 거부 시뮬레이션)', async () => {
    const ctx = makeProtectedCtx({ teamMembershipRow: null }) as {
      db: {
        select: () => {
          from: () => { where: () => { limit: () => Promise<unknown[]> } };
        };
      };
    };
    const rows = await ctx.db.select().from().where().limit();
    expect(rows).toEqual([]);
  });
});

describe('mockDbSelect', () => {
  it('chain method가 self를 반환하고 await 시 rows를 resolve', async () => {
    const select = mockDbSelect([{ id: 1 }, { id: 2 }]);
    const rows = await select().from().where().limit();
    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('orderBy/groupBy/innerJoin 등 모든 chain method 지원', async () => {
    const select = mockDbSelect([{ count: 5 }]);
    const rows = await select().from().innerJoin().leftJoin().where().groupBy().orderBy().limit();
    expect(rows).toEqual([{ count: 5 }]);
  });

  it('빈 배열도 정상 처리', async () => {
    const select = mockDbSelect<{ id: number }>([]);
    const rows = await select().from().where().limit();
    expect(rows).toEqual([]);
  });
});
