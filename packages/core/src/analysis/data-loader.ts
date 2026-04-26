// DB에서 jobId 기반으로 수집 데이터를 로드하여 AnalysisInput 형식으로 변환
// N:M 조인 테이블 경유 조회
import { eq } from 'drizzle-orm';
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
import { applyTimeSeriesSampling, calculateBudget, type AppliedSamplingStats } from './sampling';
import { RAG_CONFIGS, type RAGConfig } from './preprocessing/rag-retriever';

// 토큰 절약 상수 — collector API에 인자로 전달 (기본값, 호출부에서 override 가능)
const MAX_ARTICLE_CONTENT_LENGTH = 500;

/**
 * collector fullset payload — 분석 DB 영속화(article_jobs/comment_jobs) 입력으로 사용.
 * articles/videos/comments는 Drizzle insert 형태.
 */
export type CollectorFullset = {
  articles: (typeof articles.$inferInsert)[];
  videos: (typeof videos.$inferInsert)[];
  comments: (typeof comments.$inferInsert)[];
};

export type CollectionMeta = {
  sources: string[];
  sourceCounts: Record<string, { articles: number; comments: number; videos: number }>;
  window: { start: string; end: string };
  truncated: boolean;
};

export type CollectorAnalysisResult = {
  input: AnalysisInput;
  samplingStats: AppliedSamplingStats;
  fullset: CollectorFullset;
  collectionMeta: CollectionMeta;
};

/**
 * 수집 작업 데이터를 분석 입력 형식으로 로드
 * - 조인 테이블(articleJobs/videoJobs/commentJobs) 경유 조회
 * - 기사 본문 500자 제한 (토큰 절약)
 * - 댓글 좋아요순 상위 500개 제한
 */
export async function loadAnalysisInput(
  jobId: number,
): Promise<{ input: AnalysisInput; samplingStats: AppliedSamplingStats }> {
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
      .where(eq(commentJobs.jobId, jobId)),
  ]);

  // Drizzle ORM이 timestamp 컬럼을 문자열로 반환할 수 있으므로 Date 객체로 보장
  const ensureDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

  const rawInput: AnalysisInput = {
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

  const budget = calculateBudget({
    dateRange: rawInput.dateRange,
    totalArticles: rawInput.articles.length,
    totalComments: rawInput.comments.length,
    totalVideos: rawInput.videos.length,
  });

  const sampled = applyTimeSeriesSampling(rawInput, budget);
  return { input: sampled.input, samplingStats: sampled.stats };
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
  /**
   * P2+P4: RAG 프리셋 — 지정 시 collector mode='rag'로 의미 관련 항목만 로드.
   * undefined면 mode='all'(기존 동작).
   */
  ragPreset?: 'rag-light' | 'rag-standard' | 'rag-aggressive';
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
export async function loadAnalysisInputViaCollector(
  jobId: number,
): Promise<CollectorAnalysisResult> {
  const [job] = await getDb()
    .select()
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new Error(`Collection job not found: ${jobId}`);
  }

  const ensureDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
  const opts = job.options as Record<string, unknown> | undefined;

  // P2+P4: tokenOptimization이 RAG 프리셋이면 collector RAG 모드 사용
  const tokenOpt = opts?.tokenOptimization as string | undefined;
  const ragPreset =
    tokenOpt === 'rag-light' || tokenOpt === 'rag-standard' || tokenOpt === 'rag-aggressive'
      ? tokenOpt
      : undefined;

  const VALID_SOURCES = ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'] as const;
  type ValidSource = (typeof VALID_SOURCES)[number];
  const optsSources = (opts?.sources as string[] | undefined)?.filter((s): s is ValidSource =>
    (VALID_SOURCES as readonly string[]).includes(s),
  );

  return loadAnalysisInputFromCollector({
    jobId,
    keyword: job.keyword,
    dateRange: {
      start: ensureDate(job.startDate),
      end: ensureDate(job.endDate),
    },
    domain: (job.domain as AnalysisDomain) || undefined,
    subscriptionId: (opts?.subscriptionId as number) || undefined,
    sources: optsSources,
    ragPreset,
  });
}

export function shouldUseCollectorLoader(): boolean {
  const v = process.env.USE_COLLECTOR_LOADER;
  return v === '1' || v === 'true';
}

export async function loadAnalysisInputFromCollector(
  opts: LoadFromCollectorOptions,
): Promise<CollectorAnalysisResult> {
  const client = getCollectorClient();
  const maxContentLength = opts.maxContentLength ?? MAX_ARTICLE_CONTENT_LENGTH;

  const ragConfig: RAGConfig | null = opts.ragPreset ? RAG_CONFIGS[opts.ragPreset] : null;
  const articleVideoTarget = ragConfig
    ? ragConfig.articleTopK + ragConfig.clusterRepresentatives
    : 0;
  const commentTarget = ragConfig?.commentTopK ?? 0;
  const RAG_TOPK_CAP = 500;
  // 0이면 RAG 안 함(전체 유지 의미). 그 외에는 ×3 + cap.
  const articleVideoTopK =
    articleVideoTarget > 0 ? Math.min(articleVideoTarget * 3, RAG_TOPK_CAP) : 0;
  const commentTopK = commentTarget > 0 ? Math.min(commentTarget * 3, RAG_TOPK_CAP) : 0;

  const dateRangeIso = {
    start: opts.dateRange.start.toISOString(),
    end: opts.dateRange.end.toISOString(),
  };

  // 단일 RPC: ragSample + fullset + collectionMeta
  // articleVideoTopK=0이면 ragOptions에 그 키를 보내지 않는다 —
  // collector는 미지정 itemType을 ragSample에 넣지 않고, 분석 측이 fullset으로 폴백한다.
  const resp = await client.items.fetchAnalysisPayload.query({
    keyword: opts.keyword,
    dateRange: dateRangeIso,
    sources: opts.sources,
    subscriptionId: opts.subscriptionId,
    ragOptions:
      articleVideoTopK > 0 || commentTopK > 0
        ? {
            ...(articleVideoTopK > 0 ? { articleVideoTopK } : {}),
            ...(commentTopK > 0 ? { commentTopK } : {}),
          }
        : undefined,
    maxContentLength,
  });

  // ragSample → AnalysisInput
  // itemType별로 독립 폴백 — ragSample에 해당 itemType이 없으면 fullset 전체를 사용.
  // rag-light처럼 articleTopK=0인 프리셋은 ragSample에 기사가 없으므로 fullset에서 전체 유지.
  // rag-standard처럼 RAG가 유사도 미달로 0건을 반환했을 때도 fullset으로 자동 복구.
  const ragArticles = resp.ragSample.filter((i) => i.itemType === 'article');
  const ragVideos = resp.ragSample.filter((i) => i.itemType === 'video');
  const ragComments = resp.ragSample.filter((i) => i.itemType === 'comment');

  const articleRows =
    ragArticles.length > 0 ? ragArticles : resp.fullset.filter((i) => i.itemType === 'article');
  const videoRows =
    ragVideos.length > 0 ? ragVideos : resp.fullset.filter((i) => i.itemType === 'video');
  const commentRows =
    ragComments.length > 0 ? ragComments : resp.fullset.filter((i) => i.itemType === 'comment');

  const articlesOut = articleRows
    .filter((a) => a.title)
    .map((a) => ({
      title: a.title as string,
      content: (a.content as string) ?? null,
      publisher: (a.publisher as string) ?? null,
      publishedAt: toDate(a.publishedAt as string | Date | null),
      source: a.source as string,
    }));

  const videosOut = videoRows
    .filter((v) => v.title)
    .map((v) => ({
      title: v.title as string,
      description: (v.content as string) ?? null,
      channelTitle: (v.publisher as string) ?? null,
      viewCount: ((v.metrics as Record<string, number> | null)?.viewCount as number) ?? null,
      likeCount: ((v.metrics as Record<string, number> | null)?.likeCount as number) ?? null,
      publishedAt: toDate(v.publishedAt as string | Date | null),
      content: (v.content as string) ?? null,
    }));

  const commentsOut = commentRows
    .filter((c) => c.content)
    .map((c) => ({
      content: c.content as string,
      source: c.source as string,
      author: (c.author as string) ?? null,
      likeCount: ((c.metrics as Record<string, number> | null)?.likeCount as number) ?? null,
      dislikeCount: null,
      publishedAt: toDate(c.publishedAt as string | Date | null),
    }));

  const rawInput: AnalysisInput = {
    jobId: opts.jobId,
    keyword: opts.keyword,
    articles: articlesOut,
    videos: videosOut,
    comments: commentsOut,
    dateRange: { start: opts.dateRange.start, end: opts.dateRange.end },
    domain: opts.domain,
  };

  const budget = calculateBudget({
    dateRange: rawInput.dateRange,
    totalArticles: rawInput.articles.length,
    totalComments: rawInput.comments.length,
    totalVideos: rawInput.videos.length,
  });
  const sampled = applyTimeSeriesSampling(rawInput, budget);

  // fullset → DB upsert 형태로 변환 (linkage 복원용)
  const fullset = mapFullsetToInsertShape(resp.fullset);

  return {
    input: sampled.input,
    samplingStats: sampled.stats,
    fullset,
    collectionMeta: resp.collectionMeta,
  };
}

function toDate(d: string | Date | null): Date {
  if (!d) return new Date(0);
  return d instanceof Date ? d : new Date(d);
}

function mapFullsetToInsertShape(rows: Array<Record<string, unknown>>): CollectorFullset {
  const articleRows: (typeof articles.$inferInsert)[] = [];
  const videoRows: (typeof videos.$inferInsert)[] = [];
  const commentRows: (typeof comments.$inferInsert)[] = [];

  for (const r of rows) {
    const itemType = r.itemType as string;
    const source = r.source as string;
    const sourceId = r.sourceId as string;
    const title = (r.title as string) ?? '';
    const url = (r.url as string) ?? '';
    const metrics = r.metrics as Record<string, number> | null;
    const pub = r.publishedAt ? toDate(r.publishedAt as string) : null;

    if (itemType === 'article') {
      articleRows.push({
        source,
        sourceId,
        url,
        title,
        content: (r.content as string) ?? null,
        author: (r.author as string) ?? null,
        publisher: (r.publisher as string) ?? null,
        publishedAt: pub,
      });
    } else if (itemType === 'video') {
      videoRows.push({
        source,
        sourceId,
        url,
        title,
        description: (r.content as string) ?? null,
        channelTitle: (r.publisher as string) ?? null,
        viewCount: metrics?.viewCount ?? null,
        likeCount: metrics?.likeCount ?? null,
        commentCount: metrics?.commentCount ?? null,
        publishedAt: pub,
        durationSec: (r.durationSec as number) ?? null,
        transcript: (r.transcript as string) ?? null,
        transcriptLang: (r.transcriptLang as string) ?? null,
      });
    } else if (itemType === 'comment') {
      commentRows.push({
        source,
        sourceId,
        content: (r.content as string) ?? '',
        author: (r.author as string) ?? null,
        likeCount: metrics?.likeCount ?? 0,
        dislikeCount: 0,
        publishedAt: pub,
        parentId: (r.parentSourceId as string) ?? null,
      });
    }
  }

  return { articles: articleRows, videos: videoRows, comments: commentRows };
}
