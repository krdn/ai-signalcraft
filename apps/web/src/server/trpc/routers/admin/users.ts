import { z } from 'zod';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { users } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

export const usersRouter = router({
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

  updateRole: systemAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(['admin', 'leader', 'sales', 'partner', 'member', 'demo']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
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

  toggleActive: systemAdminProcedure
    .input(z.object({ userId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
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
