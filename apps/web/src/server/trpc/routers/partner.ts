import { z } from 'zod';
import { eq, and, sql, desc, count, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  partnerApplications,
  partnerContracts,
  partnerClients,
  commissions,
} from '@ai-signalcraft/core';
import { router, publicProcedure, protectedProcedure } from '../init';

// 파트너 역할 가드
function assertPartnerRole(role: string | undefined) {
  if (!role || !['partner', 'sales', 'admin'].includes(role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '파트너 권한이 필요합니다' });
  }
}

export const partnerRouter = router({
  // 공개: 파��너 신청
  submitApplication: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, '이름을 입력해주세요'),
        email: z.string().email('올바른 이메일을 입력해주세요'),
        phone: z.string().optional(),
        businessType: z.enum(['individual', 'corporation']),
        program: z.enum(['reseller', 'partner']),
        salesArea: z.string().optional(),
        introduction: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 이메일 중복 신청 확인 (pending 상태)
      const [existing] = await ctx.db
        .select()
        .from(partnerApplications)
        .where(
          and(
            eq(partnerApplications.email, input.email),
            eq(partnerApplications.status, 'pending'),
          ),
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: '이미 검토 중인 신청이 있습니다',
        });
      }

      await ctx.db.insert(partnerApplications).values(input);
      return { success: true };
    }),

  // 파트너 대시보드 KPI
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    assertPartnerRole(ctx.session.user.role);
    const partnerId = ctx.userId;
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    const [clientStats, monthlyCommission, totalCommission] = await Promise.all([
      ctx.db
        .select({
          total: count(),
          negotiating: sql<number>`count(*) filter (where ${partnerClients.status} = 'negotiating')`,
          contracted: sql<number>`count(*) filter (where ${partnerClients.status} = 'contracted')`,
        })
        .from(partnerClients)
        .where(eq(partnerClients.partnerId, partnerId)),
      ctx.db
        .select({ total: sum(commissions.commissionAmount) })
        .from(commissions)
        .where(
          and(eq(commissions.partnerId, partnerId), eq(commissions.periodMonth, currentMonth)),
        ),
      ctx.db
        .select({ total: sum(commissions.commissionAmount) })
        .from(commissions)
        .where(eq(commissions.partnerId, partnerId)),
    ]);

    return {
      totalClients: clientStats[0]?.total ?? 0,
      negotiatingClients: Number(clientStats[0]?.negotiating ?? 0),
      contractedClients: Number(clientStats[0]?.contracted ?? 0),
      monthlyCommission: Number(monthlyCommission[0]?.total ?? 0),
      totalCommission: Number(totalCommission[0]?.total ?? 0),
    };
  }),

  // 내 계약 조회
  myContract: protectedProcedure.query(async ({ ctx }) => {
    assertPartnerRole(ctx.session.user.role);
    const [contract] = await ctx.db
      .select()
      .from(partnerContracts)
      .where(and(eq(partnerContracts.partnerId, ctx.userId), eq(partnerContracts.status, 'active')))
      .limit(1);
    return contract ?? null;
  }),

  // 내 고객 목록
  myClients: router({
    list: protectedProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          pageSize: z.number().min(10).max(100).default(20),
          status: z.enum(['prospect', 'negotiating', 'contracted', 'churned']).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        assertPartnerRole(ctx.session.user.role);
        const conditions = [eq(partnerClients.partnerId, ctx.userId)];
        if (input.status) conditions.push(eq(partnerClients.status, input.status));

        const where = and(...conditions);
        const [items, [total]] = await Promise.all([
          ctx.db
            .select()
            .from(partnerClients)
            .where(where)
            .orderBy(desc(partnerClients.createdAt))
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
          ctx.db.select({ count: count() }).from(partnerClients).where(where),
        ]);

        return { items, total: total.count, page: input.page, pageSize: input.pageSize };
      }),

    add: protectedProcedure
      .input(
        z.object({
          clientName: z.string().min(1),
          clientEmail: z.string().email().optional(),
          clientCompany: z.string().optional(),
          planType: z.enum(['starter', 'professional', 'campaign']).optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        assertPartnerRole(ctx.session.user.role);
        await ctx.db.insert(partnerClients).values({
          ...input,
          partnerId: ctx.userId,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          clientName: z.string().min(1).optional(),
          clientEmail: z.string().email().optional(),
          clientCompany: z.string().optional(),
          planType: z.enum(['starter', 'professional', 'campaign']).optional(),
          status: z.enum(['prospect', 'negotiating', 'contracted', 'churned']).optional(),
          monthlyRevenue: z.number().min(0).optional(),
          contractedAt: z.string().datetime().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        assertPartnerRole(ctx.session.user.role);
        const { id, contractedAt, ...rest } = input;

        // 소유권 확인
        const [client] = await ctx.db
          .select()
          .from(partnerClients)
          .where(and(eq(partnerClients.id, id), eq(partnerClients.partnerId, ctx.userId)))
          .limit(1);

        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '고객을 찾을 수 없습니다' });
        }

        await ctx.db
          .update(partnerClients)
          .set({
            ...rest,
            ...(contractedAt ? { contractedAt: new Date(contractedAt) } : {}),
          })
          .where(eq(partnerClients.id, id));

        return { success: true };
      }),
  }),

  // 내 수수료 내역
  myCommissions: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      assertPartnerRole(ctx.session.user.role);
      const where = eq(commissions.partnerId, ctx.userId);

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: commissions.id,
            periodMonth: commissions.periodMonth,
            clientRevenue: commissions.clientRevenue,
            commissionRate: commissions.commissionRate,
            commissionAmount: commissions.commissionAmount,
            status: commissions.status,
            clientName: partnerClients.clientName,
            clientCompany: partnerClients.clientCompany,
          })
          .from(commissions)
          .leftJoin(partnerClients, eq(commissions.clientId, partnerClients.id))
          .where(where)
          .orderBy(desc(commissions.periodMonth))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(commissions).where(where),
      ]);

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),
});
