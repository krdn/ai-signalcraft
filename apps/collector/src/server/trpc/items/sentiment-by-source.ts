import { z } from 'zod';
import { and, between, eq, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema } from './_shared';

/** 소스 × 아이템타입 × 감성 건수 집계 (대시보드 소스별 감성 비교용) */
export const sentimentBySource = protectedProcedure
  .input(
    z.object({
      dateRange: dateRangeSchema,
      subscriptionId: z.number().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    const conds = [between(rawItems.time, start, end)];
    if (input.subscriptionId) conds.push(eq(rawItems.subscriptionId, input.subscriptionId));

    const rows = await ctx.db
      .select({
        source: rawItems.source,
        itemType: rawItems.itemType,
        sentiment: rawItems.sentiment,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(and(...conds, sql`${rawItems.sentiment} IS NOT NULL`))
      .groupBy(rawItems.source, rawItems.itemType, rawItems.sentiment);

    // source 정규화: naver-comments → naver-news
    const articles: Array<{ source: string; sentiment: string; count: number }> = [];
    const comments: Array<{ source: string; sentiment: string; count: number }> = [];

    for (const r of rows) {
      const normalizedSource = r.source === 'naver-comments' ? 'naver-news' : r.source;
      const entry = {
        source: normalizedSource,
        sentiment: r.sentiment ?? 'neutral',
        count: r.count,
      };
      if (r.itemType === 'comment') {
        comments.push(entry);
      } else {
        articles.push(entry);
      }
    }

    return { articles, comments };
  });
