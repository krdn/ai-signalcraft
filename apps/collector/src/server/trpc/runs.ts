import { z } from 'zod';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { collectionRuns, rawItems } from '../../db/schema';
import { protectedProcedure, router } from './init';

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
        runIds: z.array(z.string().uuid()).min(1).max(100),
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
});
