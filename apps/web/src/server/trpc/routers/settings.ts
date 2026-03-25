import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { protectedProcedure, router } from '../init';
import { getAllModelSettings, upsertModelSetting, modelSettings } from '@ai-signalcraft/core';

export const settingsRouter = router({
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
});
