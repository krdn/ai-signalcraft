import { z } from 'zod';
import { eq, and, sql, desc, lte, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { users, demoQuotas } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

export const demoRouter = router({
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
