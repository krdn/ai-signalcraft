import { z } from 'zod';
import { protectedProcedure, router } from '../init';
import { articles, comments, collectionJobs } from '@ai-signalcraft/core';
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
        })
          .from(articles)
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

  // 수집된 댓글 목록 조회 (특정 기사의 댓글 또는 전체)
  getComments: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      articleId: z.number().optional(),
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

      const [articleCount, commentCount, sourceBreakdown] = await Promise.all([
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(articles).where(eq(articles.jobId, input.jobId)),
        ctx.db.select({ count: sql<number>`count(*)::int` })
          .from(comments).where(eq(comments.jobId, input.jobId)),
        ctx.db.select({
          source: articles.source,
          count: sql<number>`count(*)::int`,
        })
          .from(articles)
          .where(eq(articles.jobId, input.jobId))
          .groupBy(articles.source),
      ]);

      return {
        totalArticles: articleCount[0]?.count ?? 0,
        totalComments: commentCount[0]?.count ?? 0,
        sourceBreakdown: sourceBreakdown,
        keyword: job.keyword,
        period: {
          start: job.startDate.toISOString(),
          end: job.endDate.toISOString(),
        },
      };
    }),
});
