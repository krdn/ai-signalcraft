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
import { eq, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../init';
import { buildJobCondition } from '../../shared/query-helpers';
import { isCollectorJob, getSubscriptionId, type JobWithOptions } from './_shared';

// 매체×타입 분해, 한도 대비 실적, 날짜별 수집량 (수집 데이터 요약 뷰 위젯용)
export const getCollectionStats = protectedProcedure
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
  });
