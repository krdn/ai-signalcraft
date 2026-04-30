import { z } from 'zod';
import {
  articles,
  videos,
  comments,
  collectionJobs,
  articleJobs,
  videoJobs,
  commentJobs,
  getCollectorClient,
} from '@ai-signalcraft/core';
import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../init';
import { buildJobCondition } from '../../shared/query-helpers';
import { isCollectorJob, getSubscriptionId, type JobWithOptions } from './_shared';

// 수집 통계 요약 (조인 테이블 경유 / 구독 잡은 collector API 경유)
export const getSummary = protectedProcedure
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
  });
