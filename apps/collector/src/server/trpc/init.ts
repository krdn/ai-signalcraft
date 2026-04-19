import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { getDb } from '../../db';

export type CollectorContext = {
  db: ReturnType<typeof getDb>;
  apiKey: string | null;
  isAuthenticated: boolean;
};

/**
 * Fastify 어댑터용 tRPC context 생성기.
 * 내부 서비스 간 통신이므로 Authorization: Bearer <COLLECTOR_API_KEY> 검증.
 */
export const createCollectorContext = async ({
  req,
}: CreateFastifyContextOptions): Promise<CollectorContext> => {
  const header = req.headers['authorization'];
  const expected = process.env.COLLECTOR_API_KEY;

  let apiKey: string | null = null;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    apiKey = header.slice('Bearer '.length).trim();
  }

  const isAuthenticated = Boolean(expected) && apiKey === expected;

  return {
    db: getDb(),
    apiKey,
    isAuthenticated,
  };
};

const t = initTRPC.context<CollectorContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * 내부 서비스 간 호출 전용 — COLLECTOR_API_KEY 검증 통과 필수.
 * 운영 환경에서는 환경변수 누락 시 거부 (보안).
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!process.env.COLLECTOR_API_KEY) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'COLLECTOR_API_KEY 환경변수가 설정되지 않았습니다',
    });
  }
  if (!ctx.isAuthenticated) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '유효한 API 키가 필요합니다' });
  }
  return next({ ctx });
});
