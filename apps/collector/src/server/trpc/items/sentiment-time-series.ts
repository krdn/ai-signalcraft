import { z } from 'zod';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema, SOURCE_ENUM } from './_shared';

/** 일자별 감성 카운트 시계열 (explore StreamChart / CalendarHeatmap용) */
export const sentimentTimeSeries = protectedProcedure
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

    const kstDay = sql<string>`to_char(((${rawItems.time} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;

    const conds = [
      between(rawItems.time, start, end),
      eq(rawItems.subscriptionId, input.subscriptionId),
      sql`${rawItems.sentiment} IS NOT NULL`,
    ];
    if (input.sources?.length) conds.push(inArray(rawItems.source, input.sources));
    if (input.sentiments?.length) conds.push(inArray(rawItems.sentiment, input.sentiments));
    if (input.itemType) conds.push(eq(rawItems.itemType, input.itemType));

    const rows = await ctx.db
      .select({
        date: kstDay,
        sentiment: rawItems.sentiment,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(and(...conds))
      .groupBy(kstDay, rawItems.sentiment);

    // source 정규화는 필요 없음 — 시계열은 source 무관하게 날짜×감성만 집계

    // explore 포맷: [{ date, positive, negative, neutral, total }]
    const buckets = new Map<
      string,
      { date: string; positive: number; negative: number; neutral: number; total: number }
    >();
    for (const r of rows) {
      if (!r.date) continue;
      const key = r.date.slice(0, 10);
      const existing = buckets.get(key) ?? {
        date: key,
        positive: 0,
        negative: 0,
        neutral: 0,
        total: 0,
      };
      if (r.sentiment === 'positive') existing.positive += r.count;
      else if (r.sentiment === 'negative') existing.negative += r.count;
      else if (r.sentiment === 'neutral') existing.neutral += r.count;
      existing.total += r.count;
      buckets.set(key, existing);
    }
    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  });
