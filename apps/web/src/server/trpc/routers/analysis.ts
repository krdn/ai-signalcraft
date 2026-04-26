import { TRPCError } from '@trpc/server';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  collectionJobs,
  analysisResults,
  analysisReports,
  analysisPresets,
  analysisSeries,
  triggerCollection,
  triggerSubscriptionAnalysis,
  triggerAnalysisResume,
  cleanupBeforeNewPipeline,
  resumePipelineWithMode,
  runToEndPipeline,
  updateBreakpoints,
  getCollectorClient,
} from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';
import { buildJobCondition } from '../shared/query-helpers';
import { applyDemoGuard } from '../shared/demo-guard';
import { buildSubscriptionAnalysisMeta } from './subscription-analysis-meta';

export const analysisRouter = router({
  // 분석 트리거 -- 키워드/소스/기간으로 수집+분석 파이프라인 시작
  trigger: protectedProcedure
    .input(
      z.object({
        keyword: z.string().min(1).max(50),
        sources: z
          .array(z.enum(['naver', 'naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien']))
          .optional()
          .transform((v) => v?.map((s) => (s === 'naver-news' ? 'naver' : s))),
        customSourceIds: z.array(z.string().uuid()).optional(),
        startDate: z.string(), // ISO date string
        endDate: z.string(),
        options: z
          .object({
            enableItemAnalysis: z.boolean().optional(),
            tokenOptimization: z
              .enum([
                'none',
                'light',
                'standard',
                'aggressive',
                'rag-light',
                'rag-standard',
                'rag-aggressive',
              ])
              .optional(),
            collectTranscript: z.boolean().optional(),
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
        // 수집 한도 해석 방식. 기간 모드에서는 'perDay'(날짜별 한도),
        // 이벤트 중심 모드에서는 'total'(총량). 미지정 시 'total'로 폴백하여 기존 잡과 하위 호환.
        limitMode: z.enum(['perDay', 'total']).optional(),
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
        domain: z
          .enum([
            'political',
            'fandom',
            'pr',
            'corporate',
            'policy',
            'finance',
            'healthcare',
            'public-sector',
            'education',
            'sports',
            'legal',
            'retail',
          ])
          .optional(),
        seriesId: z.number().optional(),
        createNewSeries: z.boolean().optional(),
        forceRefetch: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 최소 하나의 소스(하드코딩는지 동적) 선택 필수
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

      // 데모 롤은 기간 모드 입력에 의한 쿼터 팽창(최대 30배)을 방지하기 위해 항상 total로 강제.
      const limitMode = userRole === 'demo' ? 'total' : (input.limitMode ?? 'total');

      // 프리셋 조회 및 스냅샷 생성
      let keywordType: string | null = null;
      let presetDomain: typeof input.domain | null = null;
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
        optimization:
          | 'none'
          | 'light'
          | 'standard'
          | 'aggressive'
          | 'rag-light'
          | 'rag-standard'
          | 'rag-aggressive';
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

          // 프리셋의 domain 값을 별도 변수에 저장 (insert 시 참조)
          if (preset.domain) {
            presetDomain = preset.domain as typeof input.domain;
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

      // 시리즈 처리
      let seriesId: number | null = input.seriesId ?? null;
      let seriesOrder: number | null = null;

      if (input.createNewSeries && !seriesId) {
        const [newSeries] = await ctx.db
          .insert(analysisSeries)
          .values({
            teamId: ctx.teamId ?? null,
            userId: ctx.userId,
            keyword: input.keyword,
            domain: input.domain ?? presetDomain ?? 'political',
            title: `${input.keyword} 시리즈`,
            metadata: { totalJobs: 0, lastJobId: null, lastAnalyzedAt: null },
          })
          .returning();
        seriesId = newSeries.id;
        seriesOrder = 0;
      } else if (seriesId) {
        const [last] = await ctx.db
          .select({ maxOrder: sql<number>`COALESCE(MAX(${collectionJobs.seriesOrder}), -1)` })
          .from(collectionJobs)
          .where(eq(collectionJobs.seriesId, seriesId));
        seriesOrder = (last?.maxOrder ?? -1) + 1;
      }

      // limitMode를 options JSONB에 병합하여 DB에 함께 저장 (감사/재실행 시 모드 복원 가능)
      const persistedOptions = effectiveOptions
        ? {
            ...effectiveOptions,
            limitMode,
          }
        : { limitMode };

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
          options: persistedOptions,
          limits: effectiveLimits,
          skippedModules,
          costLimitUsd,
          breakpoints: input.breakpoints,
          keywordType,
          appliedPreset,
          domain: input.domain ?? presetDomain ?? 'political',
          seriesId,
          seriesOrder,
        })
        .returning();

      const effectiveForceRefetch = input.forceRefetch ?? false;

      // 2. BullMQ 트리거 -- CollectionTrigger 형식 (INT-01: sources 전달)
      await triggerCollection(
        {
          keyword: input.keyword,
          startDate: new Date(input.startDate).toISOString(),
          endDate: new Date(input.endDate).toISOString(),
          sources: input.sources,
          customSourceIds: input.customSourceIds,
          limits: effectiveLimits ?? undefined,
          limitMode,
          forceRefetch: effectiveForceRefetch,
          collectTranscript: input.options?.collectTranscript,
        },
        job.id,
      );

      return { jobId: job.id };
    }),

  // 구독 분석 트리거 -- 구독 기반 단축 경로 (수집 생략, 분석만 실행)
  triggerSubscription: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
        domain: z
          .enum([
            'political',
            'economic',
            'social',
            'technology',
            'fandom',
            'pr',
            'corporate',
            'finance',
            'healthcare',
            'sports',
            'education',
            'general',
          ])
          .optional(),
        optimizationPreset: z
          .enum([
            'none',
            'light',
            'standard',
            'aggressive',
            'rag-light',
            'rag-standard',
            'rag-aggressive',
          ])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. 구독 검증
      const sub = await getCollectorClient().subscriptions.get.query({
        id: input.subscriptionId,
      });
      if (!sub || sub.ownerId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '해당 구독에 접근할 수 없습니다.' });
      }
      if (sub.status !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '비활성 구독입니다.' });
      }

      // 2. 운영 가시성 메타 합성 (순수 함수 — 단위 테스트 대상)
      const meta = buildSubscriptionAnalysisMeta(
        {
          keyword: sub.keyword,
          sources: sub.sources,
          limits: sub.limits as Record<string, number> | null,
        },
        { subscriptionId: input.subscriptionId, optimizationPreset: input.optimizationPreset },
      );

      // 3. collection_jobs 레코드 생성
      const [job] = await ctx.db
        .insert(collectionJobs)
        .values({
          keyword: sub.keyword,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          status: 'running',
          domain: input.domain || sub.domain || 'general',
          userId: ctx.userId,
          appliedPreset: meta.appliedPreset,
          limits: meta.limits,
          options: meta.options,
        })
        .returning({ id: collectionJobs.id });

      if (!job) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '잡 생성 실패' });

      // 4. 단축 경로 — analysis 큐에 직접 등록
      await triggerSubscriptionAnalysis(job.id, sub.keyword);

      return { jobId: job.id, keyword: sub.keyword };
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

      // 해당 모듈 status를 pending으로 리셋 (배치 UPDATE)
      await ctx.db
        .update(analysisResults)
        .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
        .where(
          and(
            eq(analysisResults.jobId, input.jobId),
            inArray(analysisResults.module, retryModules),
          ),
        );

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

  // 작업 도메인 조회 — AdvancedView 렌더링에 사용
  getJobDomain: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [job] = await ctx.db
        .select({ domain: collectionJobs.domain })
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode: ctx.defaultFilterMode,
          }),
        )
        .limit(1);
      return job?.domain ?? 'political';
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
