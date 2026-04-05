import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { collectionJobs, cancelPipeline } from '@ai-signalcraft/core';
import { systemAdminProcedure, router } from '../../init';

export const jobsRouter = router({
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

  forceCancel: systemAdminProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      return cancelPipeline(input.jobId);
    }),
});
