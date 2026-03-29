import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { protectedProcedure, router } from '../init';
import {
  getAllModelSettings,
  upsertModelSetting,
  modelSettings,
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
} from '@ai-signalcraft/core';

export const settingsRouter = router({
  // === 모듈별 AI 모델 설정 ===

  // 12개 모듈의 AI 모델 설정 전체 조회
  list: protectedProcedure.query(async () => {
    return getAllModelSettings();
  }),

  // 모듈의 AI 모델 설정 변경
  update: protectedProcedure
    .input(
      z.object({
        moduleName: z.string().min(1),
        provider: z.enum([
          'anthropic', 'openai', 'gemini', 'ollama',
          'deepseek', 'xai', 'openrouter', 'custom',
        ]),
        model: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return upsertModelSetting(input.moduleName, input.provider, input.model);
    }),

  // 전체 모듈의 AI 모델을 일괄 변경
  bulkUpdate: protectedProcedure
    .input(
      z.object({
        provider: z.enum([
          'anthropic', 'openai', 'gemini', 'ollama',
          'deepseek', 'xai', 'openrouter', 'custom',
        ]),
        model: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const currentSettings = await getAllModelSettings();
      const results = await Promise.all(
        currentSettings.map((s) =>
          upsertModelSetting(s.moduleName, input.provider, input.model),
        ),
      );
      return { updated: results.length };
    }),

  // 모듈의 AI 모델 설정을 기본값으로 복원 (DB 레코드 삭제)
  resetToDefault: protectedProcedure
    .input(z.object({ moduleName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(modelSettings)
        .where(eq(modelSettings.moduleName, input.moduleName));
      return { success: true };
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

    // 프리셋 적용
    applyPreset: protectedProcedure
      .input(z.object({ presetId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        return applyConcurrencyPreset(input.presetId);
      }),

    // 개별 값 커스텀 수정
    update: protectedProcedure
      .input(z.object({
        providerConcurrency: z.record(z.string(), z.number().min(1).max(20)).optional(),
        apiConcurrency: z.number().min(1).max(20).optional(),
        articleBatchSize: z.number().min(1).max(50).optional(),
        commentBatchSize: z.number().min(1).max(200).optional(),
      }))
      .mutation(async ({ input }) => {
        return upsertConcurrencyConfig({ ...input, activePreset: null });
      }),
  }),

  // === 프로바이더 API 키 관리 ===

  providerKeys: router({
    // 전체 프로바이더 키 목록
    list: protectedProcedure.query(async () => {
      return getAllProviderKeys();
    }),

    // 프로바이더 키 추가
    add: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          providerType: z.enum([
            'openai', 'anthropic', 'gemini', 'ollama',
            'deepseek', 'xai', 'openrouter', 'custom',
          ]),
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

    // 프로바이더 키 수정
    update: protectedProcedure
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

    // 프로바이더 키 삭제
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteProviderKey(input.id);
        return { success: true };
      }),

    // 연결 테스트 + 모델 목록 조회 (성공 시 availableModels를 DB에 저장)
    test: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const result = await testProviderConnection(input.id);
        if (result.success && result.models.length > 0) {
          await updateProviderKey(input.id, { availableModels: result.models });
        }
        return result;
      }),

    // LLM 채팅 테스트 (Playground)
    chat: protectedProcedure
      .input(z.object({ id: z.number(), prompt: z.string().min(1).max(4000) }))
      .mutation(async ({ input }) => {
        return chatWithProvider(input.id, input.prompt);
      }),
  }),
});
