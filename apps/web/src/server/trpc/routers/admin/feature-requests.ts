import { z } from 'zod';
import { desc, eq, and, count } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { featureRequests, users } from '@ai-signalcraft/core';
import { router, systemAdminProcedure } from '../../init';

export const adminFeatureRequestsRouter = router({
  list: systemAdminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(5).max(50).default(20),
        status: z.enum(['pending', 'reviewing', 'accepted', 'rejected', 'shipped']).optional(),
        category: z.enum(['feature', 'improvement', 'bug', 'other']).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const conditions = [];
      if (input.status) conditions.push(eq(featureRequests.status, input.status));
      if (input.category) conditions.push(eq(featureRequests.category, input.category));
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [total]] = await Promise.all([
        ctx.db
          .select({
            id: featureRequests.id,
            title: featureRequests.title,
            description: featureRequests.description,
            category: featureRequests.category,
            status: featureRequests.status,
            adminNote: featureRequests.adminNote,
            linkedReleaseEntryId: featureRequests.linkedReleaseEntryId,
            createdAt: featureRequests.createdAt,
            updatedAt: featureRequests.updatedAt,
            submitterName: users.name,
            submitterEmail: users.email,
          })
          .from(featureRequests)
          .leftJoin(users, eq(featureRequests.submittedBy, users.id))
          .where(where)
          .orderBy(desc(featureRequests.createdAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        ctx.db.select({ count: count() }).from(featureRequests).where(where),
      ]);

      return { items, total: total.count, page: input.page, pageSize: input.pageSize };
    }),

  updateStatus: systemAdminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(['pending', 'reviewing', 'accepted', 'rejected', 'shipped']),
        adminNote: z.string().max(1000).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await ctx.db
        .update(featureRequests)
        .set({
          status: input.status,
          adminNote: input.adminNote,
          updatedAt: new Date(),
        })
        .where(eq(featureRequests.id, input.id))
        .returning({ id: featureRequests.id });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),

  linkToEntry: systemAdminProcedure
    .input(
      z.object({
        id: z.number(),
        releaseEntryId: z.number().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [updated] = await ctx.db
        .update(featureRequests)
        .set({
          linkedReleaseEntryId: input.releaseEntryId,
          status: input.releaseEntryId ? 'shipped' : 'accepted',
          updatedAt: new Date(),
        })
        .where(eq(featureRequests.id, input.id))
        .returning({ id: featureRequests.id });
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });
      return { success: true };
    }),
});
