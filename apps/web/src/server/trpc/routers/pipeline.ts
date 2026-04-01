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
import { protectedProcedure, router } from '../init';

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

  // Worker/큐 상태 조회 — 디버깅/모니터링용
  queueStatus: protectedProcedure.query(async () => {
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

// 작업 소유권 확인 헬퍼
async function verifyJobOwnership(ctx: { teamId?: number | null; db: any }, jobId: number) {
  if (ctx.teamId) {
    const [job] = await ctx.db
      .select({ id: collectionJobs.id })
      .from(collectionJobs)
      .where(and(eq(collectionJobs.id, jobId), eq(collectionJobs.teamId, ctx.teamId)));
    if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
  }
}
