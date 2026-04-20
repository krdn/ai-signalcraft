import { z } from 'zod';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { collectionRuns, rawItems, runDiagnostics } from '../../db/schema';
import { cancelRun, cancelBySubscription, cancelAll, retryRun } from '../../queue/run-control';
import { collectLayerA } from '../../diagnostics/collect-run';
import { protectedProcedure, router } from './init';

const SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;

export const runsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive().optional(),
        status: z.enum(['running', 'completed', 'blocked', 'failed']).optional(),
        sinceHours: z
          .number()
          .int()
          .positive()
          .max(24 * 30)
          .default(24),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.sinceHours * 3600 * 1000);
      const conds = [gte(collectionRuns.time, since)];
      if (input.subscriptionId) conds.push(eq(collectionRuns.subscriptionId, input.subscriptionId));
      if (input.status) conds.push(eq(collectionRuns.status, input.status));

      const rows = await ctx.db
        .select()
        .from(collectionRuns)
        .where(and(...conds))
        .orderBy(desc(collectionRuns.time))
        .limit(input.limit);
      return rows;
    }),

  itemBreakdown: protectedProcedure
    .input(
      z.object({
        runIds: z.array(z.string().uuid()).min(1).max(1000),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          fetchedFromRun: rawItems.fetchedFromRun,
          source: rawItems.source,
          itemType: rawItems.itemType,
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(inArray(rawItems.fetchedFromRun, input.runIds))
        .groupBy(rawItems.fetchedFromRun, rawItems.source, rawItems.itemType);
      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(collectionRuns)
        .where(eq(collectionRuns.runId, input.runId))
        .orderBy(desc(collectionRuns.time));
      return rows;
    }),

  cancel: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      if (input.source) {
        return cancelRun(input.runId, input.source, input.mode, triggeredBy);
      }
      // source 미지정 — 해당 runId의 모든 running source를 순회 cancel
      const sources = await ctx.db
        .select({ source: collectionRuns.source })
        .from(collectionRuns)
        .where(and(eq(collectionRuns.runId, input.runId), eq(collectionRuns.status, 'running')));
      const results = [];
      for (const s of sources) {
        results.push(await cancelRun(input.runId, s.source, input.mode, triggeredBy));
      }
      return { runId: input.runId, results };
    }),

  cancelBySubscription: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number().int().positive(),
        mode: z.enum(['graceful', 'force']).default('graceful'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      return cancelBySubscription(input.subscriptionId, input.mode, triggeredBy);
    }),

  cancelAll: protectedProcedure
    .input(
      z.object({
        mode: z.enum(['graceful', 'force']).default('graceful'),
        confirm: z.literal('CANCEL_ALL'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      return cancelAll(input.mode, triggeredBy);
    }),

  retry: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const triggeredBy = `user:${(ctx.apiKey ?? 'unknown').slice(0, 8)}`;
      return retryRun(input.runId, input.source, triggeredBy);
    }),

  diagnose: protectedProcedure
    .input(
      z.object({
        runId: z.string().uuid(),
        source: z.enum(SOURCE_ENUM).optional(),
        refresh: z.boolean().default(false),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.refresh && input.source) {
        // 강제 새로고침 — Layer A 재수집 후 신규 row insert
        const layerA = await collectLayerA(input.runId, input.source);
        const [row] = await ctx.db
          .insert(runDiagnostics)
          .values({
            runId: input.runId,
            source: input.source,
            triggeredBy: 'manual',
            layerA,
          })
          .returning();
        return row;
      }
      // 최신 진단 row 조회 — source 옵션으로 필터 가능
      const conds = [eq(runDiagnostics.runId, input.runId)];
      if (input.source) conds.push(eq(runDiagnostics.source, input.source));
      const [row] = await ctx.db
        .select()
        .from(runDiagnostics)
        .where(and(...conds))
        .orderBy(desc(runDiagnostics.createdAt))
        .limit(1);
      return row ?? null;
    }),

  stalled: protectedProcedure
    .input(
      z.object({
        staleMinutes: z.number().int().min(1).max(120).default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const threshold = new Date(Date.now() - input.staleMinutes * 60 * 1000);
      const rows = await ctx.db
        .select()
        .from(collectionRuns)
        .where(
          and(eq(collectionRuns.status, 'running'), sql`${collectionRuns.time} < ${threshold}`),
        )
        .orderBy(desc(collectionRuns.time))
        .limit(50);
      return rows;
    }),
});
