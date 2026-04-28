import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { protectedProcedure, router } from './init';

export const fetchManipulationBaselinesInput = z.object({
  subscriptionId: z.number().int().positive(),
  referenceEnd: z.string().datetime(),
  referenceStart: z.string().datetime(),
  days: z.number().int().min(7).max(60).default(30),
});

type BaselineRow = { hour: number; counts: number[] };

/**
 * manipulation Phase 2 — temporal baselines.
 *
 * [referenceStart - days, referenceStart) 구간의 raw_items 댓글
 * 시간대(0~23)별·일별 카운트 분포 반환.
 *
 * - timezone: Asia/Seoul (한국 사용자 활동 패턴 기준)
 * - 분석 윈도우([referenceStart, referenceEnd]) 전체를 baseline에서 제외
 *   (자기 자신 비교 방지 — 분석 윈도우가 baseline에 포함되면 KL divergence 왜곡)
 */
export const itemsManipulationRouter = router({
  fetchManipulationBaselines: protectedProcedure
    .input(fetchManipulationBaselinesInput)
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.execute(sql`
        WITH bucket AS (
          SELECT
            EXTRACT(HOUR FROM time AT TIME ZONE 'Asia/Seoul')::int AS hour,
            DATE(time AT TIME ZONE 'Asia/Seoul') AS day,
            COUNT(*)::int AS cnt
          FROM raw_items
          WHERE subscription_id = ${input.subscriptionId}
            AND item_type = 'comment'
            AND time >= ${new Date(input.referenceStart)}::timestamptz - make_interval(days => ${input.days})
            AND time <  ${new Date(input.referenceStart)}::timestamptz
          GROUP BY hour, day
        )
        SELECT hour::int AS hour, array_agg(cnt ORDER BY day) AS counts
        FROM bucket
        GROUP BY hour
        ORDER BY hour
      `);

      const rows = (result.rows ?? result) as BaselineRow[];
      const byHour: Record<string, number[]> = {};
      for (const row of rows) {
        byHour[String(row.hour)] = row.counts;
      }
      return { byHour };
    }),
});
