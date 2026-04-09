import { TRPCError } from '@trpc/server';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import {
  collectionJobs,
  analysisResults,
  analysisReports,
  analysisPresets,
  triggerCollection,
  triggerAnalysisResume,
  cleanupBeforeNewPipeline,
  resumePipelineWithMode,
  runToEndPipeline,
  updateBreakpoints,
} from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';
import { buildJobCondition } from '../shared/query-helpers';
import { applyDemoGuard } from '../shared/demo-guard';

export const analysisRouter = router({
  // 분석 트리거 -- 키워드/소스/기간으로 수집+분석 파이프라인 시작
  trigger: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(50),
        sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).optional(),
        customSourceIds: z.array(z.string().uuid()).optional(),
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
        breakpoints: z
          .array(
            z.enum([
              'collection',
              'normalize',
              'token-optimization',
              'item-analysis',
              'analysis-stage1',
              'analysis-stage2',
              'analysis-stage4',
            ]),
          )
          .default([]),
        keywordType: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 최소 하나의 소스(하드코딩 또는 동적) 선택 필수
      const hasSources = (input.sources?.length ?? 0) > 0;
      const hasCustom = (input.customSourceIds?.length ?? 0) > 0;
      if (!hasSources && !hasCustom) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '최소 하나 이상의 소스를 선택해 주세요.',
        });
      }
      const userRole = ctx.session.user.role;
      let effectiveLimits = input.limits ?? null;
      let effectiveOptions = input.options ?? null;
      let skippedModules: string[] | null = null;
      let costLimitUsd: number | null = null;

      // 데모 사용자 쿼터 체크 + 제한 적용
      if (userRole === 'demo') {
        const guard = await applyDemoGuard(
          ctx.db,
          ctx.session.user!.id!,
          effectiveLimits,
          effectiveOptions,
        );
        effectiveLimits = guard.effectiveLimits;
        effectiveOptions = guard.effectiveOptions;
        skippedModules = guard.skippedModules;
        costLimitUsd = guard.costLimitUsd;
      }

      // 프리셋 조회 및 스냅샷 생성
      let keywordType: string | null = null;
      let appliedPreset: {
        slug: string;
        title: string;
        sources: Record<string, boolean>;
        limits: {
          naverArticles: number;
          youtubeVideos: number;
          communityPosts: number;
          commentsPerItem: number;
        };
        optimization: 'none' | 'light' | 'standard' | 'aggressive';
        skippedModules: string[];
        enableItemAnalysis: boolean;
        customized: boolean;
      } | null = null;

      if (input.keywordType) {
        const [preset] = await ctx.db
          .select()
          .from(analysisPresets)
          .where(eq(analysisPresets.slug, input.keywordType))
          .limit(1);

        if (preset) {
          keywordType = preset.slug;

          // 프리셋 스냅샷 생성
          appliedPreset = {
            slug: preset.slug,
            title: preset.title,
            sources: preset.sources,
            limits: preset.limits,
            optimization: preset.optimization,
            skippedModules: preset.skippedModules,
            enableItemAnalysis: preset.enableItemAnalysis,
            customized: false,
          };

          // 프리셋의 skippedModules 적용 (데모 가드와 병합)
          if (!skippedModules) {
            skippedModules = preset.skippedModules as string[];
          } else {
            const merged = new Set([...skippedModules, ...(preset.skippedModules as string[])]);
            skippedModules = [...merged];
          }

          // 사용자가 프리셋 값을 변경했는지 확인
          const presetSources = preset.sources as Record<string, boolean>;
          const presetLimits = preset.limits as Record<string, number>;
          const inputSources = input.sources ?? [];
          const inputLimits = input.limits;

          const sourcesChanged =
            inputSources.length > 0 &&
            JSON.stringify(
              Object.keys(presetSources)
                .filter((k) => presetSources[k])
                .sort(),
            ) !== JSON.stringify([...inputSources].sort());
          const limitsChanged =
            inputLimits && JSON.stringify(inputLimits) !== JSON.stringify(presetLimits);

          if (sourcesChanged || limitsChanged) {
            appliedPreset!.customized = true;
          }
        }
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
          userId: ctx.userId,
          options: effectiveOptions,
          limits: effectiveLimits,
          skippedModules,
          costLimitUsd,
          breakpoints: input.breakpoints,
          keywordType,
          appliedPreset,
        })
        .returning();

      // 2. BullMQ 트리거 -- CollectionTrigger 형식 (INT-01: sources 전달)
      await triggerCollection(
        {
          keyword: input.keyword,
          startDate: new Date(input.startDate).toISOString(),
          endDate: new Date(input.endDate).toISOString(),
          sources: input.sources,
          customSourceIds: input.customSourceIds,
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

  // 분석 결과 조회 -- 특정 작업의 모듈별 분석 결과 (팀/사용자 기반 접근 제어)
  getResults: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        filterMode: z.enum(['mine', 'team']).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const filterMode = input.filterMode ?? ctx.defaultFilterMode;
      const [job] = await ctx.db
        .select({ id: collectionJobs.id })
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode,
          }),
        )
        .limit(1);
      if (!job) return [];

      const results = await ctx.db
        .select()
        .from(analysisResults)
        .where(eq(analysisResults.jobId, input.jobId));
      return results;
    }),

  // 리포트 조회 -- 특정 작업의 종합 리포트 (팀/사용자 기반 접근 제어)
  getReport: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        filterMode: z.enum(['mine', 'team']).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const filterMode = input.filterMode ?? ctx.defaultFilterMode;
      const [job] = await ctx.db
        .select({ id: collectionJobs.id })
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode,
          }),
        )
        .limit(1);
      if (!job) return null;

      const [report] = await ctx.db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.jobId, input.jobId))
        .limit(1);
      return report ?? null;
    }),

  resume: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        mode: z.enum(['continue', 'step-once']),
      }),
    )
    .mutation(async ({ input }) => {
      return await resumePipelineWithMode(input.jobId, input.mode);
    }),

  runToEnd: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      return await runToEndPipeline(input.jobId);
    }),

  updateBreakpoints: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        breakpoints: z.array(
          z.enum([
            'collection',
            'normalize',
            'token-optimization',
            'item-analysis',
            'analysis-stage1',
            'analysis-stage2',
            'analysis-stage4',
          ]),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      return await updateBreakpoints(input.jobId, input.breakpoints);
    }),
});
