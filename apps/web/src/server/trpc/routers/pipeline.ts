import { z } from 'zod';
import {
  collectionJobs,
  cancelPipeline,
  pausePipeline,
  resumePipeline,
  setSkippedModules,
  setCostLimit,
  getQueueStatus,
} from '@ai-signalcraft/core';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getPipelineStatus } from '../../pipeline-status';
import { protectedProcedure, systemAdminProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';

export const pipelineRouter = router({
  // 파이프라인 상태 조회 — 공유 함수 위임 (팀 소속 확인만 여기서 수행)
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // 팀 소속 확인
      if (ctx.teamId) {
        const jobConditions = and(
          eq(collectionJobs.id, input.jobId),
          eq(collectionJobs.teamId, ctx.teamId),
        );
        const [job] = await ctx.db
          .select({ id: collectionJobs.id })
          .from(collectionJobs)
          .where(jobConditions);
        if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const result = await getPipelineStatus(input.jobId);
      if (!result) throw new TRPCError({ code: 'NOT_FOUND' });

      return result;
    }),

  // 파이프라인 중지
  cancel: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId);
      return cancelPipeline(input.jobId);
    }),

  // 파이프라인 일시정지
  pause: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId);
      return pausePipeline(input.jobId);
    }),

  // 파이프라인 재개
  resume: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId);
      return resumePipeline(input.jobId);
    }),

  // 분석 모듈 스킵 설정
  skipModules: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        modules: z.array(z.string()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId);
      return setSkippedModules(input.jobId, input.modules);
    }),

  // Worker/큐 상태 조회 — 시스템 관리자 전용
  queueStatus: systemAdminProcedure.query(async () => {
    return getQueueStatus();
  }),

  // 비용 한도 설정
  setCostLimit: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        limitUsd: z.number().positive().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId);
      return setCostLimit(input.jobId, input.limitUsd);
    }),
});
