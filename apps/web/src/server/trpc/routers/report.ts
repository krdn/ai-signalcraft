import { z } from 'zod';
import { analysisReports } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import { protectedProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';

export const reportRouter = router({
  // 특정 작업의 리포트 조회 (팀/사용자 기반 접근 제어)
  getByJobId: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        filterMode: z.enum(['mine', 'team']).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const filterMode = input.filterMode ?? ctx.defaultFilterMode;
      await verifyJobOwnership(ctx, input.jobId, filterMode);

      const [report] = await ctx.db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);
      return report ?? null;
    }),
});
