import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { collectionJobs } from '@ai-signalcraft/core';
import { desc, sql } from 'drizzle-orm';

export const historyRouter = router({
  // 히스토리 목록 조회 -- 과거 분석 작업 페이지네이션
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.perPage;
      const jobs = await ctx.db.select()
        .from(collectionJobs)
        .orderBy(desc(collectionJobs.createdAt))
        .limit(input.perPage)
        .offset(offset);
      const [{ count }] = await ctx.db.select({ count: sql<number>`count(*)::int` })
        .from(collectionJobs);
      return {
        items: jobs,
        total: count,
        page: input.page,
        perPage: input.perPage,
      };
    }),
});
