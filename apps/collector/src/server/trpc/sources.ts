import { z } from 'zod';
import { pauseSource, resumeSource, listSourceStates } from '../../queue/source-pause';
import { router, protectedProcedure } from './init';

const SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;

export const sourcesRouter = router({
  /**
   * 시스템 전역 소스 일시정지 상태 목록 — active 모두 포함 (resumedAt 필드로 구분).
   */
  list: protectedProcedure.query(async () => {
    return listSourceStates();
  }),

  /**
   * 소스 일시정지 — scanner/triggerNow/backfill의 enqueue를 차단한다.
   * 실행 중 job에는 영향 없음 (cooperative cancel 필요).
   * subscriptions.pause(개별 구독)와 구별되는 시스템 전역 스위치.
   */
  pause: protectedProcedure
    .input(
      z.object({
        source: z.enum(SOURCE_ENUM),
        reason: z.string().max(200).nullable().default(null),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      await pauseSource(input.source, input.reason, actor);
      return { source: input.source, paused: true };
    }),

  resume: protectedProcedure
    .input(z.object({ source: z.enum(SOURCE_ENUM) }))
    .mutation(async ({ input }) => {
      await resumeSource(input.source);
      return { source: input.source, paused: false };
    }),
});
