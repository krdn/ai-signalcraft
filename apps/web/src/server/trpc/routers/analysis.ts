import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { collectionJobs, analysisResults, analysisReports, triggerCollection } from '@ai-signalcraft/core';
import { eq } from 'drizzle-orm';

export const analysisRouter = router({
  // 분석 트리거 -- 키워드/소스/기간으로 수집+분석 파이프라인 시작
  trigger: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1).max(50),
      sources: z.array(z.enum(['naver', 'youtube'])).min(1),
      startDate: z.string(), // ISO date string
      endDate: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. collectionJobs 레코드 생성
      const [job] = await ctx.db.insert(collectionJobs).values({
        keyword: input.keyword,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: 'pending',
        teamId: null,
      }).returning();

      // 2. BullMQ 트리거 -- CollectionTrigger 형식
      await triggerCollection({
        keyword: input.keyword,
        startDate: new Date(input.startDate).toISOString(),
        endDate: new Date(input.endDate).toISOString(),
      }, job.id);

      return { jobId: job.id };
    }),

  // 분석 결과 조회 -- 특정 작업의 모듈별 분석 결과
  getResults: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const results = await ctx.db.select()
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));
      return results;
    }),

  // 리포트 조회 -- 특정 작업의 종합 리포트
  getReport: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [report] = await ctx.db.select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);
      return report ?? null;
    }),
});
