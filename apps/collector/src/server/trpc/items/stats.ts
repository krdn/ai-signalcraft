import { z } from 'zod';
import { and, between, eq, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema } from './_shared';

/**
 * 키워드·기간별 수집 현황 요약 — 대시보드/분석 준비 지표.
 */
export const stats = protectedProcedure
  .input(
    z.object({
      keyword: z.string().optional(),
      subscriptionId: z.number().int().positive().optional(),
      dateRange: dateRangeSchema,
    }),
  )
  .query(async ({ ctx, input }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    const conds = [between(rawItems.time, start, end)];
    if (input.subscriptionId) conds.push(eq(rawItems.subscriptionId, input.subscriptionId));

    const bySource = await ctx.db
      .select({
        source: rawItems.source,
        count: sql<number>`count(*)::int`,
        lastFetched: sql<Date>`max(${rawItems.fetchedAt})`,
      })
      .from(rawItems)
      .where(and(...conds))
      .groupBy(rawItems.source);

    const byItemType = await ctx.db
      .select({
        itemType: rawItems.itemType,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(and(...conds))
      .groupBy(rawItems.itemType);

    const bySourceAndType = await ctx.db
      .select({
        source: rawItems.source,
        itemType: rawItems.itemType,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(and(...conds))
      .groupBy(rawItems.source, rawItems.itemType);

    const [totalRow] = await ctx.db
      .select({ total: sql<number>`count(*)::int` })
      .from(rawItems)
      .where(and(...conds));

    return {
      bySource,
      byItemType,
      bySourceAndType,
      totalItems: totalRow?.total ?? 0,
    };
  });
