import { z } from 'zod';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema, SOURCE_ENUM } from './_shared';

/** 확신도 분포 20-bin (explore ScoreHistogram용) */
export const scoreDistribution = protectedProcedure
  .input(
    z.object({
      subscriptionId: z.number().int().positive(),
      dateRange: dateRangeSchema,
      sources: z.array(z.enum(SOURCE_ENUM)).optional(),
      sentiments: z.array(z.enum(['positive', 'negative', 'neutral'])).optional(),
      itemType: z.enum(['article', 'video', 'comment']).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    const conds = [
      between(rawItems.time, start, end),
      eq(rawItems.subscriptionId, input.subscriptionId),
      sql`${rawItems.sentimentScore} IS NOT NULL`,
    ];
    if (input.sources?.length) conds.push(inArray(rawItems.source, input.sources));
    if (input.sentiments?.length) conds.push(inArray(rawItems.sentiment, input.sentiments));
    if (input.itemType) conds.push(eq(rawItems.itemType, input.itemType));

    const rows = await ctx.db
      .select({
        sentimentScore: rawItems.sentimentScore,
        sentiment: rawItems.sentiment,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(and(...conds))
      .groupBy(rawItems.sentimentScore, rawItems.sentiment);

    const BIN_COUNT = 20;
    const bins = Array.from({ length: BIN_COUNT }, (_, i) => ({
      bin: i,
      binStart: i / BIN_COUNT,
      binEnd: (i + 1) / BIN_COUNT,
      positive: 0,
      negative: 0,
      neutral: 0,
    }));

    for (const r of rows) {
      if (r.sentimentScore == null) continue;
      const clamped = Math.min(Math.max(r.sentimentScore, 0), 0.9999);
      const idx = Math.min(BIN_COUNT - 1, Math.floor(clamped * BIN_COUNT));
      const target = bins[idx];
      if (!target) continue;
      if (r.sentiment === 'positive') target.positive += r.count;
      else if (r.sentiment === 'negative') target.negative += r.count;
      else if (r.sentiment === 'neutral') target.neutral += r.count;
    }

    return bins;
  });
