import { z } from 'zod';
import { and, between, desc, eq, inArray, sql } from 'drizzle-orm';
import { rawItems } from '../../db/schema';
import { embedQuery } from '../../services/embedding';
import { protectedProcedure, router } from './init';

const SOURCE_ENUM = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;
const ITEM_TYPE_ENUM = ['article', 'video', 'comment'] as const;

const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

const queryInput = z.object({
  keyword: z.string().trim().min(1),
  dateRange: dateRangeSchema,
  sources: z.array(z.enum(SOURCE_ENUM)).optional(),
  itemTypes: z.array(z.enum(ITEM_TYPE_ENUM)).optional(),
  subscriptionId: z.number().int().positive().optional(),
  mode: z.enum(['all', 'rag', 'head']).default('all'),
  ragOptions: z
    .object({
      topK: z.number().int().min(1).max(500).default(50),
      semanticQuery: z.string().min(1),
    })
    .optional(),
  limit: z.number().int().min(1).max(2000).default(500),
  maxContentLength: z.number().int().positive().optional(),
  maxComments: z.number().int().nonnegative().optional(),
  includeEmbeddings: z.boolean().default(false),
});

/**
 * 분석 시스템이 호출하는 핵심 API.
 *
 * mode:
 *   - all:  dateRange 내 전부 (limit 내)
 *   - head: publishedAt 최신순 상위 limit개
 *   - rag:  ragOptions.semanticQuery로 임베딩 → cosine 유사도 topK
 *
 * maxContentLength / maxComments는 분석측에서 호출 시 상황에 맞게 지정.
 * (기존 하드코딩 MAX_ARTICLE_CONTENT_LENGTH=500, MAX_COMMENTS=500 대체)
 */
export const itemsRouter = router({
  query: protectedProcedure.input(queryInput).query(async ({ ctx, input }) => {
    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    const conds = [between(rawItems.time, start, end)];
    if (input.sources?.length) conds.push(inArray(rawItems.source, input.sources));
    if (input.itemTypes?.length) conds.push(inArray(rawItems.itemType, input.itemTypes));
    if (input.subscriptionId) conds.push(eq(rawItems.subscriptionId, input.subscriptionId));

    const columns = {
      time: rawItems.time,
      subscriptionId: rawItems.subscriptionId,
      source: rawItems.source,
      sourceId: rawItems.sourceId,
      itemType: rawItems.itemType,
      url: rawItems.url,
      title: rawItems.title,
      content: rawItems.content,
      author: rawItems.author,
      publisher: rawItems.publisher,
      publishedAt: rawItems.publishedAt,
      parentSourceId: rawItems.parentSourceId,
      metrics: rawItems.metrics,
      fetchedAt: rawItems.fetchedAt,
      ...(input.includeEmbeddings ? { embedding: rawItems.embedding } : {}),
    };

    let rows: Array<Record<string, unknown>>;

    if (input.mode === 'rag') {
      if (!input.ragOptions) {
        throw new Error('rag mode requires ragOptions');
      }
      const qvec = await embedQuery(input.ragOptions.semanticQuery);
      // pgvector cosine distance: 1 - cosine_similarity. 작을수록 유사.
      const distExpr = sql<number>`${rawItems.embedding} <=> ${JSON.stringify(qvec)}::vector`;

      rows = (await ctx.db
        .select({ ...columns, _distance: distExpr })
        .from(rawItems)
        .where(and(...conds))
        .orderBy(distExpr)
        .limit(Math.min(input.ragOptions.topK, input.limit))) as Array<Record<string, unknown>>;
    } else {
      const orderCol =
        input.mode === 'head' ? (rawItems.publishedAt ?? rawItems.time) : rawItems.time;
      rows = (await ctx.db
        .select(columns)
        .from(rawItems)
        .where(and(...conds))
        .orderBy(desc(orderCol))
        .limit(input.limit)) as Array<Record<string, unknown>>;
    }

    // 분석측 전처리와 분리된 content truncation — 호출자가 명시적으로 요청했을 때만
    if (input.maxContentLength) {
      for (const row of rows) {
        const c = row.content;
        if (typeof c === 'string' && c.length > input.maxContentLength) {
          row.content = c.slice(0, input.maxContentLength);
        }
      }
    }

    // 댓글 개수 제한 — parent_source_id 기준 그룹핑 후 자르기
    if (input.maxComments && input.itemTypes?.includes('comment')) {
      const byParent = new Map<string, number>();
      rows = rows.filter((r) => {
        if (r.itemType !== 'comment') return true;
        const key = (r.parentSourceId as string) ?? '';
        const count = byParent.get(key) ?? 0;
        if (count >= input.maxComments!) return false;
        byParent.set(key, count + 1);
        return true;
      });
    }

    return {
      items: rows,
      total: rows.length,
      mode: input.mode,
    };
  }),

  /**
   * 키워드·기간별 수집 현황 요약 — 대시보드/분석 준비 지표.
   */
  stats: protectedProcedure
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

      const [totalRow] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(rawItems)
        .where(and(...conds));

      return {
        bySource,
        totalItems: totalRow?.total ?? 0,
      };
    }),
});
