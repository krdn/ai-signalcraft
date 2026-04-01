import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../init';
import { collectionJobs, analysisResults, analysisReports, triggerCollection, triggerAnalysisResume, cleanupBeforeNewPipeline } from '@ai-signalcraft/core';
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

  // 분석 재실행 -- 실패 모듈 자동 탐지 또는 지정 모듈만 재실행
  retryAnalysis: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      retryModules: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 팀 소속 확인
      const [job] = await ctx.db.select({
        teamId: collectionJobs.teamId,
        keyword: collectionJobs.keyword,
      })
        .from(collectionJobs)
        .where(eq(collectionJobs.id, input.jobId))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
      if (ctx.teamId && job.teamId !== ctx.teamId) throw new TRPCError({ code: 'NOT_FOUND' });

      // retryModules 미지정 시 failed 모듈 자동 탐지
      let retryModules = input.retryModules;
      if (!retryModules || retryModules.length === 0) {
        const failedRows = await ctx.db.select({ module: analysisResults.module })
          .from(analysisResults)
          .where(and(
            eq(analysisResults.jobId, input.jobId),
            eq(analysisResults.status, 'failed'),
          ));
        retryModules = failedRows
          .map(r => r.module)
          .filter(m => m !== null);
      }

      // 해당 모듈 status를 pending으로 리셋
      for (const mod of retryModules) {
        await ctx.db.update(analysisResults)
          .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
          .where(and(eq(analysisResults.jobId, input.jobId), eq(analysisResults.module, mod)));
      }

      // 작업 상태를 running으로 변경
      await ctx.db.update(collectionJobs)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(collectionJobs.id, input.jobId));

      await triggerAnalysisResume(input.jobId, job.keyword, { retryModules });
      return { jobId: input.jobId, retryModules };
    }),

  // 특정 모듈 1개 재실행
  retryModule: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      module: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [job] = await ctx.db.select({
        teamId: collectionJobs.teamId,
        keyword: collectionJobs.keyword,
      })
        .from(collectionJobs)
        .where(eq(collectionJobs.id, input.jobId))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
      if (ctx.teamId && job.teamId !== ctx.teamId) throw new TRPCError({ code: 'NOT_FOUND' });

      // 모듈 status를 pending으로 리셋
      await ctx.db.update(analysisResults)
        .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
        .where(and(eq(analysisResults.jobId, input.jobId), eq(analysisResults.module, input.module)));

      await ctx.db.update(collectionJobs)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(collectionJobs.id, input.jobId));

      await triggerAnalysisResume(input.jobId, job.keyword, { retryModules: [input.module] });
      return { jobId: input.jobId, module: input.module };
    }),

  // 리포트만 재생성 (분석 결과 유지, 리포트만 갱신)
  regenerateReport: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [job] = await ctx.db.select({
        teamId: collectionJobs.teamId,
        keyword: collectionJobs.keyword,
      })
        .from(collectionJobs)
        .where(eq(collectionJobs.id, input.jobId))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
      if (ctx.teamId && job.teamId !== ctx.teamId) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db.update(collectionJobs)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(collectionJobs.id, input.jobId));

      await triggerAnalysisResume(input.jobId, job.keyword, { reportOnly: true });
      return { jobId: input.jobId };
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
