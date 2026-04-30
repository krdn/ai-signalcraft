import { z } from 'zod';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema, SOURCE_ENUM } from './_shared';

/** 소스 × 감성 매트릭스 (explore SourceSentimentMatrix용) */
export const sentimentBySourceMatrix = protectedProcedure
  .input(
    z.object({
      subscriptionId: z.number().int().positive(),
      dateRange: dateRangeSchema,
      sources: z.array(z.enum(SOURCE_ENUM)).optional(),
      sentiments: z.array(z.enum(['positive', 'negative', 'neutral'])).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    const conds = [
      between(rawItems.time, start, end),
      eq(rawItems.subscriptionId, input.subscriptionId),
    ];
    if (input.sources?.length) conds.push(inArray(rawItems.source, input.sources));
    if (input.sentiments?.length) conds.push(inArray(rawItems.sentiment, input.sentiments));

    const rows = await ctx.db
      .select({
        source: rawItems.source,
        sentiment: rawItems.sentiment,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(and(...conds, sql`${rawItems.sentiment} IS NOT NULL`))
      .groupBy(rawItems.source, rawItems.sentiment);

    // source 정규화: naver-comments → naver-news
    const bucket = new Map<string, { source: string; sentiment: string; count: number }>();
    for (const r of rows) {
      const normalizedSource = r.source === 'naver-comments' ? 'naver-news' : r.source;
      const s = r.sentiment ?? 'neutral';
      const k = `${normalizedSource}::${s}`;
      const prev = bucket.get(k);
      if (prev) prev.count += r.count;
      else bucket.set(k, { source: normalizedSource, sentiment: s, count: r.count });
    }
    return Array.from(bucket.values()).sort((a, b) => b.count - a.count);
  });
