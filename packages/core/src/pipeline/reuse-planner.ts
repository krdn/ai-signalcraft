// TTL 기반 수집 재사용 판정
// 같은 키워드/기간으로 이미 최근 수집된 article/video 를 찾아 재연결 대상으로 분류
import { and, eq, gte, lte, gt, isNotNull, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { articles, articleKeywords, videos, videoKeywords } from '../db/schema/collections';
import {
  getContentTtlSecFor,
  getCommentTtlSecFor,
  isReuseDisabled,
  normalizeKeyword,
} from './reuse-config';

export interface ReusePlanInput {
  source: string;
  keyword: string;
  startDate: Date;
  endDate: Date;
  forceRefetch?: boolean;
}

export interface ArticleReusePlan {
  reuseArticleIds: number[]; // articleJobs 재연결 대상 (본문·댓글 모두 스킵)
  skipUrls: string[]; // collector 가 검색 결과에서 제외할 URL
  refetchCommentsFor: string[]; // 본문 skip, 댓글만 fetch
  // 디버깅·모니터링용
  evaluated: number; // 후보 개수 (DB hit 기사)
}

export interface VideoReusePlan {
  reuseVideoIds: number[];
  skipVideoUrls: string[];
  refetchCommentsFor: string[];
  evaluated: number;
}

const EMPTY_ARTICLE_PLAN: ArticleReusePlan = {
  reuseArticleIds: [],
  skipUrls: [],
  refetchCommentsFor: [],
  evaluated: 0,
};

const EMPTY_VIDEO_PLAN: VideoReusePlan = {
  reuseVideoIds: [],
  skipVideoUrls: [],
  refetchCommentsFor: [],
  evaluated: 0,
};

/**
 * 기사(article) 재사용 계획 수립.
 *
 * 정책:
 * - 같은 source + 정규화된 keyword 조합으로 article_keywords 에 등록된 기사
 * - publishedAt 이 [startDate, endDate] 구간 안
 * - last_fetched_at 이 현재 - contentTTL 이후 (TTL 내)
 *   → 재사용 (reuseArticleIds)
 * - TTL 내지만 last_comments_fetched_at 이 commentTTL 을 벗어난 경우
 *   → refetchCommentsFor (본문 스킵, 댓글만)
 */
export async function planArticleReuse(input: ReusePlanInput): Promise<ArticleReusePlan> {
  if (isReuseDisabled() || input.forceRefetch) {
    return EMPTY_ARTICLE_PLAN;
  }

  const keyword = normalizeKeyword(input.keyword);
  if (!keyword) return EMPTY_ARTICLE_PLAN;

  const contentTtlSec = getContentTtlSecFor(input.source);
  const commentTtlSec = getCommentTtlSecFor(input.source);
  const contentCutoff = new Date(Date.now() - contentTtlSec * 1000);

  const db = getDb();
  const candidates = await db
    .select({
      id: articles.id,
      url: articles.url,
      lastFetchedAt: articles.lastFetchedAt,
      lastCommentsFetchedAt: articles.lastCommentsFetchedAt,
    })
    .from(articles)
    .innerJoin(articleKeywords, eq(articleKeywords.articleId, articles.id))
    .where(
      and(
        eq(articles.source, input.source),
        eq(articleKeywords.keyword, keyword),
        // publishedAt 이 NULL 이면 기간 판정 불가 → 재사용 후보에서 제외
        isNotNull(articles.publishedAt),
        gte(articles.publishedAt, input.startDate),
        lte(articles.publishedAt, input.endDate),
        isNotNull(articles.lastFetchedAt),
        gt(articles.lastFetchedAt, contentCutoff),
      ),
    );

  const nowMs = Date.now();
  const commentCutoffMs = nowMs - commentTtlSec * 1000;

  const reuseArticleIds: number[] = [];
  const skipUrls: string[] = [];
  const refetchCommentsFor: string[] = [];

  for (const row of candidates) {
    reuseArticleIds.push(row.id);
    const commentsStale =
      !row.lastCommentsFetchedAt || row.lastCommentsFetchedAt.getTime() < commentCutoffMs;
    if (commentsStale) {
      // 본문은 스킵하지만 댓글만 새로 긁기 — 검색 결과 URL 매칭용
      refetchCommentsFor.push(row.url);
    } else {
      // 본문·댓글 모두 스킵
      skipUrls.push(row.url);
    }
  }

  return {
    reuseArticleIds,
    skipUrls,
    refetchCommentsFor,
    evaluated: candidates.length,
  };
}

/**
 * 영상(video) 재사용 계획 수립. articles 와 동일한 로직.
 */
export async function planVideoReuse(input: ReusePlanInput): Promise<VideoReusePlan> {
  if (isReuseDisabled() || input.forceRefetch) {
    return EMPTY_VIDEO_PLAN;
  }

  const keyword = normalizeKeyword(input.keyword);
  if (!keyword) return EMPTY_VIDEO_PLAN;

  const contentTtlSec = getContentTtlSecFor(input.source);
  const commentTtlSec = getCommentTtlSecFor(input.source);
  const contentCutoff = new Date(Date.now() - contentTtlSec * 1000);

  const db = getDb();
  const candidates = await db
    .select({
      id: videos.id,
      url: videos.url,
      lastFetchedAt: videos.lastFetchedAt,
      lastCommentsFetchedAt: videos.lastCommentsFetchedAt,
    })
    .from(videos)
    .innerJoin(videoKeywords, eq(videoKeywords.videoId, videos.id))
    .where(
      and(
        eq(videos.source, input.source),
        eq(videoKeywords.keyword, keyword),
        isNotNull(videos.publishedAt),
        gte(videos.publishedAt, input.startDate),
        lte(videos.publishedAt, input.endDate),
        isNotNull(videos.lastFetchedAt),
        gt(videos.lastFetchedAt, contentCutoff),
      ),
    );

  const nowMs = Date.now();
  const commentCutoffMs = nowMs - commentTtlSec * 1000;

  const reuseVideoIds: number[] = [];
  const skipVideoUrls: string[] = [];
  const refetchCommentsFor: string[] = [];

  for (const row of candidates) {
    reuseVideoIds.push(row.id);
    const commentsStale =
      !row.lastCommentsFetchedAt || row.lastCommentsFetchedAt.getTime() < commentCutoffMs;
    if (commentsStale) {
      refetchCommentsFor.push(row.url);
    } else {
      skipVideoUrls.push(row.url);
    }
  }

  return {
    reuseVideoIds,
    skipVideoUrls,
    refetchCommentsFor,
    evaluated: candidates.length,
  };
}

/**
 * article_keywords 업서트. 신규/재사용 구분 없이 모든 관련 article 에 대해 기록.
 */
export async function linkArticleKeywords(articleIds: number[], keyword: string): Promise<void> {
  if (articleIds.length === 0) return;
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return;

  await getDb()
    .insert(articleKeywords)
    .values(articleIds.map((articleId) => ({ articleId, keyword: normalized })))
    .onConflictDoNothing();
}

export async function linkVideoKeywords(videoIds: number[], keyword: string): Promise<void> {
  if (videoIds.length === 0) return;
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return;

  await getDb()
    .insert(videoKeywords)
    .values(videoIds.map((videoId) => ({ videoId, keyword: normalized })))
    .onConflictDoNothing();
}

/**
 * 재사용으로 판정된 article 에 대해 현재 jobId 로 article_jobs 연결만 추가.
 * 본문/댓글 DB 쓰기 없음 — 순수 linkage.
 */
export async function linkReusedArticlesToJob(jobId: number, articleIds: number[]): Promise<void> {
  if (articleIds.length === 0) return;
  const { articleJobs } = await import('../db/schema/collections');
  await getDb()
    .insert(articleJobs)
    .values(articleIds.map((articleId) => ({ articleId, jobId })))
    .onConflictDoNothing();
}

export async function linkReusedVideosToJob(jobId: number, videoIds: number[]): Promise<void> {
  if (videoIds.length === 0) return;
  const { videoJobs } = await import('../db/schema/collections');
  await getDb()
    .insert(videoJobs)
    .values(videoIds.map((videoId) => ({ videoId, jobId })))
    .onConflictDoNothing();
}

/**
 * 재사용된 article 에 연결된 기존 댓글을 현재 jobId 로 comment_jobs 연결.
 * 댓글 refetch 경로가 아닌 "완전 스킵" 대상의 댓글도 분석 입력에 포함시키기 위함.
 */
export async function linkReusedCommentsForArticles(
  jobId: number,
  articleIds: number[],
): Promise<number> {
  if (articleIds.length === 0) return 0;
  const { comments, commentJobs } = await import('../db/schema/collections');
  const db = getDb();
  const rows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(inArray(comments.articleId, articleIds));
  if (rows.length === 0) return 0;
  await db
    .insert(commentJobs)
    .values(rows.map((r) => ({ commentId: r.id, jobId })))
    .onConflictDoNothing();
  return rows.length;
}

export async function linkReusedCommentsForVideos(
  jobId: number,
  videoIds: number[],
): Promise<number> {
  if (videoIds.length === 0) return 0;
  const { comments, commentJobs } = await import('../db/schema/collections');
  const db = getDb();
  const rows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(inArray(comments.videoId, videoIds));
  if (rows.length === 0) return 0;
  await db
    .insert(commentJobs)
    .values(rows.map((r) => ({ commentId: r.id, jobId })))
    .onConflictDoNothing();
  return rows.length;
}

/**
 * 소스에 대해 article/video 재사용 계획을 자동 선택.
 * naver → article, youtube → video, 커뮤니티 → article 스키마 사용.
 */
export function getEntityKindForSource(source: string): 'article' | 'video' {
  if (source === 'youtube') return 'video';
  return 'article';
}
