import { FlowProducer } from 'bullmq';
import { and, eq, inArray } from 'drizzle-orm';
import type { DataSourceSnapshot } from '@ai-signalcraft/collectors';
import type { CollectionTrigger, ReusePlanPayload } from '../types';
import type { ResumeOptions } from '../analysis/pipeline-orchestrator';
import { getDb } from '../db';
import { dataSources } from '../db/schema/sources';
import {
  planArticleReuse,
  planVideoReuse,
  linkReusedArticlesToJob,
  linkReusedVideosToJob,
  linkReusedCommentsForArticles,
  linkReusedCommentsForVideos,
  linkArticleKeywords,
  linkVideoKeywords,
  type ArticleReusePlan,
  type VideoReusePlan,
} from '../pipeline/reuse-planner';
import { appendJobEvent, updateJobProgress } from '../pipeline/persist';
import { cacheGetOrSet, keyReusePlan } from '../cache/redis-cache';
import { getBullMQOptions } from './connection';
import { applyPerDayInflation, computeDayCount } from './per-day-limits';

// planReuse 결과의 Redis 캐시 TTL (5분) — 동시 flow 중복 DB 쿼리 방지 목적
const REUSE_PLAN_CACHE_TTL_SEC = 300;

// FlowProducer를 lazy 초기화 -- import 시 Redis 연결 시도 방지
let flowProducer: FlowProducer | null = null;

function getFlowProducer() {
  if (!flowProducer) {
    // prefix 주입으로 개발/운영 네임스페이스 분리
    flowProducer = new FlowProducer(getBullMQOptions());
  }
  return flowProducer;
}

/**
 * 소스별 planReuse 호출 — 하나의 소스가 실패해도 다른 소스 수집은 계속 진행.
 * 실패·예외 시 빈 계획(전량 재수집)으로 폴백. 오류는 job 이벤트로만 기록.
 */
async function safePlanArticleReuse(
  source: string,
  keyword: string,
  startDate: Date,
  endDate: Date,
  forceRefetch: boolean,
  dbJobId: number,
): Promise<ArticleReusePlan> {
  try {
    // forceRefetch 시에는 캐시 경유하지 않음 (항상 빈 계획)
    if (forceRefetch) {
      return await planArticleReuse({ source, keyword, startDate, endDate, forceRefetch });
    }
    const cacheKey = keyReusePlan(source, keyword, startDate.toISOString(), endDate.toISOString());
    const { value } = await cacheGetOrSet<ArticleReusePlan>(
      cacheKey,
      REUSE_PLAN_CACHE_TTL_SEC,
      () => planArticleReuse({ source, keyword, startDate, endDate, forceRefetch }),
    );
    return value;
  } catch (err) {
    await appendJobEvent(
      dbJobId,
      'warn',
      `reuse plan failed (${source}): ${err instanceof Error ? err.message : String(err)}`,
    ).catch(() => void 0);
    return { reuseArticleIds: [], skipUrls: [], refetchCommentsFor: [], evaluated: 0 };
  }
}

async function safePlanVideoReuse(
  source: string,
  keyword: string,
  startDate: Date,
  endDate: Date,
  forceRefetch: boolean,
  dbJobId: number,
): Promise<VideoReusePlan> {
  try {
    if (forceRefetch) {
      return await planVideoReuse({ source, keyword, startDate, endDate, forceRefetch });
    }
    const cacheKey = keyReusePlan(source, keyword, startDate.toISOString(), endDate.toISOString());
    const { value } = await cacheGetOrSet<VideoReusePlan>(cacheKey, REUSE_PLAN_CACHE_TTL_SEC, () =>
      planVideoReuse({ source, keyword, startDate, endDate, forceRefetch }),
    );
    return value;
  } catch (err) {
    await appendJobEvent(
      dbJobId,
      'warn',
      `reuse plan failed (${source}): ${err instanceof Error ? err.message : String(err)}`,
    ).catch(() => void 0);
    return { reuseVideoIds: [], skipVideoUrls: [], refetchCommentsFor: [], evaluated: 0 };
  }
}

function toReusePlanPayload(plan: ArticleReusePlan | VideoReusePlan): ReusePlanPayload {
  const skipUrls = 'skipUrls' in plan ? plan.skipUrls : plan.skipVideoUrls;
  return {
    skipUrls,
    refetchCommentsFor: plan.refetchCommentsFor,
  };
}

// dbJobId: collection_jobs 테이블의 정수 PK -- 호출자가 createCollectionJob() 후 전달
export async function triggerCollection(params: CollectionTrigger, dbJobId: number) {
  const flowId = `collection-${Date.now()}`;
  const limits = params.limits ?? {
    naverArticles: 1000,
    youtubeVideos: 50,
    communityPosts: 50,
    commentsPerItem: 500,
  };

  // 기간 모드에서 입력값을 '날짜별 한도'로 해석 → 수집기에는 (입력 × 일수)를 총량으로 전달.
  // 이벤트 모드(= limitMode='total' 또는 미지정)에서는 기존처럼 총량 그대로 사용.
  const limitMode = params.limitMode ?? 'total';
  const dayCount = computeDayCount(params.startDate, params.endDate);
  const effective = applyPerDayInflation(limits, dayCount, limitMode);

  // perDay 모드에서만 일자별 cap을 어댑터에 명시 전달.
  // 모든 수집기는 maxItemsPerDay를 받으면 각 일자에서 이 값을 절대 넘기지 않으며,
  // 한 일자가 부족해도 다른 일자에서 보충하지 않는다.
  // total 모드에서는 미전달 → 어댑터는 fallback(maxItems/dayCount의 floor)으로 일자 편중만 방지.
  const perDayLimits =
    limitMode === 'perDay' && dayCount > 1
      ? {
          naverArticles: limits.naverArticles,
          youtubeVideos: limits.youtubeVideos,
          communityPosts: limits.communityPosts,
        }
      : undefined;
  if (limitMode === 'perDay') {
    await appendJobEvent(
      dbJobId,
      'info',
      `per-day limits applied: dayCount=${dayCount}, naver=${effective.naverArticles}, youtube=${effective.youtubeVideos}, community=${effective.communityPosts}`,
    ).catch(() => void 0);
  }

  // D-05: 3단계 분리 -- collect -> normalize -> persist
  // D-01: 통합 키워드 수집 -- 모든 소스 동시 실행
  // D-04: 부분 실패 허용 -- 소스별 독립 실행
  // INT-01: sources 필드 기반 조건부 수집기 실행
  const enabledSources = params.sources ?? ['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'];

  // -- TTL 기반 재사용 계획 프리스텝 --------------------------------------
  // 각 소스에 대해 "이미 최근 수집된 기사/영상"을 찾아 스킵 목록과 재연결 대상을 계산.
  // 재사용 대상은 여기서 article_jobs/comment_jobs 에 바로 연결 — 분석 단계가 N:M 조인으로 즉시 인식.
  const startDate = new Date(params.startDate);
  const endDate = new Date(params.endDate);
  const forceRefetch = params.forceRefetch ?? false;

  const articleReusePlans: Record<string, ArticleReusePlan> = {};
  const videoReusePlans: Record<string, VideoReusePlan> = {};

  // 소스별로 플랜 수립 (병렬)
  const planPromises: Promise<void>[] = [];
  for (const src of enabledSources) {
    if (src === 'youtube') {
      planPromises.push(
        safePlanVideoReuse(src, params.keyword, startDate, endDate, forceRefetch, dbJobId).then(
          (plan) => {
            videoReusePlans[src] = plan;
          },
        ),
      );
    } else {
      // naver, dcinside, fmkorea, clien — article 스키마
      const dbSource = src === 'naver' ? 'naver-news' : src;
      planPromises.push(
        safePlanArticleReuse(
          dbSource,
          params.keyword,
          startDate,
          endDate,
          forceRefetch,
          dbJobId,
        ).then((plan) => {
          articleReusePlans[src] = plan;
        }),
      );
    }
  }
  await Promise.all(planPromises);

  // 재사용 대상 즉시 조인 테이블 연결 + 키워드 linkage 누적
  // 수집 실패해도 재사용 기사는 분석에 포함됨 (안전한 분리)
  const linkPromises: Promise<unknown>[] = [];
  const commentCountPromises: Promise<number>[] = [];
  let totalReusedArticles = 0;
  let totalReusedVideos = 0;
  for (const plan of Object.values(articleReusePlans)) {
    if (plan.reuseArticleIds.length === 0) continue;
    totalReusedArticles += plan.reuseArticleIds.length;
    linkPromises.push(linkReusedArticlesToJob(dbJobId, plan.reuseArticleIds));
    commentCountPromises.push(linkReusedCommentsForArticles(dbJobId, plan.reuseArticleIds));
    linkPromises.push(linkArticleKeywords(plan.reuseArticleIds, params.keyword));
  }
  for (const plan of Object.values(videoReusePlans)) {
    if (plan.reuseVideoIds.length === 0) continue;
    totalReusedVideos += plan.reuseVideoIds.length;
    linkPromises.push(linkReusedVideosToJob(dbJobId, plan.reuseVideoIds));
    commentCountPromises.push(linkReusedCommentsForVideos(dbJobId, plan.reuseVideoIds));
    linkPromises.push(linkVideoKeywords(plan.reuseVideoIds, params.keyword));
  }
  let totalReusedComments = 0;
  try {
    const [, commentCounts] = await Promise.all([
      Promise.all(linkPromises),
      Promise.all(commentCountPromises),
    ]);
    totalReusedComments = commentCounts.reduce((s, n) => s + n, 0);
  } catch (err) {
    await appendJobEvent(
      dbJobId,
      'warn',
      `reuse linkage failed: ${err instanceof Error ? err.message : String(err)}`,
    ).catch(() => void 0);
  }

  // 재사용 요약 로깅 (이벤트 + progress._reuse 필드)
  if (totalReusedArticles > 0 || totalReusedVideos > 0) {
    await appendJobEvent(
      dbJobId,
      'info',
      `reuse: articles=${totalReusedArticles}, videos=${totalReusedVideos}, comments=${totalReusedComments} (forceRefetch=${forceRefetch})`,
    ).catch(() => void 0);

    const bySource: Record<string, number> = {};
    for (const [src, plan] of Object.entries(articleReusePlans)) {
      if (plan.reuseArticleIds.length > 0) bySource[src] = plan.reuseArticleIds.length;
    }
    for (const [src, plan] of Object.entries(videoReusePlans)) {
      if (plan.reuseVideoIds.length > 0)
        bySource[src] = (bySource[src] ?? 0) + plan.reuseVideoIds.length;
    }
    const reuseSummary = {
      articles: totalReusedArticles,
      videos: totalReusedVideos,
      comments: totalReusedComments,
      bySource,
      forceRefetch,
      evaluatedAt: new Date().toISOString(),
    };
    await updateJobProgress(dbJobId, { _reuse: reuseSummary }).catch(() => void 0);
  }
  // ---------------------------------------------------------------------

  const children = [];
  if (enabledSources.includes('naver')) {
    const reusePlan = articleReusePlans['naver']
      ? toReusePlanPayload(articleReusePlans['naver'])
      : undefined;
    children.push({
      name: 'normalize-naver',
      queueName: 'pipeline',
      data: { source: 'naver-news', flowId, dbJobId, maxComments: limits.commentsPerItem },
      children: [
        {
          name: 'collect-naver-articles',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'naver-news',
            maxItems: effective.naverArticles,
            maxItemsPerDay: perDayLimits?.naverArticles,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
            reusePlan,
          },
        },
      ],
    });
  }
  if (enabledSources.includes('youtube')) {
    const reusePlan = videoReusePlans['youtube']
      ? toReusePlanPayload(videoReusePlans['youtube'])
      : undefined;
    children.push({
      name: 'normalize-youtube',
      queueName: 'pipeline',
      data: {
        source: 'youtube',
        flowId,
        dbJobId,
        maxComments: limits.commentsPerItem,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      children: [
        {
          name: 'collect-youtube-videos',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'youtube-videos',
            maxItems: effective.youtubeVideos,
            maxItemsPerDay: perDayLimits?.youtubeVideos,
            flowId,
            dbJobId,
            reusePlan,
          },
        },
      ],
    });
  }
  // 커뮤니티 수집기 -- 각 소스별 독립 실행 (부분 실패 허용)
  if (enabledSources.includes('dcinside')) {
    const reusePlan = articleReusePlans['dcinside']
      ? toReusePlanPayload(articleReusePlans['dcinside'])
      : undefined;
    children.push({
      name: 'normalize-community-dcinside',
      queueName: 'pipeline',
      data: { source: 'dcinside', flowId, dbJobId },
      children: [
        {
          name: 'collect-dcinside',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'dcinside',
            maxItems: effective.communityPosts,
            maxItemsPerDay: perDayLimits?.communityPosts,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
            reusePlan,
          },
        },
      ],
    });
  }
  if (enabledSources.includes('fmkorea')) {
    const reusePlan = articleReusePlans['fmkorea']
      ? toReusePlanPayload(articleReusePlans['fmkorea'])
      : undefined;
    children.push({
      name: 'normalize-community-fmkorea',
      queueName: 'pipeline',
      data: { source: 'fmkorea', flowId, dbJobId },
      children: [
        {
          name: 'collect-fmkorea',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'fmkorea',
            maxItems: effective.communityPosts,
            maxItemsPerDay: perDayLimits?.communityPosts,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
            reusePlan,
          },
        },
      ],
    });
  }
  if (enabledSources.includes('clien')) {
    const reusePlan = articleReusePlans['clien']
      ? toReusePlanPayload(articleReusePlans['clien'])
      : undefined;
    children.push({
      name: 'normalize-community-clien',
      queueName: 'pipeline',
      data: { source: 'clien', flowId, dbJobId },
      children: [
        {
          name: 'collect-clien',
          queueName: 'collectors',
          data: {
            ...params,
            source: 'clien',
            maxItems: effective.communityPosts,
            maxItemsPerDay: perDayLimits?.communityPosts,
            maxComments: limits.commentsPerItem,
            flowId,
            dbJobId,
            reusePlan,
          },
        },
      ],
    });
  }

  // 동적 데이터 소스 (관리자가 /admin/sources에서 등록한 RSS/HTML)
  if (params.customSourceIds && params.customSourceIds.length > 0) {
    const rows = await getDb().query.dataSources.findMany({
      where: and(inArray(dataSources.id, params.customSourceIds), eq(dataSources.enabled, true)),
    });
    for (const row of rows) {
      const snapshot: DataSourceSnapshot = {
        id: row.id,
        name: row.name,
        adapterType: row.adapterType,
        url: row.url,
        config: row.config ?? null,
        defaultLimit: row.defaultLimit,
      };
      // 동적 소스도 perDay 모드일 때는 일자별 cap 적용 (defaultLimit는 1일 한도로 해석).
      // 어댑터(rss/html 등 향후 추가될 모든 소스)가 maxItemsPerDay를 받으면 그 값을 절대 넘기지 않고,
      // 부족분을 다른 일자에서 채우지 않아야 한다.
      const customMaxItems =
        limitMode === 'perDay' && dayCount > 1 ? row.defaultLimit * dayCount : row.defaultLimit;
      const customMaxItemsPerDay =
        limitMode === 'perDay' && dayCount > 1 ? row.defaultLimit : undefined;
      children.push({
        name: `normalize-feed-${row.id}`,
        queueName: 'pipeline',
        data: {
          source: row.adapterType,
          dataSourceSnapshot: snapshot,
          flowId,
          dbJobId,
        },
        children: [
          {
            name: `collect-feed-${row.id}`,
            queueName: 'collectors',
            data: {
              ...params,
              source: row.adapterType,
              dataSourceSnapshot: snapshot,
              maxItems: customMaxItems,
              maxItemsPerDay: customMaxItemsPerDay,
              flowId,
              dbJobId,
            },
          },
        ],
      });
    }
  }

  const flow = await getFlowProducer().add({
    name: 'persist',
    queueName: 'pipeline',
    data: { flowId, dbJobId, keyword: params.keyword },
    opts: {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
    children,
  });

  return { flowId, dbJobId, flow };
}

// D-09: 분석 파이프라인 트리거 -- persist 완료 후 호출
// runner.ts가 내부적으로 3단계 병렬/순차를 관리하므로 Flow는 단일 작업으로 단순화
export async function triggerAnalysis(dbJobId: number, keyword: string) {
  const flow = await getFlowProducer().add({
    name: 'run-analysis',
    queueName: 'analysis',
    data: { dbJobId, keyword },
    opts: {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
  return flow;
}

// 분석 재실행 트리거 -- 완료된 모듈은 DB에서 로드하고 실패/미실행 모듈만 재실행
export async function triggerAnalysisResume(
  dbJobId: number,
  keyword: string,
  resumeOptions: ResumeOptions,
) {
  const flow = await getFlowProducer().add({
    name: 'run-analysis',
    queueName: 'analysis',
    data: { dbJobId, keyword, resumeOptions },
    opts: {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    },
  });
  return flow;
}
