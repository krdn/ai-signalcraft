import { z } from 'zod';
import { eq, and, sql, desc, count, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { users, partnerApplications, partnerContracts, commissions } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

export const adminPartnersRouter = router({
  // 신청 관리
  applications: router({
    list: systemAdminProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          pageSize: z.number().min(10).max(100).default(20),
          status: z.enum(['pending', 'approved', 'rejected']).optional(),
        }),
      )
      .query(async ({ input, ctx }) => {
        const conditions = [];
        if (input.status) conditions.push(eq(partnerApplications.status, input.status));
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const [items, [total]] = await Promise.all([
          ctx.db
            .select()
            .from(partnerApplications)
            .where(where)
            .orderBy(
              sql`case when ${partnerApplications.status} = 'pending' then 0 else 1 end`,
              desc(partnerApplications.createdAt),
            )
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
          ctx.db.select({ count: count() }).from(partnerApplications).where(where),
        ]);

        return { items, total: total.count, page: input.page, pageSize: input.pageSize };
      }),

    review: systemAdminProcedure
      .input(
        z.object({
          applicationId: z.string(),
          action: z.enum(['approved', 'rejected']),
          reviewNote: z.string().optional(),
          commissionRate: z.number().min(1).max(50).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const [application] = await ctx.db
          .select()
          .from(partnerApplications)
          .where(eq(partnerApplications.id, input.applicationId))
          .limit(1);

        if (!application) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '신청을 찾을 수 없습니다' });
        }
        if (application.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '이미 처리된 신청입니다' });
        }

        const adminId = ctx.session.user.id ?? '';

        // 신청 상태 업데이트
        await ctx.db
          .update(partnerApplications)
          .set({
            status: input.action,
            reviewedBy: adminId,
            reviewNote: input.reviewNote,
            reviewedAt: new Date(),
          })
          .where(eq(partnerApplications.id, input.applicationId));

        // 승인 시: 사용자 role 변경 + 계약 생성
        if (input.action === 'approved') {
          const role = application.program === 'reseller' ? 'sales' : 'partner';
          const defaultRate = application.program === 'reseller' ? 15 : 30;
          const rate = input.commissionRate ?? defaultRate;

          // 기존 사용자 확인
          const [existingUser] = await ctx.db
            .select()
            .from(users)
            .where(eq(users.email, application.email))
            .limit(1);

          let partnerId: string;

          if (existingUser) {
            // 기존 사용자의 역할 변경
            await ctx.db.update(users).set({ role }).where(eq(users.id, existingUser.id));
            partnerId = existingUser.id;
          } else {
            // 새 사용자 생성 (비밀번호 없이 — 추후 설정 필요)
            const newId = crypto.randomUUID();
            await ctx.db.insert(users).values({
              id: newId,
              name: application.name,
              email: application.email,
              role,
              emailVerified: new Date(),
            });
            partnerId = newId;
          }

          // 계약 생성
          await ctx.db.insert(partnerContracts).values({
            partnerId,
            programType: application.program,
            commissionRate: rate,
          });
        }

        return { success: true };
      }),
  }),

  // 활성 파트너 목록
  list: systemAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(10).max(100).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const where = sql`${users.role} in ('partner', 'sales')`;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
            contractId: partnerContracts.id,
            programType: partnerContracts.programType,
            commissionRate: partnerContracts.commissionRate,
            contractStatus: partnerContracts.status,
          })
          .from(users)
          .leftJoin(
            partnerContracts,
            and(eq(partnerContracts.partnerId, users.id), eq(partnerContracts.status, 'active')),
          )
          .where(where)
          .orderBy(desc(users.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(users).where(where),
      ]);

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),

  // 관리자 직접 초대
  invite: systemAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
        programType: z.enum(['reseller', 'partner']),
        commissionRate: z.number().min(1).max(50),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const role = input.programType === 'reseller' ? 'sales' : 'partner';

      // 기존 사용자 확인
      const [existingUser] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      let partnerId: string;

      if (existingUser) {
        await ctx.db.update(users).set({ role }).where(eq(users.id, existingUser.id));
        partnerId = existingUser.id;
      } else {
        const newId = crypto.randomUUID();
        await ctx.db.insert(users).values({
          id: newId,
          name: input.name,
          email: input.email,
          role,
          emailVerified: new Date(),
        });
        partnerId = newId;
      }

      await ctx.db.insert(partnerContracts).values({
        partnerId,
        programType: input.programType,
        commissionRate: input.commissionRate,
      });

      return { success: true };
    }),

  // 계약 수정
  updateContract: systemAdminProcedure
    .input(
      z.object({
        contractId: z.string(),
        commissionRate: z.number().min(1).max(50).optional(),
        responsibilities: z.string().optional(),
        status: z.enum(['active', 'expired', 'terminated']).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { contractId, ...updates } = input;
      await ctx.db.update(partnerContracts).set(updates).where(eq(partnerContracts.id, contractId));
      return { success: true };
    }),

  // 수수료 기록 추가
  addCommission: systemAdminProcedure
    .input(
      z.object({
        partnerId: z.string(),
        clientId: z.string(),
        periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
        clientRevenue: z.number().min(0),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 계약에서 수수료율 조회
      const [contract] = await ctx.db
        .select()
        .from(partnerContracts)
        .where(
          and(
            eq(partnerContracts.partnerId, input.partnerId),
            eq(partnerContracts.status, 'active'),
          ),
        )
        .limit(1);

      if (!contract) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '활성 계약이 없습니다' });
      }

      const commissionAmount = Math.round((input.clientRevenue * contract.commissionRate) / 100);

      await ctx.db.insert(commissions).values({
        partnerId: input.partnerId,
        clientId: input.clientId,
        periodMonth: input.periodMonth,
        clientRevenue: input.clientRevenue,
        commissionRate: contract.commissionRate,
        commissionAmount,
      });

      return { success: true, commissionAmount };
    }),

  // 월별 수수료 집계
  commissionSummary: systemAdminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        periodMonth: commissions.periodMonth,
        totalRevenue: sum(commissions.clientRevenue),
        totalCommission: sum(commissions.commissionAmount),
        count: count(),
      })
      .from(commissions)
      .groupBy(commissions.periodMonth)
      .orderBy(desc(commissions.periodMonth))
      .limit(12);

    return rows.map((r) => ({
      periodMonth: r.periodMonth,
      totalRevenue: Number(r.totalRevenue ?? 0),
      totalCommission: Number(r.totalCommission ?? 0),
      count: r.count,
    }));
  }),
});
