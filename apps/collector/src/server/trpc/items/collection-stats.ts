import { z } from 'zod';
import { and, between, eq, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema } from './_shared';

/**
 * 수집 데이터 대시보드용 종합 통계 — 일자별 수집량, 소스×타입 분해.
 * web의 collected-data.ts에서 구독 잡 라우팅 시 호출.
 */
export const collectionStats = protectedProcedure
  .input(
    z.object({
      subscriptionId: z.number().int().positive(),
      dateRange: dateRangeSchema,
    }),
  )
  .query(async ({ ctx, input }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    const conds = [
      between(rawItems.time, start, end),
      eq(rawItems.subscriptionId, input.subscriptionId),
    ];

    // KST 일자 변환 — web DB와 동일한 방식 (UTC → KST)
    const kstDay = (col: typeof rawItems.time) =>
      sql<string>`to_char(((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;

    const [bySourceAndType, articleDaily, commentDaily, videoDaily] = await Promise.all([
      ctx.db
        .select({
          source: rawItems.source,
          itemType: rawItems.itemType,
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(and(...conds))
        .groupBy(rawItems.source, rawItems.itemType),
      ctx.db
        .select({
          date: kstDay(rawItems.time),
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(and(...conds, eq(rawItems.itemType, 'article')))
        .groupBy(kstDay(rawItems.time)),
      ctx.db
        .select({
          date: kstDay(rawItems.time),
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(and(...conds, eq(rawItems.itemType, 'comment')))
        .groupBy(kstDay(rawItems.time)),
      ctx.db
        .select({
          date: kstDay(rawItems.time),
          count: sql<number>`count(*)::int`,
        })
        .from(rawItems)
        .where(and(...conds, eq(rawItems.itemType, 'video')))
        .groupBy(kstDay(rawItems.time)),
    ]);

    return {
      bySourceAndType,
      articleDaily,
      commentDaily,
      videoDaily,
    };
  });
