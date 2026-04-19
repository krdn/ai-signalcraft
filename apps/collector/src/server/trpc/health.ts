import { z } from 'zod';
import { and, gte, sql } from 'drizzle-orm';
import { collectionRuns, fetchErrors } from '../../db/schema';
import { protectedProcedure, router } from './init';

/**
 * 소스별 차단 상태 및 에러 요약 — 운영 대시보드 / 수동 트리거 UI에서 활용.
 */
export const healthRouter = router({
  errorTimeline: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(30).default(7),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 24 * 3600 * 1000);

      const entries = await ctx.db
        .select({
          date: sql<string>`date_trunc('day', ${fetchErrors.time})::date::text`,
          errorType: fetchErrors.errorType,
          count: sql<number>`count(*)::int`,
        })
        .from(fetchErrors)
        .where(gte(fetchErrors.time, since))
        .groupBy(sql`date_trunc('day', ${fetchErrors.time})::date`, fetchErrors.errorType)
        .orderBy(sql`date_trunc('day', ${fetchErrors.time})::date`);

      return { days: input.days, entries };
    }),

  sourceStatus: protectedProcedure
    .input(
      z
        .object({
          sinceHours: z
            .number()
            .int()
            .positive()
            .max(24 * 7)
            .default(24),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - (input?.sinceHours ?? 24) * 3600 * 1000);

      const runs = await ctx.db
        .select({
          source: collectionRuns.source,
          total: sql<number>`count(*)::int`,
          completed: sql<number>`sum(case when status='completed' then 1 else 0 end)::int`,
          blocked: sql<number>`sum(case when status='blocked' then 1 else 0 end)::int`,
          failed: sql<number>`sum(case when status='failed' then 1 else 0 end)::int`,
          avgDurationMs: sql<number>`coalesce(avg(duration_ms),0)::int`,
        })
        .from(collectionRuns)
        .where(and(gte(collectionRuns.time, since)))
        .groupBy(collectionRuns.source);

      const errors = await ctx.db
        .select({
          source: fetchErrors.source,
          errorType: fetchErrors.errorType,
          count: sql<number>`count(*)::int`,
        })
        .from(fetchErrors)
        .where(gte(fetchErrors.time, since))
        .groupBy(fetchErrors.source, fetchErrors.errorType);

      return {
        windowHours: input?.sinceHours ?? 24,
        runs,
        errors,
      };
    }),
});
