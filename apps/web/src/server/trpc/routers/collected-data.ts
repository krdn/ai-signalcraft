import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { articles, videos, comments, collectionJobs } from '@ai-signalcraft/core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const collectedDataRouter = router({
  // 수집된 기사 목록 조회
  getArticles: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      // 팀 소속 확인
      const jobConditions = ctx.teamId
        ? and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId))
        : eq(collectionJobs.id, input.jobId);
      const [job] = await ctx.db.select().from(collectionJobs).where(jobConditions);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      const offset = (input.page - 1) * input.perPage;

      const commentCountSq = ctx.db
        .select({
          articleId: comments.articleId,
          count: sql<number>`count(*)::int`.as('comment_count'),
        })
        .from(comments)
        .where(eq(comments.jobId, input.jobId))
        .groupBy(comments.articleId)
        .as('comment_counts');

      const [rows, countResult] = await Promise.all([
        ctx.db.select({
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
          .leftJoin(commentCountSq, eq(articles.id, commentCountSq.articleId))
          .where(eq(articles.jobId, input.jobId))
          .orderBy(desc(articles.publishedAt))
          .limit(input.perPage)
          .offset(offset),
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(articles)
          .where(eq(articles.jobId, input.jobId)),
      ]);

      return {
        items: rows,
        total: countResult[0]?.count ?? 0,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / input.perPage),
      };
    }),

  // 수집된 영상 목록 조회 (유튜브)
  getVideos: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const jobConditions = ctx.teamId
        ? and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId))
        : eq(collectionJobs.id, input.jobId);
      const [job] = await ctx.db.select().from(collectionJobs).where(jobConditions);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      const offset = (input.page - 1) * input.perPage;

      const videoCommentCountSq = ctx.db
        .select({
          videoId: comments.videoId,
          cnt: sql<number>`count(*)::int`.as('vid_comment_cnt'),
        })
        .from(comments)
        .where(eq(comments.jobId, input.jobId))
        .groupBy(comments.videoId)
        .as('vid_comment_counts');

      const [rows, countResult] = await Promise.all([
        ctx.db.select({
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
          .leftJoin(videoCommentCountSq, eq(videos.id, videoCommentCountSq.videoId))
          .where(eq(videos.jobId, input.jobId))
          .orderBy(desc(videos.publishedAt))
          .limit(input.perPage)
          .offset(offset),
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(videos)
          .where(eq(videos.jobId, input.jobId)),
      ]);

      return {
        items: rows,
        total: countResult[0]?.count ?? 0,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil((countResult[0]?.count ?? 0) / input.perPage),
      };
    }),

  // 수집된 댓글 목록 조회 (특정 기사/영상의 댓글 또는 전체)
  getComments: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      articleId: z.number().optional(),
      videoId: z.number().optional(),
      page: z.number().min(1).default(1),
      perPage: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      // 팀 소속 확인
      const jobConditions = ctx.teamId
        ? and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId))
        : eq(collectionJobs.id, input.jobId);
      const [job] = await ctx.db.select().from(collectionJobs).where(jobConditions);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      const offset = (input.page - 1) * input.perPage;

      const whereCondition = input.articleId
        ? and(eq(comments.jobId, input.jobId), eq(comments.articleId, input.articleId))
        : input.videoId
          ? and(eq(comments.jobId, input.jobId), eq(comments.videoId, input.videoId))
          : eq(comments.jobId, input.jobId);

      const [rows, countResult] = await Promise.all([
        ctx.db.select({
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
          .where(whereCondition)
          .orderBy(desc(comments.likeCount))
          .limit(input.perPage)
          .offset(offset),
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(comments)
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

  // 수집 통계 요약
  getSummary: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input, ctx }) => {
      const jobConditions = ctx.teamId
        ? and(eq(collectionJobs.id, input.jobId), eq(collectionJobs.teamId, ctx.teamId))
        : eq(collectionJobs.id, input.jobId);
      const [job] = await ctx.db.select().from(collectionJobs).where(jobConditions);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });

      const [articleCount, videoCount, commentCount, articleSourceBreakdown, videoSourceBreakdown] = await Promise.all([
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(articles).where(eq(articles.jobId, input.jobId)),
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(videos).where(eq(videos.jobId, input.jobId)),
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(comments).where(eq(comments.jobId, input.jobId)),
        ctx.db.select({
          source: articles.source,
          count: sql<number>`count(*)::int`,
        })
          .from(articles)
          .where(eq(articles.jobId, input.jobId))
          .groupBy(articles.source),
        ctx.db.select({
          source: videos.source,
          count: sql<number>`count(*)::int`,
        })
          .from(videos)
          .where(eq(videos.jobId, input.jobId))
          .groupBy(videos.source),
      ]);

      return {
        totalArticles: articleCount[0]?.count ?? 0,
        totalVideos: videoCount[0]?.count ?? 0,
        totalComments: commentCount[0]?.count ?? 0,
        sourceBreakdown: [...articleSourceBreakdown, ...videoSourceBreakdown],
        keyword: job.keyword,
        period: {
          start: job.startDate.toISOString(),
          end: job.endDate.toISOString(),
        },
      };
    }),
});
