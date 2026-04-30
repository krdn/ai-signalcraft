import { z } from 'zod';
import {
  videos,
  comments,
  collectionJobs,
  videoJobs,
  commentJobs,
  getCollectorClient,
} from '@ai-signalcraft/core';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../init';
import { buildJobCondition } from '../../shared/query-helpers';
import { isCollectorJob, getSubscriptionId, type JobWithOptions } from './_shared';
import { COLLECTOR_SOURCE_ENUM } from '@/lib/collector-sources';

// 수집된 영상 목록 조회 (조인 테이블 경유 / 구독 잡은 collector API 경유)
export const getVideos = protectedProcedure
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
  });
