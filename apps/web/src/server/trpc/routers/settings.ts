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
        provider: z.enum(['anthropic', 'openai']),
        model: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return upsertModelSetting(input.moduleName, input.provider, input.model);
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

    // 연결 테스트 + 모델 목록 조회
    test: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return testProviderConnection(input.id);
      }),
  }),
});
