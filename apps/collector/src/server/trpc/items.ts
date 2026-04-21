import { z } from 'zod';
import { and, between, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { rawItems } from '../../db/schema';
import { embedQuery } from '../../services/embedding';
import { protectedProcedure, router } from './init';
import { limitCommentsPerParent, truncateContent } from './items-postprocess';

const SOURCE_ENUM = [
  'naver-news',
  'naver-comments',
  'youtube',
  'dcinside',
  'fmkorea',
  'clien',
] as const;
const ITEM_TYPE_ENUM = ['article', 'video', 'comment'] as const;

const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

const queryInput = z.object({
  keyword: z.string().trim().min(1).optional(),
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
  cursor: z.string().datetime().optional(),
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
    if (!input.keyword && !input.subscriptionId) {
      throw new Error('keyword 또는 subscriptionId 중 하나는 필수입니다');
    }

    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    // 네이버 뉴스 fan-out: 기사(source='naver-news')와 댓글(source='naver-comments')이
    // 서로 다른 source로 저장된다. sources 필터가 'naver-news'만 포함해도 해당 기사들의
    // 댓글을 함께 조회할 수 있도록 'naver-comments'를 암묵적으로 확장.
    const expandedSources = input.sources?.length
      ? Array.from(
          new Set(
            input.sources.includes('naver-news')
              ? [...input.sources, 'naver-comments' as const]
              : input.sources,
          ),
        )
      : undefined;

    const conds = [between(rawItems.time, start, end)];
    if (expandedSources?.length) conds.push(inArray(rawItems.source, expandedSources));
    if (input.itemTypes?.length) conds.push(inArray(rawItems.itemType, input.itemTypes));
    if (input.subscriptionId) conds.push(eq(rawItems.subscriptionId, input.subscriptionId));
    if (input.cursor) conds.push(lt(rawItems.fetchedAt, new Date(input.cursor)));

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
        input.mode === 'head'
          ? (rawItems.publishedAt ?? rawItems.time)
          : input.cursor
            ? rawItems.fetchedAt
            : rawItems.time;

      rows = (await ctx.db
        .select(columns)
        .from(rawItems)
        .where(and(...conds))
        .orderBy(desc(orderCol))
        .limit(input.limit)) as Array<Record<string, unknown>>;
    }

    // 분석측 전처리와 분리된 content truncation — 호출자가 명시적으로 요청했을 때만
    if (input.maxContentLength) {
      truncateContent(rows, input.maxContentLength);
    }

    // 댓글 개수 제한 — parent_source_id 기준 그룹핑 후 자르기
    if (input.maxComments && input.itemTypes?.includes('comment')) {
      rows = limitCommentsPerParent(rows, input.maxComments);
    }

    // 네이버 뉴스 fan-out 정규화: 응답에서 'naver-comments' source를 'naver-news'로 표시해
    // 프론트엔드가 기사와 댓글을 동일한 source 네임스페이스에서 매칭할 수 있게 한다.
    // 원본 source는 rawPayload/metadata 쪽에 남지 않으므로 필요 시 itemType으로 구분.
    for (const r of rows) {
      if ((r as Record<string, unknown>).source === 'naver-comments') {
        (r as Record<string, unknown>).source = 'naver-news';
      }
    }

    const lastRow = rows[rows.length - 1] as { fetchedAt?: Date | string } | undefined;
    const lastFetchedAt = lastRow?.fetchedAt;
    const nextCursor =
      rows.length === input.limit && lastFetchedAt instanceof Date
        ? lastFetchedAt.toISOString()
        : typeof lastFetchedAt === 'string' && rows.length === input.limit
          ? lastFetchedAt
          : null;

    return {
      items: rows,
      total: rows.length,
      mode: input.mode,
      nextCursor,
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
    }),

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
  commentCountByParent: protectedProcedure
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
    }),
});
