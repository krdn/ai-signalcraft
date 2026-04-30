import { z } from 'zod';
import {
  articles,
  comments,
  collectionJobs,
  articleJobs,
  commentJobs,
  getCollectorClient,
} from '@ai-signalcraft/core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../init';
import { buildJobCondition } from '../../shared/query-helpers';
import { isCollectorJob, getSubscriptionId, type JobWithOptions } from './_shared';
import { COLLECTOR_SOURCE_ENUM } from '@/lib/collector-sources';

// 수집된 기사 목록 조회 (조인 테이블 경유 / 구독 잡은 collector API 경유)
export const getArticles = protectedProcedure
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
  });
