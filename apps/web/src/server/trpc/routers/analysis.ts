import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { collectionJobs, analysisResults, analysisReports, triggerCollection, cleanupBeforeNewPipeline } from '@ai-signalcraft/core';
import { eq, and } from 'drizzle-orm';

export const analysisRouter = router({
  // 분석 트리거 -- 키워드/소스/기간으로 수집+분석 파이프라인 시작
  trigger: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1).max(50),
      sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).min(1),
      startDate: z.string(), // ISO date string
      endDate: z.string(),
      options: z.object({
        enableItemAnalysis: z.boolean().optional(),
      }).optional(),
      limits: z.object({
        naverArticles: z.number().min(10).max(5000),
        youtubeVideos: z.number().min(5).max(500),
        communityPosts: z.number().min(5).max(500),
        commentsPerItem: z.number().min(10).max(2000),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 0. 이전 취소/실패 작업의 Redis 잔여물 정리
      // 취소 후 active 작업이 concurrency 슬롯을 점유하면 새 작업이 "수집 대기..." 상태로 멈춤
      try {
        const cleaned = await cleanupBeforeNewPipeline();
        if (cleaned > 0) console.log(`[trigger] 이전 잔여 작업 ${cleaned}개 정리 완료`);
      } catch {
        // 정리 실패해도 새 작업 실행은 진행
      }

      // 1. collectionJobs 레코드 생성 (팀 ID 포함)
      const [job] = await ctx.db.insert(collectionJobs).values({
        keyword: input.keyword,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: 'pending',
        teamId: ctx.teamId ?? null,
        options: input.options ?? null,
        limits: input.limits ?? null,
      }).returning();

      // 2. BullMQ 트리거 -- CollectionTrigger 형식 (INT-01: sources 전달)
      await triggerCollection({
        keyword: input.keyword,
        startDate: new Date(input.startDate).toISOString(),
        endDate: new Date(input.endDate).toISOString(),
        sources: input.sources,
        limits: input.limits,
      }, job.id);

      return { jobId: job.id };
    }),

  // 분석 결과 조회 -- 특정 작업의 모듈별 분석 결과 (팀 소속 확인)
  getResults: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // 팀 소속 확인: 해당 작업이 내 팀의 것인지 검증
      if (ctx.teamId) {
        const [job] = await ctx.db.select({ teamId: collectionJobs.teamId })
          .from(collectionJobs)
          .where(and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId)))
          .limit(1);
        if (!job) return [];
      }

      const results = await ctx.db.select()
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));
      return results;
    }),

  // 리포트 조회 -- 특정 작업의 종합 리포트 (팀 소속 확인)
  getReport: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      // 팀 소속 확인
      if (ctx.teamId) {
        const [job] = await ctx.db.select({ teamId: collectionJobs.teamId })
          .from(collectionJobs)
          .where(and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId)))
          .limit(1);
        if (!job) return null;
      }

      const [report] = await ctx.db.select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);
      return report ?? null;
    }),
});
