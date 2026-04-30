// tRPC 라우터 단위 테스트용 공통 헬퍼.
//
// 두 가지 부담을 해결한다:
//   1. next-auth / next/headers / @ai-signalcraft/core 모킹 보일러플레이트
//      (라우터 import 시 Redis/DB 부작용을 차단)
//   2. ctx 빌더 + drizzle select chain mock — 매 테스트가 직접 만들면 노이즈가 큼.
//
// 사용 예:
//   import { setupTrpcTestEnv, makeProtectedCtx } from '../../__tests__/test-helpers';
//   setupTrpcTestEnv();
//   const ctx = makeProtectedCtx();
//   const caller = myRouter.createCaller(ctx);

import { vi } from 'vitest';

/**
 * 라우터 import 시 발생하는 외부 부작용 차단.
 * 각 테스트 파일 최상단에 한 번 호출.
 */
export function setupTrpcTestEnv(): void {
  vi.mock('../../../auth', () => ({
    auth: vi.fn().mockResolvedValue(null),
  }));
  vi.mock('next-auth', () => ({
    default: vi.fn(),
  }));
  vi.mock('next/headers', () => ({
    cookies: vi.fn().mockReturnValue({ get: vi.fn() }),
  }));
}

/**
 * protectedProcedure 미들웨어가 요구하는 ctx의 최소 형태.
 * session.user + ctx.db.select(...) 체인이 teamMembers 행을 반환해야 통과.
 */
export interface ProtectedCtxOptions {
  userId?: string;
  teamId?: number;
  role?: 'admin' | 'analyst' | 'viewer' | 'demo';
  /** ctx.db.select() 첫 호출이 반환하는 행 (teamMembers 조회용) */
  teamMembershipRow?: { teamId: number; role: string } | null;
}

export function makeProtectedCtx(options: ProtectedCtxOptions = {}) {
  const userId = options.userId ?? 'u1';
  const teamId = options.teamId ?? 1;
  const role = options.role ?? 'admin';
  // null과 undefined 구분: null은 명시적 빈 배열, undefined는 기본 admin 행
  const teamMembershipRow =
    'teamMembershipRow' in options ? options.teamMembershipRow : { teamId, role };

  // protectedProcedure 미들웨어가 ctx.db.select().from(teamMembers).where().limit() 형태로 조회.
  // 첫 select 호출만 teamMembers 조회로 가로챈다 (라우터 본문의 select는 별도 모킹 권장).
  const fakeDb = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(teamMembershipRow ? [teamMembershipRow] : []),
        }),
      }),
    }),
  };

  return {
    session: { user: { id: userId, role } },
    db: fakeDb,
    userId,
    teamId,
  } as never;
}

/**
 * drizzle select chain mock 빌더.
 *
 * ctx.db.select().from().where().limit() 같은 체이닝을 한 줄로 정의:
 *   const select = mockDbSelect([{ id: 1, name: 'a' }]);
 *
 * orderBy/groupBy/innerJoin/leftJoin 등 모든 chain method가 self를 반환하고,
 * 마지막에 await(then)될 때 rows를 resolve한다.
 */
export function mockDbSelect<T>(rows: T[]) {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;
  for (const method of [
    'from',
    'where',
    'limit',
    'orderBy',
    'groupBy',
    'innerJoin',
    'leftJoin',
    'rightJoin',
    'fullJoin',
    'as',
  ]) {
    chain[method] = passthrough;
  }
  chain.then = (resolve: (v: T[]) => unknown, reject?: (e: unknown) => unknown) => {
    try {
      return Promise.resolve(rows).then(resolve, reject);
    } catch (e) {
      return reject ? reject(e) : Promise.reject(e);
    }
  };
  return () => chain;
}
