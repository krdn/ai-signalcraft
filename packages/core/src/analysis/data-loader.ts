// DB에서 jobId 기반으로 수집 데이터를 로드하여 AnalysisInput 형식으로 변환
// N:M 조인 테이블 경유 조회
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db';
import {
  articles,
  videos,
  comments,
  collectionJobs,
  articleJobs,
  videoJobs,
  commentJobs,
} from '../db/schema/collections';
import { getCollectorClient } from '../collector-client';
import type { AnalysisInput } from './types';
import type { AnalysisDomain } from './domain';

// 토큰 절약 상수 — collector API에 인자로 전달 (기본값, 호출부에서 override 가능)
const MAX_ARTICLE_CONTENT_LENGTH = 500;
const MAX_COMMENTS = 500;

/**
 * 수집 작업 데이터를 분석 입력 형식으로 로드
 * - 조인 테이블(articleJobs/videoJobs/commentJobs) 경유 조회
 * - 기사 본문 500자 제한 (토큰 절약)
 * - 댓글 좋아요순 상위 500개 제한
 */
export async function loadAnalysisInput(jobId: number): Promise<AnalysisInput> {
  // 작업 정보 조회
  const [job] = await getDb()
    .select()
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`Collection job not found: ${jobId}`);
  }

  const db = getDb();

  // 기사/영상/댓글 병렬 로드 (DB RTT 3회 → 1회 수준으로 단축)
  const [articleRows, videoRows, commentRows] = await Promise.all([
    db
      .select({
        title: articles.title,
        content: articles.content,
        publisher: articles.publisher,
        publishedAt: articles.publishedAt,
        source: articles.source,
      })
      .from(articles)
      .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
      .where(eq(articleJobs.jobId, jobId)),
    db
      .select({
        title: videos.title,
        description: videos.description,
        transcript: videos.transcript,
        channelTitle: videos.channelTitle,
        viewCount: videos.viewCount,
        likeCount: videos.likeCount,
        publishedAt: videos.publishedAt,
      })
      .from(videos)
      .innerJoin(videoJobs, eq(videos.id, videoJobs.videoId))
      .where(eq(videoJobs.jobId, jobId)),
    db
      .select({
        content: comments.content,
        source: comments.source,
        author: comments.author,
        likeCount: comments.likeCount,
        dislikeCount: comments.dislikeCount,
        publishedAt: comments.publishedAt,
      })
      .from(comments)
      .innerJoin(commentJobs, eq(comments.id, commentJobs.commentId))
      .where(eq(commentJobs.jobId, jobId))
      .orderBy(desc(comments.likeCount))
      .limit(MAX_COMMENTS),
  ]);

  // Drizzle ORM이 timestamp 컬럼을 문자열로 반환할 수 있으므로 Date 객체로 보장
  const ensureDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

  return {
    jobId,
    keyword: job.keyword,
    articles: articleRows.map((a) => ({
      ...a,
      // 기사 본문 500자 제한
      content: a.content ? a.content.slice(0, MAX_ARTICLE_CONTENT_LENGTH) : null,
    })),
    videos: videoRows.map((v) => {
      const raw = v.transcript ?? v.description ?? null;
      return {
        ...v,
        content: raw ? raw.slice(0, MAX_ARTICLE_CONTENT_LENGTH) : null,
      };
    }),
    comments: commentRows,
    dateRange: {
      start: ensureDate(job.startDate),
      end: ensureDate(job.endDate),
    },
    domain: (job.domain as AnalysisDomain) || undefined,
  };
}

export interface LoadFromCollectorOptions {
  keyword: string;
  subscriptionId?: number;
  dateRange: { start: Date; end: Date };
  sources?: Array<'naver-news' | 'youtube' | 'dcinside' | 'fmkorea' | 'clien'>;
  maxContentLength?: number;
  maxComments?: number;
  domain?: AnalysisDomain;
  /** 분석 jobId — 결과 저장 및 로그용. 실제 데이터와 무관 */
  jobId: number;
}

/**
 * collector 서비스의 items.query API를 통해 분석 입력을 구성.
 *
 * 장점:
 *   - 수집/분석이 완전히 분리되어 분석 시 신규 수집이 발생하지 않음
 *   - maxContentLength / maxComments를 호출부에서 명시적으로 지정 (하드코딩 제거)
 *   - 동일 키워드·기간을 반복 분석해도 저장소를 공유
 */
/**
 * jobId로 collector API 경로를 통해 분석 입력을 로드.
 *
 * legacy `loadAnalysisInput`(N:M 조인)의 collector-backed 대체.
 * `USE_COLLECTOR_LOADER=1` 환경에서 orchestrator가 선택할 수 있도록 같은 시그니처 제공.
 */
export async function loadAnalysisInputViaCollector(jobId: number): Promise<AnalysisInput> {
  const [job] = await getDb()
    .select()
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`Collection job not found: ${jobId}`);
  }

  const ensureDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

  return loadAnalysisInputFromCollector({
    jobId,
    keyword: job.keyword,
    dateRange: {
      start: ensureDate(job.startDate),
      end: ensureDate(job.endDate),
    },
    domain: (job.domain as AnalysisDomain) || undefined,
  });
}

export function shouldUseCollectorLoader(): boolean {
  const v = process.env.USE_COLLECTOR_LOADER;
  return v === '1' || v === 'true';
}

export async function loadAnalysisInputFromCollector(
  opts: LoadFromCollectorOptions,
): Promise<AnalysisInput> {
  const client = getCollectorClient();
  const maxContentLength = opts.maxContentLength ?? MAX_ARTICLE_CONTENT_LENGTH;
  const maxComments = opts.maxComments ?? MAX_COMMENTS;

  // 기사/영상과 댓글은 다른 itemType — 병렬 호출
  const [articlesVideosResp, commentsResp] = await Promise.all([
    client.items.query.query({
      keyword: opts.keyword,
      dateRange: {
        start: opts.dateRange.start.toISOString(),
        end: opts.dateRange.end.toISOString(),
      },
      sources: opts.sources,
      itemTypes: ['article', 'video'],
      subscriptionId: opts.subscriptionId,
      mode: 'all',
      maxContentLength,
      limit: 2000,
    }),
    client.items.query.query({
      keyword: opts.keyword,
      dateRange: {
        start: opts.dateRange.start.toISOString(),
        end: opts.dateRange.end.toISOString(),
      },
      sources: opts.sources,
      itemTypes: ['comment'],
      subscriptionId: opts.subscriptionId,
      mode: 'all',
      maxComments,
      limit: maxComments,
    }),
  ]);

  type CollectorItem = {
    source: string;
    itemType: 'article' | 'video' | 'comment';
    title: string | null;
    content: string | null;
    publisher: string | null;
    publishedAt: string | Date | null;
    author: string | null;
    metrics: { viewCount?: number; likeCount?: number; commentCount?: number } | null;
  };

  const toDate = (d: string | Date | null): Date => {
    if (!d) return new Date(0);
    return d instanceof Date ? d : new Date(d);
  };

  const articlesOut = (articlesVideosResp.items as unknown as CollectorItem[])
    .filter((i) => i.itemType === 'article' && i.title)
    .map((a) => ({
      title: a.title as string,
      content: a.content,
      publisher: a.publisher,
      publishedAt: toDate(a.publishedAt),
      source: a.source,
    }));

  const videosOut = (articlesVideosResp.items as unknown as CollectorItem[])
    .filter((i) => i.itemType === 'video' && i.title)
    .map((v) => ({
      title: v.title as string,
      description: v.content,
      channelTitle: v.publisher,
      viewCount: v.metrics?.viewCount ?? null,
      likeCount: v.metrics?.likeCount ?? null,
      publishedAt: toDate(v.publishedAt),
      content: v.content,
    }));

  const commentsOut = (commentsResp.items as unknown as CollectorItem[])
    .filter((c) => c.content)
    .map((c) => ({
      content: c.content as string,
      source: c.source,
      author: c.author,
      likeCount: c.metrics?.likeCount ?? null,
      dislikeCount: null,
      publishedAt: toDate(c.publishedAt),
    }));

  return {
    jobId: opts.jobId,
    keyword: opts.keyword,
    articles: articlesOut,
    videos: videosOut,
    comments: commentsOut,
    dateRange: {
      start: opts.dateRange.start,
      end: opts.dateRange.end,
    },
    domain: opts.domain,
  };
}
