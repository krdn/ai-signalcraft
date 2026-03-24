import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { collectionJobs, analysisResults, analysisReports } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const pipelineRouter = router({
  // 파이프라인 상태 조회 -- 4단계 진행 상태를 collectionJobs/analysisResults/analysisReports에서 파생
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // 1. collectionJobs에서 수집 상태 조회
      const [job] = await ctx.db.select()
        .from(collectionJobs)
        .where(eq(collectionJobs.id, input.jobId));
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      // 2. analysisResults에서 분석 모듈 상태 조회
      const analysisRows = await ctx.db.select()
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));

      // 3. analysisReports에서 리포트 존재 여부 조회
      const [report] = await ctx.db.select({ id: analysisReports.id })
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);

      // 4단계 파이프라인 상태 파생 (per D-12):
      //   수집(collection) -> 정규화(normalization) -> 분석(analysis) -> 리포트(report)
      const collectionDone = job.status === 'completed' || job.status === 'partial_failure';
      const collectionFailed = job.status === 'failed';
      const normalizationDone = collectionDone; // BullMQ Flow에서 수집 후 자동 정규화
      const analysisStarted = analysisRows.length > 0;
      const analysisInProgress = analysisRows.some(r => r.status === 'running' || r.status === 'pending');
      const analysisDone = analysisStarted && !analysisInProgress;
      const reportDone = !!report;

      const pipelineStages = {
        collection: {
          status: collectionFailed ? 'failed' as const
            : collectionDone ? 'completed' as const
            : job.status === 'running' ? 'running' as const
            : 'pending' as const,
        },
        normalization: {
          status: collectionFailed ? 'skipped' as const
            : normalizationDone ? 'completed' as const
            : 'pending' as const,
        },
        analysis: {
          status: collectionFailed ? 'skipped' as const
            : analysisDone ? 'completed' as const
            : analysisInProgress ? 'running' as const
            : analysisStarted ? 'running' as const
            : 'pending' as const,
        },
        report: {
          status: collectionFailed ? 'skipped' as const
            : reportDone ? 'completed' as const
            : analysisDone ? 'running' as const
            : 'pending' as const,
        },
      };

      return {
        status: job.status,
        progress: job.progress,
        errorDetails: job.errorDetails,
        keyword: job.keyword,
        pipelineStages,
        analysisModuleCount: {
          total: analysisRows.length,
          completed: analysisRows.filter(r => r.status === 'completed').length,
        },
        hasReport: reportDone,
      };
    }),
});
