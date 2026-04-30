import { z } from 'zod';
import { comments, collectionJobs, commentJobs, getCollectorClient } from '@ai-signalcraft/core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../init';
import { buildJobCondition } from '../../shared/query-helpers';
import { isCollectorJob, getSubscriptionId, type JobWithOptions } from './_shared';
import { COLLECTOR_SOURCE_ENUM } from '@/lib/collector-sources';

// 수집된 댓글 목록 조회 (조인 테이블 경유 / 구독 잡은 collector API 경유)
export const getComments = protectedProcedure
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
  });
