import { z } from 'zod';
import { eq, and, sql, desc, count, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  users,
  teams,
  teamMembers,
  collectionJobs,
  demoQuotas,
  cancelPipeline,
  getUsageSummary,
  getUsageByTeam,
  getUsageByModule,
  getUsageTrend,
} from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../init';

// ─── 사용자 관리 ───
const usersRouter = router({
  // 전체 사용자 목록 (페이지네이션 + 필터)
  list: systemAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
        role: z.enum(['admin', 'leader', 'sales', 'partner', 'member', 'demo']).optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];

      if (input.role) conditions.push(eq(users.role, input.role));
      if (input.isActive !== undefined) conditions.push(eq(users.isActive, input.isActive));
      if (input.search) {
        conditions.push(
          sql`(${users.name} ILIKE ${'%' + input.search + '%'} OR ${users.email} ILIKE ${'%' + input.search + '%'})`,
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            isActive: users.isActive,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(where)
          .orderBy(desc(users.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(users).where(where),
      ]);

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),

  // 사용자 역할 변경
  updateRole: systemAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['admin', 'leader', 'sales', 'partner', 'member', 'demo']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 자기 자신의 admin 역할 제거 방지
      if (input.userId === ctx.session.user?.id && input.role !== 'admin') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자신의 관리자 역할을 제거할 수 없습니다',
        });
      }

      const [updated] = await ctx.db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  // 사용자 활성화/비활성화
  toggleActive: systemAdminProcedure
    .input(z.object({ userId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      // 자기 자신 비활성화 방지
      if (input.userId === ctx.session.user?.id && !input.isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '자신의 계정을 비활성화할 수 없습니다',
        });
      }

      const [updated] = await ctx.db
        .update(users)
        .set({ isActive: input.isActive })
        .where(eq(users.id, input.userId))
        .returning({ id: users.id });

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),
});

// ─── 팀 관리 ───
const teamsRouter = router({
  // 전체 팀 목록
  list: systemAdminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: teams.id,
        name: teams.name,
        createdAt: teams.createdAt,
        memberCount: sql<number>`(SELECT COUNT(*) FROM team_members WHERE team_id = ${teams.id})`,
      })
      .from(teams)
      .orderBy(desc(teams.createdAt));

    return result;
  }),

  // 팀 상세 (멤버 + 사용량)
  getDetail: systemAdminProcedure
    .input(z.object({ teamId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [team] = await ctx.db.select().from(teams).where(eq(teams.id, input.teamId)).limit(1);

      if (!team) throw new TRPCError({ code: 'NOT_FOUND' });

      const members = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
        })
        .from(teamMembers)
        .innerJoin(users, eq(users.id, teamMembers.userId))
        .where(eq(teamMembers.teamId, input.teamId));

      const [jobStats] = await ctx.db
        .select({
          totalJobs: count(),
          completedJobs: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'completed')`,
        })
        .from(collectionJobs)
        .where(eq(collectionJobs.teamId, input.teamId));

      return { team, members, jobStats };
    }),
});

// ─── 작업 모니터링 ───
const jobsRouter = router({
  // 전체 작업 목록
  listAll: systemAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
        status: z
          .enum([
            'pending',
            'running',
            'completed',
            'partial_failure',
            'failed',
            'cancelled',
            'paused',
          ])
          .optional(),
        teamId: z.number().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];
      if (input.status) conditions.push(eq(collectionJobs.status, input.status));
      if (input.teamId) conditions.push(eq(collectionJobs.teamId, input.teamId));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: collectionJobs.id,
            teamId: collectionJobs.teamId,
            keyword: collectionJobs.keyword,
            status: collectionJobs.status,
            startDate: collectionJobs.startDate,
            endDate: collectionJobs.endDate,
            costLimitUsd: collectionJobs.costLimitUsd,
            createdAt: collectionJobs.createdAt,
          })
          .from(collectionJobs)
          .where(where)
          .orderBy(desc(collectionJobs.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(collectionJobs).where(where),
      ]);

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),

  // 상태별 집계
  summary: systemAdminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        status: collectionJobs.status,
        count: count(),
      })
      .from(collectionJobs)
      .groupBy(collectionJobs.status);

    return result;
  }),

  // 강제 취소
  forceCancel: systemAdminProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      return cancelPipeline(input.jobId);
    }),
});

// ─── 사용량/비용 ───
const usageRouter = router({
  summary: systemAdminProcedure
    .input(
      z.object({
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)),
      }),
    )
    .query(async ({ input }) => {
      return getUsageSummary(input.startDate, input.endDate);
    }),

  byTeam: systemAdminProcedure
    .input(
      z.object({
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)),
      }),
    )
    .query(async ({ input }) => {
      return getUsageByTeam(input.startDate, input.endDate);
    }),

  byModule: systemAdminProcedure
    .input(
      z.object({
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)),
      }),
    )
    .query(async ({ input }) => {
      return getUsageByModule(input.startDate, input.endDate);
    }),

  trend: systemAdminProcedure
    .input(
      z.object({
        startDate: z.string().transform((s) => new Date(s)),
        endDate: z.string().transform((s) => new Date(s)),
      }),
    )
    .query(async ({ input }) => {
      return getUsageTrend(input.startDate, input.endDate);
    }),
});

// ─── 오버뷰 KPI ───
const overviewRouter = router({
  stats: systemAdminProcedure.query(async ({ ctx }) => {
    const [[userStats], [teamStats], [jobStats], [demoStats]] = await Promise.all([
      ctx.db
        .select({
          total: count(),
          active: sql<number>`COUNT(*) FILTER (WHERE ${users.isActive} = true)`,
          admins: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'admin')`,
          leaders: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'leader')`,
          sales: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'sales')`,
          partners: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'partner')`,
          members: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'member')`,
          demos: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'demo')`,
        })
        .from(users),
      ctx.db.select({ total: count() }).from(teams),
      ctx.db
        .select({
          total: count(),
          running: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'running')`,
          completed: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'completed')`,
          failed: sql<number>`COUNT(*) FILTER (WHERE ${collectionJobs.status} = 'failed')`,
        })
        .from(collectionJobs),
      ctx.db
        .select({
          total: count(),
          converted: sql<number>`COUNT(*) FILTER (WHERE ${demoQuotas.totalUsed} > 0)`,
        })
        .from(demoQuotas),
    ]);

    // 이번 달 비용
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyCost = await getUsageSummary(monthStart, now);
    const totalMonthlyCost = monthlyCost.reduce((sum, r) => sum + r.estimatedCostUsd, 0);

    return {
      users: userStats,
      teams: { total: teamStats.total },
      jobs: jobStats,
      demo: demoStats,
      monthlyCost: Math.round(totalMonthlyCost * 100) / 100,
    };
  }),
});

// ─── 데모 관리 ───
const demoRouter = router({
  // 데모 사용자 목록 + 쿼터 현황
  list: systemAdminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        userId: demoQuotas.userId,
        userName: users.name,
        userEmail: users.email,
        dailyLimit: demoQuotas.dailyLimit,
        todayUsed: demoQuotas.todayUsed,
        todayDate: demoQuotas.todayDate,
        totalUsed: demoQuotas.totalUsed,
        expiresAt: demoQuotas.expiresAt,
        createdAt: demoQuotas.createdAt,
      })
      .from(demoQuotas)
      .innerJoin(users, eq(users.id, demoQuotas.userId))
      .orderBy(desc(demoQuotas.createdAt));

    return result;
  }),

  // 쿼터 설정 변경 (관리자가 기간/횟수 조정)
  updateQuota: systemAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        dailyLimit: z.number().min(1).max(50).optional(),
        extendDays: z.number().min(1).max(90).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [quota] = await ctx.db
        .select()
        .from(demoQuotas)
        .where(eq(demoQuotas.userId, input.userId))
        .limit(1);

      if (!quota) throw new TRPCError({ code: 'NOT_FOUND' });

      const updates: Record<string, unknown> = {};
      if (input.dailyLimit !== undefined) updates.dailyLimit = input.dailyLimit;
      if (input.extendDays !== undefined) {
        updates.expiresAt = new Date(
          Math.max(quota.expiresAt.getTime(), Date.now()) + input.extendDays * 24 * 60 * 60 * 1000,
        );
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.update(demoQuotas).set(updates).where(eq(demoQuotas.userId, input.userId));
      }

      return { success: true };
    }),

  // 쿼터 리셋 (오늘 사용량 초기화 + 기간 재설정)
  resetQuota: systemAdminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(demoQuotas)
        .set({
          todayUsed: 0,
          todayDate: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .where(eq(demoQuotas.userId, input.userId));

      return { success: true };
    }),

  // 만료된 데모 계정 정리
  cleanupExpired: systemAdminProcedure.mutation(async ({ ctx }) => {
    const expired = await ctx.db
      .select({ userId: demoQuotas.userId })
      .from(demoQuotas)
      .innerJoin(users, eq(users.id, demoQuotas.userId))
      .where(and(lte(demoQuotas.expiresAt, new Date()), eq(users.role, 'demo')));

    if (expired.length > 0) {
      const userIds = expired.map((e) => e.userId);
      await ctx.db
        .update(users)
        .set({ isActive: false })
        .where(sql`${users.id} = ANY(${userIds})`);
    }

    return { cleaned: expired.length };
  }),

  // 전환 통계
  conversionRate: systemAdminProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.db
      .select({
        totalDemos: count(),
        usedAtLeastOnce: sql<number>`COUNT(*) FILTER (WHERE ${demoQuotas.totalUsed} > 0)`,
      })
      .from(demoQuotas);

    const [converted] = await ctx.db
      .select({ count: count() })
      .from(demoQuotas)
      .innerJoin(users, eq(users.id, demoQuotas.userId))
      .where(eq(users.role, 'member'));

    return {
      totalDemos: stats.totalDemos,
      usedAtLeastOnce: Number(stats.usedAtLeastOnce),
      converted: converted.count,
      conversionRate:
        stats.totalDemos > 0 ? Math.round((converted.count / stats.totalDemos) * 1000) / 10 : 0,
    };
  }),
});

// ─── 메인 어드민 라우터 ───
export const adminRouter = router({
  users: usersRouter,
  teams: teamsRouter,
  jobs: jobsRouter,
  usage: usageRouter,
  overview: overviewRouter,
  demo: demoRouter,
});
