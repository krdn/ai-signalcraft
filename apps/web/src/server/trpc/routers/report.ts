import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { analysisReports } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';

export const reportRouter = router({
  // 특정 작업의 리포트 조회
  getByJobId: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [report] = await ctx.db.select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);
      return report ?? null;
    }),
});
