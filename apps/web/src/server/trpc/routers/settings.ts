import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  getAllModelSettings,
  upsertModelSetting,
  modelSettings,
  MODEL_SCENARIO_PRESETS,
  applyModelScenario,
  getAllProviderKeys,
  addProviderKey,
  updateProviderKey,
  deleteProviderKey,
  testProviderConnection,
  chatWithProvider,
  getConcurrencyConfig,
  upsertConcurrencyConfig,
  applyConcurrencyPreset,
  CONCURRENCY_PRESETS,
  getCollectionLimits,
  updateCollectionLimits,
} from '@ai-signalcraft/core';
import { AI_PROVIDER_VALUES } from '@ai-signalcraft/core/ai-meta';
import { protectedProcedure, systemAdminProcedure, router } from '../init';

// AI 프로바이더 enum — 중앙 레지스트리에서 파생
const aiProviderEnum = z.enum(AI_PROVIDER_VALUES);

export const settingsRouter = router({
  // === 모듈별 AI 모델 설정 ===

  // 12개 모듈의 AI 모델 설정 전체 조회
  list: protectedProcedure.query(async () => {
    return getAllModelSettings();
  }),

  // 모듈의 AI 모델 설정 변경 (시스템 관리자 전용)
  update: systemAdminProcedure
    .input(
      z.object({
        moduleName: z.string().min(1),
        provider: aiProviderEnum,
        model: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return upsertModelSetting(input.moduleName, input.provider, input.model);
    }),

  // 전체 모듈의 AI 모델을 일괄 변경 (시스템 관리자 전용)
  bulkUpdate: systemAdminProcedure
    .input(
      z.object({
        provider: aiProviderEnum,
        model: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const currentSettings = await getAllModelSettings();
      const results = await Promise.all(
        currentSettings.map((s) => upsertModelSetting(s.moduleName, input.provider, input.model)),
      );
      return { updated: results.length };
    }),

  // 모듈의 AI 모델 설정을 기본값으로 복원 (시스템 관리자 전용)
  resetToDefault: systemAdminProcedure
    .input(z.object({ moduleName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(modelSettings).where(eq(modelSettings.moduleName, input.moduleName));
      return { success: true };
    }),

  // === 시나리오 프리셋 ===

  modelScenarios: router({
    // 프리셋 목록 반환
    list: protectedProcedure.query(() => {
      return MODEL_SCENARIO_PRESETS;
    }),

    // 프리셋 적용 (시스템 관리자 전용)
    applyPreset: systemAdminProcedure
      .input(z.object({ presetId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return applyModelScenario(input.presetId);
      }),
  }),

  // === 병렬처리 동시성 설정 ===

  concurrency: router({
    // 현재 설정 조회
    get: protectedProcedure.query(async () => {
      return getConcurrencyConfig();
    }),

    // 프리셋 목록 반환
    presets: protectedProcedure.query(() => {
      return CONCURRENCY_PRESETS;
    }),

    // 프리셋 적용 (시스템 관리자 전용)
    applyPreset: systemAdminProcedure
      .input(z.object({ presetId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return applyConcurrencyPreset(input.presetId);
      }),

    // 개별 값 커스텀 수정 (시스템 관리자 전용)
    update: systemAdminProcedure
      .input(
        z.object({
          providerConcurrency: z.record(z.string(), z.number().min(1).max(20)).optional(),
          apiConcurrency: z.number().min(1).max(20).optional(),
          articleBatchSize: z.number().min(1).max(50).optional(),
          commentBatchSize: z.number().min(1).max(200).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        return upsertConcurrencyConfig({ ...input, activePreset: null });
      }),
  }),

  // === 수집 한도 기본값 ===

  collectionLimits: router({
    get: protectedProcedure.query(async () => {
      return getCollectionLimits();
    }),

    update: systemAdminProcedure
      .input(
        z.object({
          naverArticles: z.number().min(10).max(5000).optional(),
          youtubeVideos: z.number().min(5).max(500).optional(),
          communityPosts: z.number().min(5).max(500).optional(),
          commentsPerItem: z.number().min(10).max(2000).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        return updateCollectionLimits(input);
      }),
  }),

  // === 프로바이더 API 키 관리 ===

  providerKeys: router({
    // 전체 프로바이더 키 목록
    list: protectedProcedure.query(async () => {
      return getAllProviderKeys();
    }),

    // 프로바이더 키 추가 (시스템 관리자 전용)
    add: systemAdminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          providerType: aiProviderEnum,
          providerName: z.string().min(1),
          key: z.string().optional(),
          baseUrl: z.string().url().optional().or(z.literal('')),
        }),
      )
      .mutation(async ({ input }) => {
        return addProviderKey({
          name: input.name,
          providerType: input.providerType,
          providerName: input.providerName,
          key: input.key || undefined,
          baseUrl: input.baseUrl || undefined,
        });
      }),

    // 프로바이더 키 수정 (시스템 관리자 전용)
    update: systemAdminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          key: z.string().optional(),
          baseUrl: z.string().optional(),
          selectedModel: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateProviderKey(id, data);
      }),

    // 프로바이더 키 삭제 (시스템 관리자 전용)
    delete: systemAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteProviderKey(input.id);
      return { success: true };
    }),

    // 연결 테스트 + 모델 목록 조회 (시스템 관리자 전용)
    test: systemAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const result = await testProviderConnection(input.id);
      if (result.success && result.models.length > 0) {
        await updateProviderKey(input.id, { availableModels: result.models });
      }
      return result;
    }),

    // LLM 채팅 테스트 (시스템 관리자 전용)
    chat: systemAdminProcedure
      .input(z.object({ id: z.number(), prompt: z.string().min(1).max(4000) }))
      .mutation(async ({ input }) => {
        return chatWithProvider(input.id, input.prompt);
      }),
  }),
});
