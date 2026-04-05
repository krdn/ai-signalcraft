import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import {
  collectionJobs,
  analysisResults,
  analysisReports,
  demoQuotas,
  triggerCollection,
  triggerAnalysisResume,
  cleanupBeforeNewPipeline,
} from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';

// 데모 사용자 허용 모듈 (Stage 1 — 3개만)
const DEMO_ALLOWED_MODULES = ['macroView', 'segmentation', 'sentimentFraming'];

// 데모 수집 한도
const DEMO_COLLECTION_LIMITS = {
  naverArticles: 30,
  youtubeVideos: 5,
  communityPosts: 10,
  commentsPerItem: 30,
};

export const analysisRouter = router({
  // 분석 트리거 -- 키워드/소스/기간으로 수집+분석 파이프라인 시작
  trigger: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(50),
        sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).min(1),
        startDate: z.string(), // ISO date string
        endDate: z.string(),
        options: z
          .object({
            enableItemAnalysis: z.boolean().optional(),
            tokenOptimization: z.enum(['none', 'light', 'standard', 'aggressive']).optional(),
          })
          .optional(),
        limits: z
          .object({
            naverArticles: z.number().min(10).max(5000),
            youtubeVideos: z.number().min(5).max(500),
            communityPosts: z.number().min(5).max(500),
            commentsPerItem: z.number().min(10).max(2000),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userRole = (ctx.session.user as Record<string, unknown>).role as string;
      let effectiveLimits = input.limits ?? null;
      let effectiveOptions = input.options ?? null;
      let skippedModules: string[] | null = null;
      let costLimitUsd: number | null = null;

      // ── 데모 사용자 쿼터 체크 + 비용 최소화 ──
      if (userRole === 'demo') {
        const userId = ctx.session.user!.id!;
        const [quota] = await ctx.db
          .select()
          .from(demoQuotas)
          .where(eq(demoQuotas.userId, userId))
          .limit(1);

        if (!quota) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '데모 쿼터 정보가 없습니다' });
        }
        if (quota.expiresAt < new Date()) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '데모 체험 기간이 만료되었습니다. 정식 가입 후 이용해 주세요.',
          });
        }

        // 일일 횟수 체크 — 날짜가 바뀌면 todayUsed 리셋
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const todayUsed = quota.todayDate === today ? quota.todayUsed : 0;
        if (todayUsed >= quota.dailyLimit) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `오늘 분석 횟수(${quota.dailyLimit}회)를 모두 사용했습니다. 내일 다시 시도하거나 정식 가입 후 이용해 주세요.`,
          });
        }

        // 수집 한도 클램핑 (데모 한도 초과 방지)
        const demoLimits =
          (quota.maxCollectionLimits as typeof DEMO_COLLECTION_LIMITS) ?? DEMO_COLLECTION_LIMITS;
        effectiveLimits = {
          naverArticles: Math.min(
            effectiveLimits?.naverArticles ?? demoLimits.naverArticles,
            demoLimits.naverArticles,
          ),
          youtubeVideos: Math.min(
            effectiveLimits?.youtubeVideos ?? demoLimits.youtubeVideos,
            demoLimits.youtubeVideos,
          ),
          communityPosts: Math.min(
            effectiveLimits?.communityPosts ?? demoLimits.communityPosts,
            demoLimits.communityPosts,
          ),
          commentsPerItem: Math.min(
            effectiveLimits?.commentsPerItem ?? demoLimits.commentsPerItem,
            demoLimits.commentsPerItem,
          ),
        };

        // 토큰 최적화 강제
        effectiveOptions = { ...effectiveOptions, tokenOptimization: 'aggressive' as const };

        // 허용 모듈 외 스킵
        const allowed = (quota.allowedModules as string[]) ?? DEMO_ALLOWED_MODULES;
        // 전체 모듈에서 allowed를 제외한 나머지를 skip 처리 (runner가 skippedModules를 참조)
        const ALL_MODULES = [
          'macroView',
          'segmentation',
          'sentimentFraming',
          'messageImpact',
          'riskMap',
          'opportunity',
          'strategy',
          'finalSummary',
          'approvalRating',
          'frameWar',
          'crisisScenario',
          'winSimulation',
        ];
        skippedModules = ALL_MODULES.filter((m) => !allowed.includes(m));

        // 비용 하드캡
        costLimitUsd = 0.5;

        // 쿼터 사용 카운트 증가
        await ctx.db
          .update(demoQuotas)
          .set({
            todayUsed: todayUsed + 1,
            todayDate: today,
            totalUsed: quota.totalUsed + 1,
          })
          .where(eq(demoQuotas.userId, userId));
      }

      // 0. 이전 취소/실패 작업의 Redis 잔여물 정리
      try {
        const cleaned = await cleanupBeforeNewPipeline();
        if (cleaned > 0) console.warn(`[trigger] 이전 잔여 작업 ${cleaned}개 정리 완료`);
      } catch {
        // 정리 실패해도 새 작업 실행은 진행
      }

      // 1. collectionJobs 레코드 생성 (팀 ID 포함)
      const [job] = await ctx.db
        .insert(collectionJobs)
        .values({
          keyword: input.keyword,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: 'pending',
          teamId: ctx.teamId ?? null,
          options: effectiveOptions,
          limits: effectiveLimits,
          skippedModules,
          costLimitUsd,
        })
        .returning();

      // 2. BullMQ 트리거 -- CollectionTrigger 형식 (INT-01: sources 전달)
      await triggerCollection(
        {
          keyword: input.keyword,
          startDate: new Date(input.startDate).toISOString(),
          endDate: new Date(input.endDate).toISOString(),
          sources: input.sources,
          limits: effectiveLimits ?? undefined,
        },
        job.id,
      );

      return { jobId: job.id };
    }),

  // 분석 재실행 -- 실패 모듈 자동 탐지 또는 지정 모듈만 재실행
  retryAnalysis: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        retryModules: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 팀 소속 확인
      const [job] = await ctx.db
        .select({
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
        const failedRows = await ctx.db
          .select({ module: analysisResults.module })
          .from(analysisResults)
          .where(and(eq(analysisResults.jobId, input.jobId), eq(analysisResults.status, 'failed')));
        retryModules = failedRows.map((r) => r.module).filter((m) => m !== null);
      }

      // 해당 모듈 status를 pending으로 리셋
      for (const mod of retryModules) {
        await ctx.db
          .update(analysisResults)
          .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
          .where(and(eq(analysisResults.jobId, input.jobId), eq(analysisResults.module, mod)));
      }

      // 작업 상태를 running으로 변경
      await ctx.db
        .update(collectionJobs)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(collectionJobs.id, input.jobId));

      await triggerAnalysisResume(input.jobId, job.keyword, { retryModules });
      return { jobId: input.jobId, retryModules };
    }),

  // 특정 모듈 1개 재실행
  retryModule: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        module: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [job] = await ctx.db
        .select({
          teamId: collectionJobs.teamId,
          keyword: collectionJobs.keyword,
        })
        .from(collectionJobs)
        .where(eq(collectionJobs.id, input.jobId))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
      if (ctx.teamId && job.teamId !== ctx.teamId) throw new TRPCError({ code: 'NOT_FOUND' });

      // 모듈 status를 pending으로 리셋
      await ctx.db
        .update(analysisResults)
        .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
        .where(
          and(eq(analysisResults.jobId, input.jobId), eq(analysisResults.module, input.module)),
        );

      await ctx.db
        .update(collectionJobs)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(collectionJobs.id, input.jobId));

      await triggerAnalysisResume(input.jobId, job.keyword, { retryModules: [input.module] });
      return { jobId: input.jobId, module: input.module };
    }),

  // 리포트만 재생성 (분석 결과 유지, 리포트만 갱신)
  regenerateReport: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [job] = await ctx.db
        .select({
          teamId: collectionJobs.teamId,
          keyword: collectionJobs.keyword,
        })
        .from(collectionJobs)
        .where(eq(collectionJobs.id, input.jobId))
        .limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' });
      if (ctx.teamId && job.teamId !== ctx.teamId) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db
        .update(collectionJobs)
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
        const [job] = await ctx.db
          .select({ teamId: collectionJobs.teamId })
          .from(collectionJobs)
          .where(and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId)))
          .limit(1);
        if (!job) return [];
      }

      const results = await ctx.db
        .select()
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
        const [job] = await ctx.db
          .select({ teamId: collectionJobs.teamId })
          .from(collectionJobs)
          .where(and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId)))
          .limit(1);
        if (!job) return null;
      }

      const [report] = await ctx.db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);
      return report ?? null;
    }),
});
