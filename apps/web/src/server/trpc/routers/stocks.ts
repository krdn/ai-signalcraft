import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { analyzeTicker, stockAnalyses } from '@ai-signalcraft/core';
import { protectedProcedure, router } from '../init';

export const stocksRouter = router({
  analyze: protectedProcedure
    .input(
      z.object({
        ticker: z
          .string()
          .trim()
          .min(1)
          .max(10)
          .regex(/^[A-Za-z.-]+$/, '티커는 영문/마침표/하이픈만 허용됩니다'),
        depth: z.enum(['full', 'lite']).default('lite'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticker = input.ticker.toUpperCase();
      const result = await analyzeTicker(ticker, { depth: input.depth });

      if (result.meta.completed === 0) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `${ticker} 분석에 실패했습니다 (모든 관점 실패). 잠시 후 다시 시도하세요.`,
        });
      }

      const [row] = await ctx.db
        .insert(stockAnalyses)
        .values({
          requestedBy: ctx.userId,
          ticker,
          depth: input.depth,
          asOf: new Date(result.asOf),
          result,
          costUsd: result.meta.totalCostUsd != null ? String(result.meta.totalCostUsd) : null,
        })
        .returning({ id: stockAnalyses.id });

      return { id: row.id, ...result };
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: stockAnalyses.id,
          ticker: stockAnalyses.ticker,
          depth: stockAnalyses.depth,
          requestedBy: stockAnalyses.requestedBy,
          asOf: stockAnalyses.asOf,
          createdAt: stockAnalyses.createdAt,
        })
        .from(stockAnalyses)
        .orderBy(desc(stockAnalyses.createdAt))
        .limit(input?.limit ?? 20);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(stockAnalyses)
        .where(eq(stockAnalyses.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '분석 이력을 찾을 수 없습니다' });
      }
      return row;
    }),
});
