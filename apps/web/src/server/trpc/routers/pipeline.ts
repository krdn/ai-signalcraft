import { z } from 'zod';
import {
  cancelPipeline,
  pausePipeline,
  resumePipeline,
  setSkippedModules,
  setCostLimit,
  getQueueStatus,
  getJobDiagnostic,
  forceCleanupActiveJob,
} from '@ai-signalcraft/core';
import { TRPCError } from '@trpc/server';
import { getPipelineStatus } from '../../pipeline-status';
import { protectedProcedure, systemAdminProcedure, router } from '../init';
import { verifyJobOwnership } from '../shared/verify-job-ownership';

export const pipelineRouter = router({
  // 파이프라인 상태 조회 — 팀/사용자 기반 접근 제어
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);

      const result = await getPipelineStatus(input.jobId);
      if (!result) throw new TRPCError({ code: 'NOT_FOUND' });

      return result;
    }),

  // 파이프라인 중지
  cancel: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return cancelPipeline(input.jobId);
    }),

  // 파이프라인 일시정지
  pause: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return pausePipeline(input.jobId);
    }),

  // 파이프라인 재개
  resume: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
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
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return setSkippedModules(input.jobId, input.modules);
    }),

  // Worker/큐 상태 조회 — 시스템 관리자 전용
  queueStatus: systemAdminProcedure.query(async () => {
    return getQueueStatus();
  }),

  // 특정 job 진단 — DB/BullMQ 상태 비교 + 문제 감지
  jobDiagnostic: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return getJobDiagnostic(input.jobId);
    }),

  // 고아 active job 강제 제거 + running 모듈 pending 초기화
  forceCleanupJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      const cleaned = await forceCleanupActiveJob(input.jobId);
      return { cleaned };
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
      await verifyJobOwnership(ctx, input.jobId, ctx.defaultFilterMode);
      return setCostLimit(input.jobId, input.limitUsd);
    }),
});
