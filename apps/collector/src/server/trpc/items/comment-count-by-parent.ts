import { z } from 'zod';
import { and, between, eq, inArray, sql } from 'drizzle-orm';
import { rawItems } from '../../../db/schema';
import { protectedProcedure } from '../init';
import { dateRangeSchema, SOURCE_ENUM } from './_shared';

/**
 * parent_source_id 기준 댓글 수 집계.
 *
 * 프론트엔드 피드에서 각 기사/게시글 카드에 "댓글 N개"를 표시하기 위한 용도.
 * metrics.commentCount가 있는 소스(네이버 뉴스, 유튜브)와 달리,
 * 커뮤니티(dcinside/fmkorea/clien)는 수집된 comment 레코드를 집계해야 정확.
 *
 * 네이버 뉴스 fan-out 특수 처리:
 *   기사는 source='naver-news', 댓글은 source='naver-comments'로 저장된다
 *   (executor.ts 참조). 카드 표시 기준에서는 둘 다 "네이버 뉴스"로 보여야 하므로,
 *   응답에서 naver-comments → naver-news로 정규화하고 같은 parentSourceId 기준
 *   카운트를 병합한다. sources 필터도 naver-news 포함 시 naver-comments를 암묵 확장.
 *
 * 무한스크롤 클라이언트 카운트는 아직 로드되지 않은 페이지의 댓글을 누락하므로,
 * 이 엔드포인트로 서버 측 전체 카운트를 한 번에 받아 정확도를 확보한다.
 */
export const commentCountByParent = protectedProcedure
  .input(
    z.object({
      subscriptionId: z.number().int().positive(),
      dateRange: dateRangeSchema,
      sources: z.array(z.enum(SOURCE_ENUM)).optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    const expandedSources = input.sources?.length
      ? Array.from(
          new Set(
            input.sources.includes('naver-news')
              ? [...input.sources, 'naver-comments' as const]
              : input.sources,
          ),
        )
      : undefined;

    const conds = [
      eq(rawItems.subscriptionId, input.subscriptionId),
      between(rawItems.time, start, end),
      eq(rawItems.itemType, 'comment'),
      sql`${rawItems.parentSourceId} IS NOT NULL`,
    ];
    if (expandedSources?.length) conds.push(inArray(rawItems.source, expandedSources));

    const rows = await ctx.db
      .select({
        source: rawItems.source,
        parentSourceId: rawItems.parentSourceId,
        count: sql<number>`count(*)::int`,
      })
      .from(rawItems)
      .where(and(...conds))
      .groupBy(rawItems.source, rawItems.parentSourceId);

    // source 정규화 + 병합: (naver-comments, parent) → (naver-news, parent)로 합산
    const merged = new Map<string, { source: string; parentSourceId: string; count: number }>();
    for (const r of rows) {
      const normalizedSource = r.source === 'naver-comments' ? 'naver-news' : r.source;
      const parentId = r.parentSourceId ?? '';
      const key = `${normalizedSource}::${parentId}`;
      const prev = merged.get(key);
      if (prev) {
        prev.count += r.count;
      } else {
        merged.set(key, { source: normalizedSource, parentSourceId: parentId, count: r.count });
      }
    }
    return Array.from(merged.values());
  });
