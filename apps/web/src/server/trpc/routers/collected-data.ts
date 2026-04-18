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

  // 매체×타입 분해, 한도 대비 실적, 날짜별 수집량 (수집 데이터 요약 뷰 위젯용)
  getCollectionStats: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
        // 타임라인 X축 기준: 'published'(기본, 실제 작성일) | 'collected'(수집 실행 시점).
        // 기존 차트가 'collected' 고정이어서 8일치가 수집일 1일에 몰려 보이던 문제를 해결.
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

      // KST 일자 변환 식 (타임스탬프 컬럼을 받아 'YYYY-MM-DD' 문자열 반환).
      // 'published' 기준에서는 published_at이 null인 경우 collected_at으로 폴백하여
      // 일자별 합계가 항상 totalCount와 일치하도록 보정한다.
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

      const kstDayArticles = sql<string>`to_char((${articleBasisCol} AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;
      const kstDayVideos = sql<string>`to_char((${videoBasisCol} AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;
      const kstDayComments = sql<string>`to_char((${commentBasisCol} AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')`;

      // 기사별 댓글 수 서브쿼리
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

      // 영상별 댓글 수 서브쿼리
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

      // 한도 fallback
      const jobLimits = job.limits ?? null;
      const rawLimits = {
        naverArticles: jobLimits?.naverArticles ?? DEFAULT_COLLECTION_LIMITS.naverArticles,
        youtubeVideos: jobLimits?.youtubeVideos ?? DEFAULT_COLLECTION_LIMITS.youtubeVideos,
        communityPosts: jobLimits?.communityPosts ?? DEFAULT_COLLECTION_LIMITS.communityPosts,
        commentsPerItem: jobLimits?.commentsPerItem ?? DEFAULT_COLLECTION_LIMITS.commentsPerItem,
      };
      const limitsSource: 'job' | 'default' = jobLimits ? 'job' : 'default';

      // 실제 수집기에 전달된 한도와 동일한 기준으로 환산 (limitMode='perDay'이면 일수만큼 곱함).
      // 이전에는 rawLimits를 그대로 표시해 8일×20=160건이 "한도 20의 800%"로 과장됐음.
      const limitMode = job.options?.limitMode ?? 'total';
      const dayCount = computeDayCount(job.startDate.toISOString(), job.endDate.toISOString());
      const perDayInflated = applyPerDayInflation(rawLimits, dayCount, limitMode);

      // 커뮤니티 한도는 수집기에 '매체당'으로 전달되므로 활성 커뮤니티 매체 수만큼 가중.
      // (flows.ts에서 dcinside/fmkorea/clien 각각에 communityPosts를 그대로 넘김)
      const sources = job.appliedPreset?.sources ?? {};
      const COMMUNITY_SOURCE_KEYS = ['dcinside', 'fmkorea', 'clien'] as const;
      const activeCommunityCount = COMMUNITY_SOURCE_KEYS.filter((k) => sources[k]).length || 1;
      const effectiveLimits = {
        ...perDayInflated,
        communityPosts: perDayInflated.communityPosts * activeCommunityCount,
      };

      // 매체별 실적 계산 (source 문자열: 'naver-news', 'youtube-videos', 'dcinside', 'fmkorea', 'clien', 'rss', 'html')
      const naverArticleCount = articleBySource
        .filter((r) => r.source === 'naver-news')
        .reduce((sum, r) => sum + r.count, 0);
      const youtubeVideoCount = videoBySource
        .filter((r) => r.source === 'youtube-videos' || r.source === 'youtube')
        .reduce((sum, r) => sum + r.count, 0);
      const communityPostCount = articleBySource
        .filter((r) => r.source !== 'naver-news')
        .reduce((sum, r) => sum + r.count, 0);

      const pct = (actual: number, limit: number) =>
        limit > 0 ? Math.round((actual / limit) * 1000) / 10 : 0;

      // 기사 + 영상 댓글 평균 가중 평균
      const aAvg = Number(articleCommentStats[0]?.avg ?? 0);
      const aMax = Number(articleCommentStats[0]?.max ?? 0);
      const vAvg = Number(videoCommentStats[0]?.avg ?? 0);
      const vMax = Number(videoCommentStats[0]?.max ?? 0);
      const totalItems = naverArticleCount + communityPostCount + youtubeVideoCount;
      const totalArticleLikeItems = naverArticleCount + communityPostCount;
      const combinedAvg =
        totalItems > 0 ? (aAvg * totalArticleLikeItems + vAvg * youtubeVideoCount) / totalItems : 0;
      const combinedMax = Math.max(aMax, vMax);

      // 타임라인 병합 (KST 일자 기준)
      const dayMap = new Map<string, { articles: number; videos: number; comments: number }>();
      const ensureDay = (d: string): { articles: number; videos: number; comments: number } => {
        const existing = dayMap.get(d);
        if (existing) return existing;
        const fresh = { articles: 0, videos: 0, comments: 0 };
        dayMap.set(d, fresh);
        return fresh;
      };
      for (const r of articleDaily) ensureDay(r.date).articles = r.count;
      for (const r of videoDaily) ensureDay(r.date).videos = r.count;
      for (const r of commentDaily) ensureDay(r.date).comments = r.count;

      // 타임라인은 Job 기간(startDate~endDate)으로만 그린다.
      // 기간을 벗어난 데이터는 차트에서 제외하고 outOfRange 메타에만 집계해 사용자에게 알린다.
      // (네이버/커뮤니티 수집기 버그로 기간 외 데이터가 혼입된 과거 Job도 차트는 기간만 보이게 된다.)
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
        // 안전장치: 최대 400일로 제한 (무한 루프 방지)
        let guard = 0;
        while (cursor <= limit && guard < 400) {
          fullDates.push(cursor.toISOString().slice(0, 10));
          cursor.setUTCDate(cursor.getUTCDate() + 1);
          guard += 1;
        }
      }
      const inRangeSet = new Set(fullDates);
      const timeline = fullDates.map((date) => ({
        date,
        articles: dayMap.get(date)?.articles ?? 0,
        videos: dayMap.get(date)?.videos ?? 0,
        comments: dayMap.get(date)?.comments ?? 0,
      }));

      // 기간 외 데이터 메타 집계 (차트 주석/경고 배지용)
      const outOfRange = { articles: 0, videos: 0, comments: 0, days: 0 };
      for (const [date, counts] of dayMap.entries()) {
        if (inRangeSet.has(date)) continue;
        outOfRange.articles += counts.articles;
        outOfRange.videos += counts.videos;
        outOfRange.comments += counts.comments;
        if (counts.articles + counts.videos + counts.comments > 0) outOfRange.days += 1;
      }

      // 수집 실행 시점보다 미래인 날짜 수 집계.
      // 기간 종료일이 Job 실행 시점보다 미래면 그 날짜들의 데이터는 아직 존재할 수 없음 → UI 경고.
      const executionKstDate = toKstDateStr(job.createdAt);
      const futureDates = executionKstDate ? fullDates.filter((d) => d > executionKstDate) : [];

      // 진단용 로그 (dev only)
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
        limitMode,
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
