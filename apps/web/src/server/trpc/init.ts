import { initTRPC, TRPCError } from '@trpc/server';
import { db, teamMembers, users, affiliations } from '@ai-signalcraft/core';
import { eq, and, inArray } from 'drizzle-orm';
import { auth } from '../auth';

export const createTRPCContext = async () => {
  const session = await auth();
  return { session, db };
};

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// 역할 기반 기본 필터 모드 결정
export type FilterMode = 'mine' | 'team';

function getDefaultFilterMode(role?: string): FilterMode {
  return role === 'admin' || role === 'leader' ? 'team' : 'mine';
}

// 인증된 사용자 + 팀 정보 + 사용자 필터 모드 주입
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const userId = ctx.session.user.id!;
  const userRole = ctx.session.user.role as string | undefined;

  // 사용자의 팀 멤버십 조회
  const [membership] = await ctx.db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId,
      teamId: membership?.teamId ?? null,
      teamRole: membership?.role ?? null,
      defaultFilterMode: getDefaultFilterMode(userRole),
    },
  });
});

// 시스템 관리자 전용 프로시저 -- users.role === 'admin'
export const systemAdminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const userRole = ctx.session.user.role;
  if (userRole !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '시스템 관리자 권한이 필요합니다' });
  }
  return next({
    ctx: { ...ctx, session: ctx.session, isSystemAdmin: true as const },
  });
});

// 영업 전용 프로시저 -- admin + sales 역할만 허용
export const salesProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const role = ctx.session.user.role as string | undefined;
  if (!role || !['admin', 'sales'].includes(role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '영업 권한이 필요합니다' });
  }
  return next({
    ctx: { ...ctx, session: ctx.session, userId: ctx.session.user.id!, userRole: role },
  });
});

// =========================================================
// 🆕 신규 2축 권한 체계 Procedures (systemRole + affiliations)
// =========================================================
// 기존 procedure들은 레거시 role 기반으로 유지하고,
// 신규 기능은 아래 procedure들을 사용할 것.

/**
 * 사용자의 systemRole 조회 (캐시 없이 DB에서 최신값)
 */
async function loadSystemRole(
  db: typeof import('@ai-signalcraft/core').db,
  userId: string,
): Promise<'super_admin' | 'staff' | 'external'> {
  const [row] = await db
    .select({ systemRole: users.systemRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (row?.systemRole ?? 'external') as 'super_admin' | 'staff' | 'external';
}

/** 로그인한 사용자만 접근 허용 (신규 기본 procedure) */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  const userId = ctx.session.user.id!;
  const systemRole = await loadSystemRole(ctx.db, userId);
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId,
      systemRole,
    },
  });
});

/** 시스템 최고 관리자 (systemRole='super_admin') */
export const superAdminProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (ctx.systemRole !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '시스템 관리자 권한이 필요합니다' });
  }
  return next({ ctx });
});

/** 내부 직원 (systemRole='staff' or 'super_admin') — CRM/영업 사용 */
export const staffProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (ctx.systemRole !== 'staff' && ctx.systemRole !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '내부 직원 권한이 필요합니다' });
  }
  return next({ ctx });
});

/**
 * 파트너 (channel_partner 또는 referral_partner affiliation 보유)
 * super_admin도 접근 가능
 */
export const partnerProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (ctx.systemRole === 'super_admin') {
    return next({ ctx: { ...ctx, partnerAffiliation: null } });
  }
  const [aff] = await ctx.db
    .select()
    .from(affiliations)
    .where(
      and(
        eq(affiliations.userId, ctx.userId),
        inArray(affiliations.type, ['channel_partner', 'referral_partner']),
        eq(affiliations.isActive, true),
      ),
    )
    .limit(1);
  if (!aff) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '파트너 권한이 필요합니다' });
  }
  return next({ ctx: { ...ctx, partnerAffiliation: aff } });
});

/**
 * 고객사 멤버 (customer_member affiliation 보유)
 * super_admin 및 staff도 접근 가능 (지원 목적)
 */
export const customerMemberProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (ctx.systemRole === 'super_admin' || ctx.systemRole === 'staff') {
    return next({ ctx: { ...ctx, customerAffiliation: null } });
  }
  const [aff] = await ctx.db
    .select()
    .from(affiliations)
    .where(
      and(
        eq(affiliations.userId, ctx.userId),
        eq(affiliations.type, 'customer_member'),
        eq(affiliations.isActive, true),
      ),
    )
    .limit(1);
  if (!aff) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '고객사 멤버 권한이 필요합니다' });
  }
  return next({ ctx: { ...ctx, customerAffiliation: aff } });
});

// =========================================================
// 레거시 procedure (기존 role 기반) — Phase 6에서 제거 예정
// =========================================================

// 팀 관리자 전용 프로시저 -- 팀 Admin만 허용
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const userId = ctx.session.user.id!;
  const userRole = ctx.session.user.role as string | undefined;

  const [membership] = await ctx.db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId)))
    .limit(1);

  if (!membership || membership.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId,
      teamId: membership.teamId,
      teamRole: membership.role as 'admin',
      defaultFilterMode: getDefaultFilterMode(userRole),
    },
  });
});
