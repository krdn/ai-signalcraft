import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { featureRequests } from '@ai-signalcraft/core';
import { router, authedProcedure } from '../init';

export const featureRequestRouter = router({
  create: authedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(200),
        description: z.string().min(10).max(2000),
        category: z.enum(['feature', 'improvement', 'bug', 'other']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [created] = await ctx.db
        .insert(featureRequests)
        .values({
          title: input.title,
          description: input.description,
          category: input.category,
          submittedBy: ctx.userId,
          status: 'pending',
        })
        .returning();
      return created;
    }),

  myList: authedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          pageSize: z.number().min(5).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 20;

      const items = await ctx.db
        .select()
        .from(featureRequests)
        .where(eq(featureRequests.submittedBy, ctx.userId))
        .orderBy(desc(featureRequests.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      return { items, page, pageSize };
    }),
});
