import { z } from 'zod';
import {
  articles,
  videos,
  comments,
  collectionJobs,
  articleJobs,
  videoJobs,
  commentJobs,
} from '@ai-signalcraft/core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, router } from '../init';
import { buildJobCondition } from '../shared/query-helpers';

export const collectedDataRouter = router({
  // 수집된 기사 목록 조회 (조인 테이블 경유)
  getArticles: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        source: z.string().optional(),
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

  // 수집된 영상 목록 조회 (조인 테이블 경유)
  getVideos: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        source: z.string().optional(),
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

  // 수집된 댓글 목록 조회 (조인 테이블 경유)
  getComments: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        articleId: z.number().optional(),
        videoId: z.number().optional(),
        page: z.number().min(1).default(1),
        perPage: z.number().min(1).max(50).default(20),
        source: z.string().optional(),
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

  // 수집 통계 요약 (조인 테이블 경유)
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
});
