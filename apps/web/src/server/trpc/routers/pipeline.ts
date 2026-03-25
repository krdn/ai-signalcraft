import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { collectionJobs } from '@ai-signalcraft/core';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getPipelineStatus } from '../../pipeline-status';

export const pipelineRouter = router({
  // 파이프라인 상태 조회 — 공유 함수 위임 (팀 소속 확인만 여기서 수행)
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // 팀 소속 확인
      if (ctx.teamId) {
        const jobConditions = and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId));
        const [job] = await ctx.db.select({ id: collectionJobs.id }).from(collectionJobs).where(jobConditions);
        if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const result = await getPipelineStatus(input.jobId);
      if (!result) throw new TRPCError({ code: 'NOT_FOUND' });

      return result;
    }),
});
