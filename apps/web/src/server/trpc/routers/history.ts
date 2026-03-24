import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { collectionJobs } from '@ai-signalcraft/core';
import { desc, sql, eq } from 'drizzle-orm';

export const historyRouter = router({
  // 히스토리 목록 조회 -- 과거 분석 작업 페이지네이션 (팀 필터링)
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const offset = (input.page - 1) * input.perPage;

      // 팀 소속인 경우 해당 팀의 작업만 필터
      const teamFilter = ctx.teamId
        ? eq(collectionJobs.teamId, ctx.teamId)
        : undefined;

      const baseQuery = ctx.db.select().from(collectionJobs);
      const jobs = teamFilter
        ? await baseQuery.where(teamFilter).orderBy(desc(collectionJobs.createdAt)).limit(input.perPage).offset(offset)
        : await baseQuery.orderBy(desc(collectionJobs.createdAt)).limit(input.perPage).offset(offset);

      const countQuery = ctx.db.select({ count: sql<number>`count(*)::int` }).from(collectionJobs);
      const [{ count }] = teamFilter
        ? await countQuery.where(teamFilter)
        : await countQuery;

      return {
        items: jobs,
        total: count,
        page: input.page,
        perPage: input.perPage,
      };
    }),
});
