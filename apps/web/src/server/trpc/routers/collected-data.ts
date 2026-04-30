import { z } from 'zod';
import {
  articles,
  videos,
  comments,
  collectionJobs,
  articleJobs,
  videoJobs,
  commentJobs,
  DEFAULT_COLLECTION_LIMITS,
  applyPerDayInflation,
  computeDayCount,
  getCollectorClient,
} from '@ai-signalcraft/core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../init';
import { buildJobCondition } from '../shared/query-helpers';
import { COLLECTOR_SOURCE_ENUM } from '@/lib/collector-sources';

type JobWithOptions = {
  id: number;
  keyword: string;
  startDate: Date;
  endDate: Date;
  status: string;
  limits: unknown;
  options: unknown;
  appliedPreset: unknown;
  createdAt: Date;
  progress: unknown;
};

function isCollectorJob(job: JobWithOptions): boolean {
  const opts = (job.options as Record<string, unknown>) || {};
  return !!opts.useCollectorLoader || !!opts.subscriptionId;
}

function getSubscriptionId(job: JobWithOptions): number | undefined {
  const opts = (job.options as Record<string, unknown>) || {};
  return opts.subscriptionId as number | undefined;
}

export const collectedDataRouter = router({
  // 수집된 기사 목록 조회 (조인 테이블 경유 / 구독 잡은 collector API 경유)
  getArticles: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        source: z.enum(COLLECTOR_SOURCE_ENUM).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      // 팀 소속 확인
      const [job] = await ctx.db
        .select()
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode: ctx.defaultFilterMode,
          }),
        );
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      // 구독 잡: collector query API로 라우팅
      if (isCollectorJob(job as JobWithOptions)) {
        const subscriptionId = getSubscriptionId(job as JobWithOptions);
        if (!subscriptionId)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'subscriptionId 없음' });
        try {
          const client = getCollectorClient();
          const collectorItems = await client.items.query.query({
            subscriptionId,
            dateRange: {
              start: job.startDate.toISOString(),
              end: job.endDate.toISOString(),
            },
            scope: 'feed',
            itemTypes: ['article'],
            ...(input.source ? { sources: [input.source] } : {}),
            limit: input.perPage,
          });

          const items = collectorItems.items.map((item: Record<string, unknown>) => ({
            id: 0,
            source: item.source as string,
            sourceId: item.sourceId as string,
            url: item.url as string,
            title: item.title as string,
            content: item.content as string,
            author: item.author as string,
            publisher: item.publisher as string,
            publishedAt: item.publishedAt ? new Date(item.publishedAt as string) : null,
            collectedAt: item.fetchedAt ? new Date(item.fetchedAt as string) : null,
            sentiment: item.sentiment as string | null,
            sentimentScore: item.sentimentScore as number | null,
            summary: null,
            commentCount: 0,
          }));

          return {
            items,
            total: collectorItems.total,
            page: input.page,
            perPage: input.perPage,
            totalPages: Math.ceil(collectorItems.total / input.perPage),
          };
        } catch (err) {
          console.error('[collectedData] collector articles query 실패:', err);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'collector 기사 조회 실패',
          });
        }
      }

      const offset = (input.page - 1) * input.perPage;

      // 댓글 수 서브쿼리 (조인 테이블 경유)
      const commentCountSq = ctx.db
        .select({
          articleId: comments.articleId,
          count: sql<number>`count(*)::int`.as('comment_count'),
        })
        .from(comments)
        .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
        .where(eq(commentJobs.jobId, input.jobId))
        .groupBy(comments.articleId)
        .as('comment_counts');

      const [rows, countResult] = await Promise.all([
        ctx.db
          .select({
            id: articles.id,
            source: articles.source,
            sourceId: articles.sourceId,
            url: articles.url,
            title: articles.title,
            content: articles.content,
            author: articles.author,
            publisher: articles.publisher,
            publishedAt: articles.publishedAt,
            collectedAt: articles.collectedAt,
            sentiment: articles.sentiment,
            sentimentScore: articles.sentimentScore,
            summary: articles.summary,
            commentCount: sql<number>`coalesce(${commentCountSq.count}, 0)`.mapWith(Number),
          })
          .from(articles)
          .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
          .leftJoin(commentCountSq, eq(articles.id, commentCountSq.articleId))
          .where(
            input.source
              ? and(eq(articleJobs.jobId, input.jobId), eq(articles.source, input.source))
              : eq(articleJobs.jobId, input.jobId),
          )
          .orderBy(desc(articles.publishedAt))
          .limit(input.perPage)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(articleJobs)
          .innerJoin(articles, eq(articles.id, articleJobs.articleId))
          .where(
            input.source
              ? and(eq(articleJobs.jobId, input.jobId), eq(articles.source, input.source))
              : eq(articleJobs.jobId, input.jobId),
          ),
      ]);

      return {
        items: rows,
        total: countResult[0]?.count ?? 0,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / input.perPage),
      };
    }),

  // 수집된 영상 목록 조회 (조인 테이블 경유 / 구독 잡은 collector API 경유)
  getVideos: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        source: z.enum(COLLECTOR_SOURCE_ENUM).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const [job] = await ctx.db
        .select()
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode: ctx.defaultFilterMode,
          }),
        );
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      // 구독 잡: collector query API로 라우팅
      if (isCollectorJob(job as JobWithOptions)) {
        const subscriptionId = getSubscriptionId(job as JobWithOptions);
        if (!subscriptionId)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'subscriptionId 없음' });
        try {
          const client = getCollectorClient();
          const collectorItems = await client.items.query.query({
            subscriptionId,
            dateRange: {
              start: job.startDate.toISOString(),
              end: job.endDate.toISOString(),
            },
            scope: 'feed',
            itemTypes: ['video'],
            ...(input.source ? { sources: [input.source] } : {}),
            limit: input.perPage,
          });

          const items = collectorItems.items.map((item: Record<string, unknown>) => ({
            id: 0,
            source: item.source as string,
            sourceId: item.sourceId as string,
            url: item.url as string,
            title: item.title as string,
            description: item.content as string,
            channelTitle: item.author as string,
            viewCount: (item.metrics as Record<string, number>)?.viewCount ?? null,
            likeCount: (item.metrics as Record<string, number>)?.likeCount ?? null,
            publishedAt: item.publishedAt ? new Date(item.publishedAt as string) : null,
            collectedAt: item.fetchedAt ? new Date(item.fetchedAt as string) : null,
            commentCount: 0,
          }));

          return {
            items,
            total: collectorItems.total,
            page: input.page,
            perPage: input.perPage,
            totalPages: Math.ceil(collectorItems.total / input.perPage),
          };
        } catch (err) {
          console.error('[collectedData] collector videos query 실패:', err);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'collector 영상 조회 실패',
          });
        }
      }

      const offset = (input.page - 1) * input.perPage;

      // 영상별 댓글 수 서브쿼리 (조인 테이블 경유)
      const videoCommentCountSq = ctx.db
        .select({
          videoId: comments.videoId,
          cnt: sql<number>`count(*)::int`.as('vid_comment_cnt'),
        })
        .from(comments)
        .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
        .where(eq(commentJobs.jobId, input.jobId))
        .groupBy(comments.videoId)
        .as('vid_comment_counts');

      const [rows, countResult] = await Promise.all([
        ctx.db
          .select({
            id: videos.id,
            source: videos.source,
            sourceId: videos.sourceId,
            url: videos.url,
            title: videos.title,
            description: videos.description,
            channelTitle: videos.channelTitle,
            viewCount: videos.viewCount,
            likeCount: videos.likeCount,
            publishedAt: videos.publishedAt,
            collectedAt: videos.collectedAt,
            commentCount: sql<number>`coalesce(${videoCommentCountSq.cnt}, 0)`.mapWith(Number),
          })
          .from(videos)
          .innerJoin(videoJobs, eq(videos.id, videoJobs.videoId))
          .leftJoin(videoCommentCountSq, eq(videos.id, videoCommentCountSq.videoId))
          .where(
            input.source
              ? and(eq(videoJobs.jobId, input.jobId), eq(videos.source, input.source))
              : eq(videoJobs.jobId, input.jobId),
          )
          .orderBy(desc(videos.publishedAt))
          .limit(input.perPage)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(videoJobs)
          .innerJoin(videos, eq(videos.id, videoJobs.videoId))
          .where(
            input.source
              ? and(eq(videoJobs.jobId, input.jobId), eq(videos.source, input.source))
              : eq(videoJobs.jobId, input.jobId),
          ),
      ]);

      return {
        items: rows,
        total: countResult[0]?.count ?? 0,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / input.perPage),
      };
    }),

  // 수집된 댓글 목록 조회 (조인 테이블 경유 / 구독 잡은 collector API 경유)
  getComments: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        articleId: z.number().optional(),
        videoId: z.number().optional(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        source: z.enum(COLLECTOR_SOURCE_ENUM).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const [job] = await ctx.db
        .select()
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode: ctx.defaultFilterMode,
          }),
        );
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      // 구독 잡: collector query API로 라우팅
      if (isCollectorJob(job as JobWithOptions)) {
        const subscriptionId = getSubscriptionId(job as JobWithOptions);
        if (!subscriptionId)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'subscriptionId 없음' });
        try {
          const client = getCollectorClient();
          const collectorItems = await client.items.query.query({
            subscriptionId,
            dateRange: {
              start: job.startDate.toISOString(),
              end: job.endDate.toISOString(),
            },
            itemTypes: ['comment'],
            ...(input.source ? { sources: [input.source] } : {}),
            limit: input.perPage,
          });

          const items = collectorItems.items.map((item: Record<string, unknown>) => ({
            id: 0,
            source: item.source as string,
            content: item.content as string,
            author: item.author as string,
            likeCount: (item.metrics as Record<string, number>)?.likeCount ?? null,
            dislikeCount: (item.metrics as Record<string, number>)?.dislikeCount ?? null,
            publishedAt: item.publishedAt ? new Date(item.publishedAt as string) : null,
            articleId: null as number | null,
            sentiment: item.sentiment as string | null,
            sentimentScore: item.sentimentScore as number | null,
          }));

          return {
            items,
            total: collectorItems.total,
            page: input.page,
            perPage: input.perPage,
            totalPages: Math.ceil(collectorItems.total / input.perPage),
          };
        } catch (err) {
          console.error('[collectedData] collector comments query 실패:', err);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'collector 댓글 조회 실패',
          });
        }
      }

      const offset = (input.page - 1) * input.perPage;

      // 기본 조건: 조인 테이블 경유 jobId 필터
      const baseCondition = eq(commentJobs.jobId, input.jobId);
      const scopedCondition = input.articleId
        ? and(baseCondition, eq(comments.articleId, input.articleId))
        : input.videoId
          ? and(baseCondition, eq(comments.videoId, input.videoId))
          : baseCondition;
      const whereCondition = input.source
        ? and(scopedCondition, eq(comments.source, input.source))
        : scopedCondition;

      const [rows, countResult] = await Promise.all([
        ctx.db
          .select({
            id: comments.id,
            source: comments.source,
            content: comments.content,
            author: comments.author,
            likeCount: comments.likeCount,
            dislikeCount: comments.dislikeCount,
            publishedAt: comments.publishedAt,
            articleId: comments.articleId,
            sentiment: comments.sentiment,
            sentimentScore: comments.sentimentScore,
          })
          .from(comments)
          .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
          .where(whereCondition)
          .orderBy(desc(comments.likeCount))
          .limit(input.perPage)
          .offset(offset),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(comments)
          .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
          .where(whereCondition),
      ]);

      return {
        items: rows,
        total: countResult[0]?.count ?? 0,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / input.perPage),
      };
    }),

  // 수집 통계 요약 (조인 테이블 경유 / 구독 잡은 collector API 경유)
  getSummary: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [job] = await ctx.db
        .select()
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode: ctx.defaultFilterMode,
          }),
        );
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      // 구독 잡: collector stats API로 라우팅
      if (isCollectorJob(job as JobWithOptions)) {
        const subscriptionId = getSubscriptionId(job as JobWithOptions);
        if (!subscriptionId)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'subscriptionId 없음' });
        try {
          const client = getCollectorClient();
          const stats = await client.items.stats.query({
            subscriptionId,
            dateRange: {
              start: job.startDate.toISOString(),
              end: job.endDate.toISOString(),
            },
          });

          // bySourceAndType을 web 스키마에 맞게 변환
          const articleSourceBreakdown = stats.bySourceAndType
            .filter((r) => r.itemType === 'article')
            .map((r) => ({ source: r.source, count: r.count }));
          const videoSourceBreakdown = stats.bySourceAndType
            .filter((r) => r.itemType === 'video')
            .map((r) => ({ source: r.source, count: r.count }));
          const commentSourceBreakdown = stats.bySourceAndType
            .filter((r) => r.itemType === 'comment')
            .map((r) => ({ source: r.source, count: r.count }));

          const totalArticles = articleSourceBreakdown.reduce((s, r) => s + r.count, 0);
          const totalVideos = videoSourceBreakdown.reduce((s, r) => s + r.count, 0);
          const totalComments = commentSourceBreakdown.reduce((s, r) => s + r.count, 0);

          const volumeBySource = new Map<string, number>();
          for (const { source, count } of stats.bySourceAndType) {
            const norm = source === 'naver-comments' ? 'naver-news' : source;
            volumeBySource.set(norm, (volumeBySource.get(norm) ?? 0) + count);
          }
          const sourceVolume = Array.from(volumeBySource.entries()).map(([source, count]) => ({
            source,
            count,
          }));

          return {
            totalArticles,
            totalVideos,
            totalComments,
            sourceBreakdown: [...articleSourceBreakdown, ...videoSourceBreakdown],
            sourceVolume,
            keyword: job.keyword,
            period: {
              start: job.startDate.toISOString(),
              end: job.endDate.toISOString(),
            },
          };
        } catch (err) {
          console.error('[collectedData] collector stats 실패:', err);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'collector 통계 조회 실패',
          });
        }
      }

      // 일반 잡: web DB 조인 테이블 쿼리 (기존 로직)
      const [
        articleCount,
        videoCount,
        commentCount,
        articleSourceBreakdown,
        videoSourceBreakdown,
        commentSourceBreakdown,
      ] = await Promise.all([
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(articleJobs)
          .where(eq(articleJobs.jobId, input.jobId)),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(videoJobs)
          .where(eq(videoJobs.jobId, input.jobId)),
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(commentJobs)
          .where(eq(commentJobs.jobId, input.jobId)),
        ctx.db
          .select({
            source: articles.source,
            count: sql<number>`count(*)::int`,
          })
          .from(articles)
          .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
          .where(eq(articleJobs.jobId, input.jobId))
          .groupBy(articles.source),
        ctx.db
          .select({
            source: videos.source,
            count: sql<number>`count(*)::int`,
          })
          .from(videos)
          .innerJoin(videoJobs, eq(videos.id, videoJobs.videoId))
          .where(eq(videoJobs.jobId, input.jobId))
          .groupBy(videos.source),
        ctx.db
          .select({
            source: comments.source,
            count: sql<number>`count(*)::int`,
          })
          .from(comments)
          .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
          .where(eq(commentJobs.jobId, input.jobId))
          .groupBy(comments.source),
      ]);

      // 소스별 전체 볼륨 합산 (기사 + 영상 + 댓글)
      const volumeBySource = new Map<string, number>();
      for (const { source, count } of [
        ...articleSourceBreakdown,
        ...videoSourceBreakdown,
        ...commentSourceBreakdown,
      ]) {
        volumeBySource.set(source, (volumeBySource.get(source) ?? 0) + count);
      }
      const sourceVolume = Array.from(volumeBySource.entries()).map(([source, count]) => ({
        source,
        count,
      }));

      return {
        totalArticles: articleCount[0]?.count ?? 0,
        totalVideos: videoCount[0]?.count ?? 0,
        totalComments: commentCount[0]?.count ?? 0,
        sourceBreakdown: [...articleSourceBreakdown, ...videoSourceBreakdown],
        sourceVolume,
        keyword: job.keyword,
        period: {
          start: job.startDate.toISOString(),
          end: job.endDate.toISOString(),
        },
      };
    }),

  // 매체×타입 분해, 한도 대비 실적, 날짜별 수집량 (수집 데이터 요약 뷰 위젯용)
  getCollectionStats: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        timelineBasis: z.enum(['published', 'collected']).default('published'),
      }),
    )
    .query(async ({ input, ctx }) => {
      const [job] = await ctx.db
        .select()
        .from(collectionJobs)
        .where(
          buildJobCondition({
            jobId: input.jobId,
            teamId: ctx.teamId,
            userId: ctx.userId,
            filterMode: ctx.defaultFilterMode,
          }),
        );
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      const jobId = input.jobId;
      const timelineBasis = input.timelineBasis;

      // ── 공통: 한도/타임라인 보정 로직 ──
      const jobLimits = job.limits ?? null;
      const rawLimits = {
        naverArticles: jobLimits?.naverArticles ?? DEFAULT_COLLECTION_LIMITS.naverArticles,
        youtubeVideos: jobLimits?.youtubeVideos ?? DEFAULT_COLLECTION_LIMITS.youtubeVideos,
        communityPosts: jobLimits?.communityPosts ?? DEFAULT_COLLECTION_LIMITS.communityPosts,
        commentsPerItem: jobLimits?.commentsPerItem ?? DEFAULT_COLLECTION_LIMITS.commentsPerItem,
      };
      const limitsSource: 'job' | 'default' = jobLimits ? 'job' : 'default';
      const limitMode = ((job.options as Record<string, unknown>)?.limitMode ?? 'total') as
        | 'total'
        | 'perDay';
      const dayCount = computeDayCount(job.startDate.toISOString(), job.endDate.toISOString());
      const perDayInflated = applyPerDayInflation(rawLimits, dayCount, limitMode);

      const sources = ((job.appliedPreset as Record<string, unknown>)?.sources ?? {}) as Record<
        string,
        boolean
      >;
      const COMMUNITY_SOURCE_KEYS = ['dcinside', 'fmkorea', 'clien'] as const;
      const activeCommunityCount = COMMUNITY_SOURCE_KEYS.filter((k) => sources[k]).length || 1;
      const effectiveLimits = {
        ...perDayInflated,
        communityPosts: perDayInflated.communityPosts * activeCommunityCount,
      };

      const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const toKstDateStr = (iso: Date | string | null | undefined): string | null => {
        if (iso == null) return null;
        const d = typeof iso === 'string' ? new Date(iso) : iso;
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
        return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
      };
      const startStr = toKstDateStr(job.startDate);
      const endStr = toKstDateStr(job.endDate);

      const fullDates: string[] = [];
      if (startStr && endStr) {
        const cursor = new Date(`${startStr}T00:00:00Z`);
        const limit = new Date(`${endStr}T00:00:00Z`);
        let guard = 0;
        while (cursor <= limit && guard < 400) {
          fullDates.push(cursor.toISOString().slice(0, 10));
          cursor.setUTCDate(cursor.getUTCDate() + 1);
          guard += 1;
        }
      }
      const inRangeSet = new Set(fullDates);
      const executionKstDate = toKstDateStr(job.createdAt);
      const futureDates = executionKstDate ? fullDates.filter((d) => d > executionKstDate) : [];

      const pct = (actual: number, limit: number) =>
        limit > 0 ? Math.round((actual / limit) * 1000) / 10 : 0;

      // ── 구독 잡: collector collectionStats API로 라우팅 ──
      if (isCollectorJob(job as JobWithOptions)) {
        const subscriptionId = getSubscriptionId(job as JobWithOptions);
        if (!subscriptionId)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'subscriptionId 없음' });

        try {
          const client = getCollectorClient();
          const collectorStats = await client.items.collectionStats.query({
            subscriptionId,
            dateRange: {
              start: job.startDate.toISOString(),
              end: job.endDate.toISOString(),
            },
          });

          // 소스×타입 분해를 web 스키마에 맞게 변환
          const articleBySource = collectorStats.bySourceAndType
            .filter((r) => r.itemType === 'article')
            .map((r) => ({ source: r.source, count: r.count }));
          const videoBySource = collectorStats.bySourceAndType
            .filter((r) => r.itemType === 'video')
            .map((r) => ({ source: r.source, count: r.count }));
          const commentBySource = collectorStats.bySourceAndType
            .filter((r) => r.itemType === 'comment')
            .map((r) => ({ source: r.source, count: r.count }));

          // 매체별 실적
          const naverArticleCount = articleBySource
            .filter((r) => r.source === 'naver-news')
            .reduce((sum, r) => sum + r.count, 0);
          const youtubeVideoCount = videoBySource
            .filter((r) => r.source === 'youtube-videos' || r.source === 'youtube')
            .reduce((sum, r) => sum + r.count, 0);
          const communityPostCount = articleBySource
            .filter((r) => r.source !== 'naver-news')
            .reduce((sum, r) => sum + r.count, 0);

          // 댓글 평균/최대는 collector에서 직접 구하기 어려우므로 commentCountByParent 사용
          let combinedAvg = 0;
          let combinedMax = 0;
          try {
            const commentCounts = await client.items.commentCountByParent.query({
              subscriptionId,
              dateRange: {
                start: job.startDate.toISOString(),
                end: job.endDate.toISOString(),
              },
            });
            if (commentCounts.length > 0) {
              const counts = commentCounts.map((r) => r.count);
              combinedAvg = counts.reduce((a, b) => a + b, 0) / counts.length;
              combinedMax = Math.max(...counts);
            }
          } catch {
            // 댓글 통계 실패 시 0 유지
          }

          // 타임라인 병합
          const dayMap = new Map<string, { articles: number; videos: number; comments: number }>();
          const ensureDay = (d: string) => {
            const existing = dayMap.get(d);
            if (existing) return existing;
            const fresh = { articles: 0, videos: 0, comments: 0 };
            dayMap.set(d, fresh);
            return fresh;
          };
          for (const r of collectorStats.articleDaily) ensureDay(r.date).articles = r.count;
          for (const r of collectorStats.videoDaily) ensureDay(r.date).videos = r.count;
          for (const r of collectorStats.commentDaily) ensureDay(r.date).comments = r.count;

          const timeline = fullDates.map((date) => ({
            date,
            articles: dayMap.get(date)?.articles ?? 0,
            videos: dayMap.get(date)?.videos ?? 0,
            comments: dayMap.get(date)?.comments ?? 0,
          }));

          const outOfRange = { articles: 0, videos: 0, comments: 0, days: 0 };
          for (const [date, counts] of dayMap.entries()) {
            if (inRangeSet.has(date)) continue;
            outOfRange.articles += counts.articles;
            outOfRange.videos += counts.videos;
            outOfRange.comments += counts.comments;
            if (counts.articles + counts.videos + counts.comments > 0) outOfRange.days += 1;
          }

          return {
            byTypeAndSource: {
              articles: articleBySource,
              videos: videoBySource,
              comments: commentBySource,
            },
            limits: {
              naverArticles: {
                limit: effectiveLimits.naverArticles,
                actual: naverArticleCount,
                pct: pct(naverArticleCount, effectiveLimits.naverArticles),
              },
              youtubeVideos: {
                limit: effectiveLimits.youtubeVideos,
                actual: youtubeVideoCount,
                pct: pct(youtubeVideoCount, effectiveLimits.youtubeVideos),
              },
              communityPosts: {
                limit: effectiveLimits.communityPosts,
                actual: communityPostCount,
                pct: pct(communityPostCount, effectiveLimits.communityPosts),
              },
              commentsPerItem: {
                limit: effectiveLimits.commentsPerItem,
                actual: Math.round(combinedAvg),
                actualAvg: Math.round(combinedAvg * 10) / 10,
                actualMax: combinedMax,
                pct: pct(combinedAvg, effectiveLimits.commentsPerItem),
              },
            },
            limitsSource,
            limitMode: limitMode as 'total' | 'perDay',
            dayCount,
            rawLimits,
            activeCommunityCount,
            timeline,
            timelineBasis,
            outOfRange,
            executionKstDate,
            futureDates,
          };
        } catch (err) {
          console.error('[collectedData] collector collectionStats 실패:', err);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'collector 통계 조회 실패',
          });
        }
      }

      // ── 일반 잡: web DB 조인 테이블 직접 쿼리 (기존 로직) ──

      // KST 일자 변환 식
      const articleBasisCol =
        timelineBasis === 'published'
          ? sql`COALESCE(${articles.publishedAt}, ${articles.collectedAt})`
          : sql`${articles.collectedAt}`;
      const videoBasisCol =
        timelineBasis === 'published'
          ? sql`COALESCE(${videos.publishedAt}, ${videos.collectedAt})`
          : sql`${videos.collectedAt}`;
      const commentBasisCol =
        timelineBasis === 'published'
          ? sql`COALESCE(${comments.publishedAt}, ${comments.collectedAt})`
          : sql`${comments.collectedAt}`;

      const kstDayArticles = sql<string>`to_char(((${articleBasisCol} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;
      const kstDayVideos = sql<string>`to_char(((${videoBasisCol} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;
      const kstDayComments = sql<string>`to_char(((${commentBasisCol} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;

      const articleCommentSq = ctx.db
        .select({
          articleId: comments.articleId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(comments)
        .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
        .where(and(eq(commentJobs.jobId, jobId), sql`${comments.articleId} IS NOT NULL`))
        .groupBy(comments.articleId)
        .as('article_comment_cnt');

      const videoCommentSq = ctx.db
        .select({
          videoId: comments.videoId,
          cnt: sql<number>`count(*)::int`.as('cnt'),
        })
        .from(comments)
        .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
        .where(and(eq(commentJobs.jobId, jobId), sql`${comments.videoId} IS NOT NULL`))
        .groupBy(comments.videoId)
        .as('video_comment_cnt');

      const [
        articleBySource,
        videoBySource,
        commentBySource,
        articleDaily,
        videoDaily,
        commentDaily,
        articleCommentStats,
        videoCommentStats,
      ] = await Promise.all([
        ctx.db
          .select({
            source: articles.source,
            count: sql<number>`count(*)::int`,
          })
          .from(articles)
          .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
          .where(eq(articleJobs.jobId, jobId))
          .groupBy(articles.source),
        ctx.db
          .select({
            source: videos.source,
            count: sql<number>`count(*)::int`,
          })
          .from(videos)
          .innerJoin(videoJobs, eq(videos.id, videoJobs.videoId))
          .where(eq(videoJobs.jobId, jobId))
          .groupBy(videos.source),
        ctx.db
          .select({
            source: comments.source,
            count: sql<number>`count(*)::int`,
          })
          .from(comments)
          .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
          .where(eq(commentJobs.jobId, jobId))
          .groupBy(comments.source),
        ctx.db
          .select({
            date: kstDayArticles,
            count: sql<number>`count(*)::int`,
          })
          .from(articles)
          .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
          .where(eq(articleJobs.jobId, jobId))
          .groupBy(kstDayArticles),
        ctx.db
          .select({
            date: kstDayVideos,
            count: sql<number>`count(*)::int`,
          })
          .from(videos)
          .innerJoin(videoJobs, eq(videos.id, videoJobs.videoId))
          .where(eq(videoJobs.jobId, jobId))
          .groupBy(kstDayVideos),
        ctx.db
          .select({
            date: kstDayComments,
            count: sql<number>`count(*)::int`,
          })
          .from(comments)
          .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
          .where(eq(commentJobs.jobId, jobId))
          .groupBy(kstDayComments),
        ctx.db
          .select({
            avg: sql<number>`coalesce(avg(${articleCommentSq.cnt}), 0)::float`,
            max: sql<number>`coalesce(max(${articleCommentSq.cnt}), 0)::int`,
          })
          .from(articleCommentSq),
        ctx.db
          .select({
            avg: sql<number>`coalesce(avg(${videoCommentSq.cnt}), 0)::float`,
            max: sql<number>`coalesce(max(${videoCommentSq.cnt}), 0)::int`,
          })
          .from(videoCommentSq),
      ]);

      const naverArticleCount = articleBySource
        .filter((r) => r.source === 'naver-news')
        .reduce((sum, r) => sum + r.count, 0);
      const youtubeVideoCount = videoBySource
        .filter((r) => r.source === 'youtube-videos' || r.source === 'youtube')
        .reduce((sum, r) => sum + r.count, 0);
      const communityPostCount = articleBySource
        .filter((r) => r.source !== 'naver-news')
        .reduce((sum, r) => sum + r.count, 0);

      const aAvg = Number(articleCommentStats[0]?.avg ?? 0);
      const aMax = Number(articleCommentStats[0]?.max ?? 0);
      const vAvg = Number(videoCommentStats[0]?.avg ?? 0);
      const vMax = Number(videoCommentStats[0]?.max ?? 0);
      const totalItems = naverArticleCount + communityPostCount + youtubeVideoCount;
      const totalArticleLikeItems = naverArticleCount + communityPostCount;
      const combinedAvg =
        totalItems > 0 ? (aAvg * totalArticleLikeItems + vAvg * youtubeVideoCount) / totalItems : 0;
      const combinedMax = Math.max(aMax, vMax);

      const dayMap = new Map<string, { articles: number; videos: number; comments: number }>();
      const ensureDay = (d: string) => {
        const existing = dayMap.get(d);
        if (existing) return existing;
        const fresh = { articles: 0, videos: 0, comments: 0 };
        dayMap.set(d, fresh);
        return fresh;
      };
      for (const r of articleDaily) ensureDay(r.date).articles = r.count;
      for (const r of videoDaily) ensureDay(r.date).videos = r.count;
      for (const r of commentDaily) ensureDay(r.date).comments = r.count;

      const timeline = fullDates.map((date) => ({
        date,
        articles: dayMap.get(date)?.articles ?? 0,
        videos: dayMap.get(date)?.videos ?? 0,
        comments: dayMap.get(date)?.comments ?? 0,
      }));

      const outOfRange = { articles: 0, videos: 0, comments: 0, days: 0 };
      for (const [date, counts] of dayMap.entries()) {
        if (inRangeSet.has(date)) continue;
        outOfRange.articles += counts.articles;
        outOfRange.videos += counts.videos;
        outOfRange.comments += counts.comments;
        if (counts.articles + counts.videos + counts.comments > 0) outOfRange.days += 1;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.warn('[getCollectionStats]', {
          jobId,
          jobStart: job.startDate,
          jobEnd: job.endDate,
          startStr,
          endStr,
          collectedDatesFromDb: Array.from(dayMap.keys()),
          timelineLength: timeline.length,
          outOfRange,
        });
      }

      return {
        byTypeAndSource: {
          articles: articleBySource,
          videos: videoBySource,
          comments: commentBySource,
        },
        limits: {
          naverArticles: {
            limit: effectiveLimits.naverArticles,
            actual: naverArticleCount,
            pct: pct(naverArticleCount, effectiveLimits.naverArticles),
          },
          youtubeVideos: {
            limit: effectiveLimits.youtubeVideos,
            actual: youtubeVideoCount,
            pct: pct(youtubeVideoCount, effectiveLimits.youtubeVideos),
          },
          communityPosts: {
            limit: effectiveLimits.communityPosts,
            actual: communityPostCount,
            pct: pct(communityPostCount, effectiveLimits.communityPosts),
          },
          commentsPerItem: {
            limit: effectiveLimits.commentsPerItem,
            actual: Math.round(combinedAvg),
            actualAvg: Math.round(combinedAvg * 10) / 10,
            actualMax: combinedMax,
            pct: pct(combinedAvg, effectiveLimits.commentsPerItem),
          },
        },
        limitsSource,
        limitMode: limitMode as 'total' | 'perDay',
        dayCount,
        rawLimits,
        activeCommunityCount,
        timeline,
        timelineBasis,
        outOfRange,
        executionKstDate,
        futureDates,
      };
    }),
});
