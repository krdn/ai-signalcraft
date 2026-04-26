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

export const fetchAnalysisPayloadInput = z.object({
  keyword: z.string().trim().min(1),
  dateRange: dateRangeSchema,
  sources: z.array(z.enum(SOURCE_ENUM)).optional(),
  subscriptionId: z.number().int().positive().optional(),
  ragOptions: z
    .object({
      // 각 필드를 독립 optional로 — rag-light처럼 기사는 전체 유지(articleVideoTopK 미지정),
      // 댓글만 RAG 필터(commentTopK 지정)하는 케이스를 지원한다.
      articleVideoTopK: z.number().int().min(1).max(500).optional(),
      commentTopK: z.number().int().min(1).max(500).optional(),
    })
    .optional(),
  maxContentLength: z.number().int().positive().optional(),
});

function selectColumnsFor(t: typeof rawItems) {
  return {
    time: t.time,
    subscriptionId: t.subscriptionId,
    source: t.source,
    sourceId: t.sourceId,
    itemType: t.itemType,
    url: t.url,
    title: t.title,
    content: t.content,
    author: t.author,
    publisher: t.publisher,
    publishedAt: t.publishedAt,
    parentSourceId: t.parentSourceId,
    metrics: t.metrics,
    sentiment: t.sentiment,
    sentimentScore: t.sentimentScore,
    fetchedAt: t.fetchedAt,
    transcript: sql<string | null>`${t.rawPayload}->>'transcript'`.as('transcript'),
    transcriptLang: sql<string | null>`${t.rawPayload}->>'transcriptLang'`.as('transcript_lang'),
    durationSec: sql<number | null>`NULLIF(${t.rawPayload}->>'durationSec', '')::int`.as(
      'duration_sec',
    ),
  };
}

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

    // YouTube 영상 한정으로 raw_payload에서 promote — 분석 측이 transcript ?? content 우선순위로 사용 가능.
    const columns = {
      ...selectColumnsFor(rawItems),
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

  /**
   * 수집 데이터 대시보드용 종합 통계 — 일자별 수집량, 소스×타입 분해.
   * web의 collected-data.ts에서 구독 잡 라우팅 시 호출.
   */
  collectionStats: protectedProcedure
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

  /** 일자별 감성 카운트 시계열 (explore StreamChart / CalendarHeatmap용) */
  sentimentTimeSeries: protectedProcedure
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
    }),

  /** 소스 × 감성 매트릭스 (explore SourceSentimentMatrix용) */
  sentimentBySourceMatrix: protectedProcedure
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
    }),

  /** 확신도 분포 20-bin (explore ScoreHistogram용) */
  scoreDistribution: protectedProcedure
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
    }),

  /** 인게이지먼트 × 감정 산점도 — 댓글 상위 500개 (explore ScatterEngagement용) */
  engagementScatter: protectedProcedure
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
    }),

  /**
   * fetchAnalysisPayload — 분석 측 단축 경로용 통합 RPC.
   *
   * 한 번의 RPC로 두 종류의 데이터를 함께 반환:
   *   - ragSample: RAG 의미검색으로 추린 분석 입력 (source별 분산 호출, dedup 후 합쳐짐)
   *   - fullset:   잡에 속한 전체 풀셋 (linkage 복원용, 본문 포함)
   *
   * 분석 측이 article_jobs/comment_jobs INSERT 시 풀셋이 필요하기 때문에 이 procedure를 추가했다
   * (job 271 사례 — linkage 0건 결함 수정).
   *
   * Phase 2(B-1): sources가 주어지면 source별로 ragSample을 분산 호출해 임베딩 거리 정렬에서 한 source가
   * 독식하는 비율 왜곡을 막는다.
   */
  fetchAnalysisPayload: protectedProcedure
    .input(fetchAnalysisPayloadInput)
    .query(async ({ input, ctx }) => {
      const start = new Date(input.dateRange.start);
      const end = new Date(input.dateRange.end);

      // fullset: 윈도우 + subscriptionId(있으면) + sources(있으면, 'naver-news' 포함 시 'naver-comments'도 추가)
      const fullsetSources =
        input.sources?.length && input.sources.includes('naver-news')
          ? Array.from(new Set([...input.sources, 'naver-comments' as const]))
          : input.sources;
      const fullsetConds = [between(rawItems.time, start, end)];
      if (input.subscriptionId)
        fullsetConds.push(eq(rawItems.subscriptionId, input.subscriptionId));
      if (fullsetSources?.length) fullsetConds.push(inArray(rawItems.source, fullsetSources));

      const baseColumns = selectColumnsFor(rawItems);

      const fullsetRows = (await ctx.db
        .select(baseColumns)
        .from(rawItems)
        .where(and(...fullsetConds))
        .orderBy(desc(rawItems.time))
        .limit(50000)) as Array<Record<string, unknown>>;

      if (input.maxContentLength) truncateContent(fullsetRows, input.maxContentLength);

      // ragSample: ragOptions가 주어지면 source별 분산 RAG, 아니면 빈 배열.
      // articleVideoTopK / commentTopK는 각각 optional — 지정된 itemType에 대해서만 RAG 호출.
      // 미지정 itemType은 ragSample에 포함하지 않고, data-loader 측이 fullset으로 폴백한다.
      const ragSample: Array<Record<string, unknown>> = [];
      if (input.ragOptions) {
        const sources = input.sources?.length
          ? input.sources
          : (['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const);

        const articleTopK = input.ragOptions.articleVideoTopK;
        const commentTopK = input.ragOptions.commentTopK;
        const perSourceArticle = articleTopK
          ? Math.max(1, Math.ceil(articleTopK / sources.length))
          : 0;
        const perSourceComment = commentTopK
          ? Math.max(1, Math.ceil(commentTopK / sources.length))
          : 0;

        if (perSourceArticle > 0 || perSourceComment > 0) {
          const qvec = await embedQuery(input.keyword);
          const distExpr = sql<number>`${rawItems.embedding} <=> ${JSON.stringify(qvec)}::vector`;

          const sourceQueries = sources.flatMap((s) => {
            const articleSrcs = s === 'naver-news' ? ['naver-news'] : [s];
            const commentSrcs = s === 'naver-news' ? ['naver-comments'] : [s];
            const subCond = input.subscriptionId
              ? eq(rawItems.subscriptionId, input.subscriptionId)
              : sql`true`;
            const queries: Promise<Array<Record<string, unknown>>>[] = [];
            if (perSourceArticle > 0) {
              queries.push(
                ctx.db
                  .select({ ...baseColumns, _distance: distExpr })
                  .from(rawItems)
                  .where(
                    and(
                      between(rawItems.time, start, end),
                      subCond,
                      inArray(rawItems.source, articleSrcs),
                      inArray(rawItems.itemType, ['article', 'video']),
                    ),
                  )
                  .orderBy(distExpr)
                  .limit(perSourceArticle) as unknown as Promise<Array<Record<string, unknown>>>,
              );
            }
            if (perSourceComment > 0) {
              queries.push(
                ctx.db
                  .select({ ...baseColumns, _distance: distExpr })
                  .from(rawItems)
                  .where(
                    and(
                      between(rawItems.time, start, end),
                      subCond,
                      inArray(rawItems.source, commentSrcs),
                      eq(rawItems.itemType, 'comment'),
                    ),
                  )
                  .orderBy(distExpr)
                  .limit(perSourceComment) as unknown as Promise<Array<Record<string, unknown>>>,
              );
            }
            return queries;
          });
          const results = await Promise.all(sourceQueries);
          const seen = new Set<string>();
          for (const rows of results) {
            for (const r of rows) {
              const key = `${r.source}::${r.sourceId}::${r.itemType}`;
              if (seen.has(key)) continue;
              seen.add(key);
              ragSample.push(r);
            }
          }
          if (input.maxContentLength) truncateContent(ragSample, input.maxContentLength);
        }
      }

      // collectionMeta — source별 카운트
      const sourceCounts: Record<string, { articles: number; comments: number; videos: number }> =
        {};
      for (const r of fullsetRows) {
        const s = r.source as string;
        if (!sourceCounts[s]) sourceCounts[s] = { articles: 0, comments: 0, videos: 0 };
        if (r.itemType === 'article') sourceCounts[s].articles += 1;
        else if (r.itemType === 'comment') sourceCounts[s].comments += 1;
        else if (r.itemType === 'video') sourceCounts[s].videos += 1;
      }

      return {
        ragSample,
        fullset: fullsetRows,
        collectionMeta: {
          sources: Object.keys(sourceCounts),
          sourceCounts,
          window: { start: input.dateRange.start, end: input.dateRange.end },
          truncated: fullsetRows.length === 50000,
        },
      };
    }),
});
