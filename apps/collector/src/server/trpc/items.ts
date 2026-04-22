import { z } from 'zod';
import { and, asc, between, desc, eq, inArray, lt, sql } from 'drizzle-orm';
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

/**
 * scope:
 *   - all: 기사+영상+댓글 혼재(ORDER BY time DESC, cursor=fetchedAt). 분석 파이프라인 기본값.
 *   - feed: 기사/영상만(ORDER BY COALESCE(published_at, time) DESC). 뷰어 피드 전용.
 *   - comments-for-parent: 특정 parent(source,sourceId)의 댓글만(ORDER BY time ASC). 뷰어 상세 패널.
 *     parent.source='naver-news'일 때 source 조건을 'naver-comments'로 치환한다.
 */
export const queryInput = z.object({
  keyword: z.string().trim().min(1).optional(),
  dateRange: dateRangeSchema,
  sources: z.array(z.enum(SOURCE_ENUM)).optional(),
  itemTypes: z.array(z.enum(ITEM_TYPE_ENUM)).optional(),
  subscriptionId: z.number().int().positive().optional(),
  mode: z.enum(['all', 'rag', 'head']).default('all'),
  scope: z.enum(['all', 'feed', 'comments-for-parent']).default('all'),
  parent: z
    .object({
      source: z.enum(SOURCE_ENUM),
      sourceId: z.string().min(1),
    })
    .optional(),
  ragOptions: z
    .object({
      topK: z.number().int().min(1).max(500).default(50),
      semanticQuery: z.string().min(1),
    })
    .optional(),
  cursor: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(10000).default(500),
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

    if (input.scope === 'comments-for-parent' && !input.parent) {
      throw new Error("scope='comments-for-parent'는 parent(source, sourceId)가 필수입니다");
    }

    const start = new Date(input.dateRange.start);
    const end = new Date(input.dateRange.end);

    // 네이버 뉴스 fan-out: 기사(source='naver-news')와 댓글(source='naver-comments')이
    // 서로 다른 source로 저장된다. scope='all'에서만 sources 필터를 확장 (기존 호환성).
    // scope='feed'/'comments-for-parent'는 scope 자체가 item_type을 제약하므로 확장 불필요.
    const expandedSources =
      input.scope === 'all' && input.sources?.length
        ? Array.from(
            new Set(
              input.sources.includes('naver-news')
                ? [...input.sources, 'naver-comments' as const]
                : input.sources,
            ),
          )
        : input.sources?.length
          ? input.sources
          : undefined;

    const conds = [between(rawItems.time, start, end)];
    if (input.subscriptionId) conds.push(eq(rawItems.subscriptionId, input.subscriptionId));
    if (input.cursor) conds.push(lt(rawItems.fetchedAt, new Date(input.cursor)));

    if (input.scope === 'feed') {
      // 기사/영상 전용. itemTypes 입력은 무시(있으면 feed 정의와 충돌하므로 scope가 우선).
      conds.push(inArray(rawItems.itemType, ['article', 'video']));
      if (expandedSources?.length) conds.push(inArray(rawItems.source, expandedSources));
    } else if (input.scope === 'comments-for-parent') {
      // parent는 위 가드에서 확인됨
      const parent = input.parent!;
      // 네이버는 기사=naver-news, 댓글=naver-comments로 분리 저장. 상세 패널에서 parent.source가
      // 'naver-news'로 들어오면 댓글 테이블 source를 'naver-comments'로 치환해 조회한다.
      const commentSource = parent.source === 'naver-news' ? 'naver-comments' : parent.source;
      conds.push(eq(rawItems.itemType, 'comment'));
      conds.push(eq(rawItems.source, commentSource));
      conds.push(eq(rawItems.parentSourceId, parent.sourceId));
    } else {
      // scope='all' — 기존 호환: sources/itemTypes 필터 그대로 적용
      if (expandedSources?.length) conds.push(inArray(rawItems.source, expandedSources));
      if (input.itemTypes?.length) conds.push(inArray(rawItems.itemType, input.itemTypes));
    }

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
      sentiment: rawItems.sentiment,
      sentimentScore: rawItems.sentimentScore,
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
      // 정렬 규칙:
      //   scope='feed' — COALESCE(published_at, time) DESC로 기사 발행 시각 기준.
      //     cursor가 오면 fetchedAt 기준(무한스크롤 커서와 정렬키가 일치해야 cursor lt가 의미 있음).
      //   scope='comments-for-parent' — 댓글 시간순(ASC), cursor는 fetchedAt 기준.
      //   scope='all' — 기존 동작(mode=head면 publishedAt, 그 외 time / cursor면 fetchedAt).
      let orderByClause;
      if (input.scope === 'comments-for-parent') {
        orderByClause = input.cursor ? asc(rawItems.fetchedAt) : asc(rawItems.time);
      } else if (input.scope === 'feed') {
        orderByClause = input.cursor
          ? desc(rawItems.fetchedAt)
          : desc(sql`COALESCE(${rawItems.publishedAt}, ${rawItems.time})`);
      } else {
        const orderCol =
          input.mode === 'head'
            ? (rawItems.publishedAt ?? rawItems.time)
            : input.cursor
              ? rawItems.fetchedAt
              : rawItems.time;
        orderByClause = desc(orderCol);
      }

      rows = (await ctx.db
        .select(columns)
        .from(rawItems)
        .where(and(...conds))
        .orderBy(orderByClause)
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

    // fan-out 정규화(naver-comments → naver-news)는 제거됨. 응답은 DB 저장 상태 그대로 반환한다.
    // 표시 계층에서 parent 매칭이 필요하면 commentCountByParent가 서버측 정규화된 key를 제공한다.

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

  /** 소스 × 아이템타입 × 감성 건수 집계 (대시보드 소스별 감성 비교용) */
  sentimentBySource: protectedProcedure
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
    }),
});
