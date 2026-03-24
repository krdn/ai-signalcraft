import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '../auth';
import { db, teamMembers } from '@ai-signalcraft/core';
import { eq, and } from 'drizzle-orm';

export const createTRPCContext = async () => {
  const session = await auth();
  return { session, db };
};

const t = initTRPC
  .context<Awaited<ReturnType<typeof createTRPCContext>>>()
  .create();

export const router = t.router;
export const publicProcedure = t.procedure;

// 인증된 사용자 + 팀 정보 주입
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

  // 사용자의 팀 멤버십 조회
  const [membership] = await ctx.db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, ctx.session.user.id!))
    .limit(1);

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      teamId: membership?.teamId ?? null,
      teamRole: membership?.role ?? null,
    },
  });
});

// 관리자 전용 프로시저 -- 팀 Admin만 허용
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const [membership] = await ctx.db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, ctx.session.user.id!),
      ),
    )
    .limit(1);

  if (!membership || membership.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      teamId: membership.teamId,
      teamRole: membership.role as 'admin',
    },
  });
});
