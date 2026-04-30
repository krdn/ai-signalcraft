import { z } from 'zod';
import { and, between, desc, eq, inArray, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema, SOURCE_ENUM } from './_shared';

/** 인게이지먼트 × 감정 산점도 — 댓글 상위 500개 (explore ScatterEngagement용) */
export const engagementScatter = protectedProcedure
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
      eq(rawItems.itemType, 'comment'),
      sql`${rawItems.sentiment} IS NOT NULL`,
      sql`${rawItems.sentimentScore} IS NOT NULL`,
    ];
    if (input.sources?.length) conds.push(inArray(rawItems.source, input.sources));
    if (input.sentiments?.length) conds.push(inArray(rawItems.sentiment, input.sentiments));

    // metrics->>'likeCount'를 정렬 키로 사용
    const rows = await ctx.db
      .select({
        sourceId: rawItems.sourceId,
        source: rawItems.source,
        likeCount: sql<number>`coalesce((${rawItems.metrics}->>'likeCount')::int, 0)`,
        sentiment: rawItems.sentiment,
        sentimentScore: rawItems.sentimentScore,
        content: rawItems.content,
        parentSourceId: rawItems.parentSourceId,
        publishedAt: rawItems.publishedAt,
      })
      .from(rawItems)
      .where(and(...conds))
      .orderBy(desc(sql`coalesce((${rawItems.metrics}->>'likeCount')::int, 0)`))
      .limit(500);

    return rows.map((r, idx) => ({
      id: idx,
      source: r.source,
      likeCount: r.likeCount ?? 0,
      sentiment: r.sentiment ?? 'neutral',
      sentimentScore: r.sentimentScore ?? 0,
      contentPreview: (r.content ?? '').slice(0, 240),
      articleId: null as number | null,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    }));
  });
