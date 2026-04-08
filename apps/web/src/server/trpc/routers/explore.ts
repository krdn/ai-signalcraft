import { z } from 'zod';
import {
  articles,
  comments,
  collectionJobs,
  articleJobs,
  commentJobs,
  analysisResults,
} from '@ai-signalcraft/core';
import { eq, and, desc, sql, inArray, gte, isNotNull, type SQL } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../init';
import { buildJobCondition } from '../shared/query-helpers';

// 공통 입력 스키마 — 모든 procedure 공유
const exploreInput = z.object({
  jobId: z.number(),
  sources: z.array(z.string()).optional(),
  sentiments: z.array(z.enum(['positive', 'negative', 'neutral'])).optional(),
  minScore: z.number().min(0).max(1).optional(),
  itemType: z.enum(['articles', 'comments', 'both']).default('both'),
});

type ExploreInput = z.infer<typeof exploreInput>;

/**
 * jobId 권한 검증 — 기존 collected-data 라우터와 동일한 패턴
 */
async function verifyJobAccess(
  ctx: {
    db: typeof import('@ai-signalcraft/core').db;
    teamId: number | null;
    userId: string;
    defaultFilterMode: 'mine' | 'team';
  },
  jobId: number,
) {
  const [job] = await ctx.db
    .select()
    .from(collectionJobs)
    .where(
      buildJobCondition({
        jobId,
        teamId: ctx.teamId,
        userId: ctx.userId,
        filterMode: ctx.defaultFilterMode,
      }),
    );
  if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
  return job;
}

/**
 * 기사 공통 조건 빌더
 */
function buildArticleFilters(input: ExploreInput): SQL[] {
  const filters: SQL[] = [eq(articleJobs.jobId, input.jobId)];
  if (input.sources && input.sources.length > 0) {
    filters.push(inArray(articles.source, input.sources));
  }
  if (input.sentiments && input.sentiments.length > 0) {
    filters.push(inArray(articles.sentiment, input.sentiments));
  }
  if (input.minScore != null && input.minScore > 0) {
    filters.push(gte(articles.sentimentScore, input.minScore));
  }
  return filters;
}

/**
 * 댓글 공통 조건 빌더
 */
function buildCommentFilters(input: ExploreInput): SQL[] {
  const filters: SQL[] = [eq(commentJobs.jobId, input.jobId)];
  if (input.sources && input.sources.length > 0) {
    filters.push(inArray(comments.source, input.sources));
  }
  if (input.sentiments && input.sentiments.length > 0) {
    filters.push(inArray(comments.sentiment, input.sentiments));
  }
  if (input.minScore != null && input.minScore > 0) {
    filters.push(gte(comments.sentimentScore, input.minScore));
  }
  return filters;
}

type TimeSeriesRow = {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
};

export const exploreRouter = router({
  /**
   * V1/V2 — 일자별 감정 카운트 시계열
   * 반환: [{ date: 'YYYY-MM-DD', positive, negative, neutral, total }]
   */
  getSentimentTimeSeries: protectedProcedure.input(exploreInput).query(async ({ input, ctx }) => {
    await verifyJobAccess(ctx, input.jobId);

    const needArticles = input.itemType === 'articles' || input.itemType === 'both';
    const needComments = input.itemType === 'comments' || input.itemType === 'both';

    const buckets = new Map<string, TimeSeriesRow>();
    const addRow = (date: string, sentiment: string | null, count: number) => {
      if (!date) return;
      const key = date.slice(0, 10); // YYYY-MM-DD
      const existing = buckets.get(key) ?? {
        date: key,
        positive: 0,
        negative: 0,
        neutral: 0,
        total: 0,
      };
      if (sentiment === 'positive') existing.positive += count;
      else if (sentiment === 'negative') existing.negative += count;
      else if (sentiment === 'neutral') existing.neutral += count;
      existing.total += count;
      buckets.set(key, existing);
    };

    if (needArticles) {
      const rows = await ctx.db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${articles.publishedAt}), 'YYYY-MM-DD')`.as(
            'date',
          ),
          sentiment: articles.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(articles)
        .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
        .where(and(...buildArticleFilters(input), isNotNull(articles.publishedAt)))
        .groupBy(sql`date_trunc('day', ${articles.publishedAt})`, articles.sentiment);
      for (const r of rows) addRow(r.date, r.sentiment, Number(r.count));
    }

    if (needComments) {
      const rows = await ctx.db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${comments.publishedAt}), 'YYYY-MM-DD')`.as(
            'date',
          ),
          sentiment: comments.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(comments)
        .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
        .where(and(...buildCommentFilters(input), isNotNull(comments.publishedAt)))
        .groupBy(sql`date_trunc('day', ${comments.publishedAt})`, comments.sentiment);
      for (const r of rows) addRow(r.date, r.sentiment, Number(r.count));
    }

    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  }),

  /**
   * V4 — 소스 × 감정 매트릭스
   * 반환: [{ source, sentiment, count }]
   */
  getSentimentBySource: protectedProcedure.input(exploreInput).query(async ({ input, ctx }) => {
    await verifyJobAccess(ctx, input.jobId);

    const needArticles = input.itemType === 'articles' || input.itemType === 'both';
    const needComments = input.itemType === 'comments' || input.itemType === 'both';
    const bucket = new Map<string, { source: string; sentiment: string; count: number }>();

    const merge = (source: string, sentiment: string | null, count: number) => {
      const s = sentiment ?? 'neutral';
      const k = `${source}::${s}`;
      const prev = bucket.get(k);
      if (prev) prev.count += count;
      else bucket.set(k, { source, sentiment: s, count });
    };

    if (needArticles) {
      const rows = await ctx.db
        .select({
          source: articles.source,
          sentiment: articles.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(articles)
        .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
        .where(and(...buildArticleFilters(input)))
        .groupBy(articles.source, articles.sentiment);
      for (const r of rows) merge(r.source, r.sentiment, Number(r.count));
    }

    if (needComments) {
      const rows = await ctx.db
        .select({
          source: comments.source,
          sentiment: comments.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(comments)
        .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
        .where(and(...buildCommentFilters(input)))
        .groupBy(comments.source, comments.sentiment);
      for (const r of rows) merge(r.source, r.sentiment, Number(r.count));
    }

    return Array.from(bucket.values()).sort((a, b) => b.count - a.count);
  }),

  /**
   * V5 — BERT 확신도 분포 (20 bins)
   * 반환: [{ bin: 0..19, binStart, binEnd, positive, negative, neutral }]
   */
  getScoreDistribution: protectedProcedure.input(exploreInput).query(async ({ input, ctx }) => {
    await verifyJobAccess(ctx, input.jobId);

    const BIN_COUNT = 20;
    const needArticles = input.itemType === 'articles' || input.itemType === 'both';
    const needComments = input.itemType === 'comments' || input.itemType === 'both';

    const bins: Array<{
      bin: number;
      binStart: number;
      binEnd: number;
      positive: number;
      negative: number;
      neutral: number;
    }> = Array.from({ length: BIN_COUNT }, (_, i) => ({
      bin: i,
      binStart: i / BIN_COUNT,
      binEnd: (i + 1) / BIN_COUNT,
      positive: 0,
      negative: 0,
      neutral: 0,
    }));

    const addToBin = (score: number | null, sentiment: string | null, count: number) => {
      if (score == null) return;
      const clamped = Math.min(Math.max(score, 0), 0.9999);
      const idx = Math.min(BIN_COUNT - 1, Math.floor(clamped * BIN_COUNT));
      const target = bins[idx];
      if (!target) return;
      if (sentiment === 'positive') target.positive += count;
      else if (sentiment === 'negative') target.negative += count;
      else if (sentiment === 'neutral') target.neutral += count;
    };

    if (needArticles) {
      const rows = await ctx.db
        .select({
          score: articles.sentimentScore,
          sentiment: articles.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(articles)
        .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
        .where(and(...buildArticleFilters(input), isNotNull(articles.sentimentScore)))
        .groupBy(articles.sentimentScore, articles.sentiment);
      for (const r of rows) addToBin(r.score, r.sentiment, Number(r.count));
    }

    if (needComments) {
      const rows = await ctx.db
        .select({
          score: comments.sentimentScore,
          sentiment: comments.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(comments)
        .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
        .where(and(...buildCommentFilters(input), isNotNull(comments.sentimentScore)))
        .groupBy(comments.sentimentScore, comments.sentiment);
      for (const r of rows) addToBin(r.score, r.sentiment, Number(r.count));
    }

    return bins;
  }),

  /**
   * V3 — 인게이지먼트 × 감정 산점도 (댓글 전용, 상위 500개)
   */
  getEngagementScatter: protectedProcedure.input(exploreInput).query(async ({ input, ctx }) => {
    await verifyJobAccess(ctx, input.jobId);

    const rows = await ctx.db
      .select({
        id: comments.id,
        source: comments.source,
        likeCount: comments.likeCount,
        sentiment: comments.sentiment,
        sentimentScore: comments.sentimentScore,
        content: comments.content,
        articleId: comments.articleId,
        publishedAt: comments.publishedAt,
      })
      .from(comments)
      .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
      .where(
        and(
          ...buildCommentFilters(input),
          isNotNull(comments.sentiment),
          isNotNull(comments.sentimentScore),
        ),
      )
      .orderBy(desc(comments.likeCount))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      likeCount: r.likeCount ?? 0,
      sentiment: r.sentiment ?? 'neutral',
      sentimentScore: r.sentimentScore ?? 0,
      contentPreview: (r.content ?? '').slice(0, 240),
      articleId: r.articleId,
      publishedAt: r.publishedAt?.toISOString() ?? null,
    }));
  }),

  /**
   * V6 — 키워드 × 감정 트리맵 (sentiment-framing.topKeywords 재활용)
   */
  getKeywordSentiment: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      await verifyJobAccess(ctx, input.jobId);

      const [row] = await ctx.db
        .select({ result: analysisResults.result })
        .from(analysisResults)
        .where(
          and(
            eq(analysisResults.jobId, input.jobId),
            eq(analysisResults.module, 'sentiment-framing'),
          ),
        )
        .limit(1);

      const raw = row?.result as { topKeywords?: unknown } | null;
      const topKeywords = Array.isArray(raw?.topKeywords)
        ? (raw.topKeywords as Array<{ keyword: string; count: number; sentiment: string }>)
        : [];

      return topKeywords
        .filter((k) => k && typeof k.keyword === 'string' && typeof k.count === 'number')
        .map((k) => ({
          keyword: k.keyword,
          count: k.count,
          sentiment: ['positive', 'negative', 'neutral'].includes(k.sentiment)
            ? k.sentiment
            : 'neutral',
        }));
    }),
});
