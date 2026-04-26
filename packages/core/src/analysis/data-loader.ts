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
const MAX_COMMENTS_RAW = 5000;

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
): Promise<{ input: AnalysisInput; samplingStats: AppliedSamplingStats }> {
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

  return loadAnalysisInputFromCollector({
    jobId,
    keyword: job.keyword,
    dateRange: {
      start: ensureDate(job.startDate),
      end: ensureDate(job.endDate),
    },
    domain: (job.domain as AnalysisDomain) || undefined,
    subscriptionId: (opts?.subscriptionId as number) || undefined,
    ragPreset,
  });
}

export function shouldUseCollectorLoader(): boolean {
  const v = process.env.USE_COLLECTOR_LOADER;
  return v === '1' || v === 'true';
}

export async function loadAnalysisInputFromCollector(
  opts: LoadFromCollectorOptions,
): Promise<{ input: AnalysisInput; samplingStats: AppliedSamplingStats }> {
  const client = getCollectorClient();
  const maxContentLength = opts.maxContentLength ?? MAX_ARTICLE_CONTENT_LENGTH;

  // P2+P4: RAG 프리셋이면 collector mode='rag'로 의미 검색 (한도×3 풀) + 부족하면 mode='all' 보충
  // 그 외(none/light/standard/aggressive)는 기존 mode='all' (legacy 경로)
  const ragConfig: RAGConfig | null = opts.ragPreset ? RAG_CONFIGS[opts.ragPreset] : null;
  const dateRangeIso = {
    start: opts.dateRange.start.toISOString(),
    end: opts.dateRange.end.toISOString(),
  };

  type CollectorItem = {
    source: string;
    sourceId: string;
    itemType: 'article' | 'video' | 'comment';
    title: string | null;
    content: string | null;
    publisher: string | null;
    publishedAt: string | Date | null;
    author: string | null;
    metrics: { viewCount?: number; likeCount?: number; commentCount?: number } | null;
  };

  /** source+sourceId+itemType 기준 dedup — collector raw_items_dedup_uniq와 동일 */
  const dedupItems = (items: CollectorItem[]): CollectorItem[] => {
    const seen = new Set<string>();
    const out: CollectorItem[] = [];
    for (const it of items) {
      const key = `${it.source}::${it.sourceId}::${it.itemType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  };

  // 기사/영상과 댓글은 다른 itemType — 병렬 호출
  // RAG 모드일 때 한도(target = articleTopK + clusterRepresentatives, commentTopK)의 3배를 받아
  // 후속 시계열 샘플링이 의미 풀 안에서 시간 균등 정렬을 다시 적용한다.
  const articleVideoTarget = ragConfig
    ? ragConfig.articleTopK + ragConfig.clusterRepresentatives
    : 0;
  const commentTarget = ragConfig?.commentTopK ?? 0;
  // collector ragOptions.topK는 schema에서 max 500으로 제한된다 (apps/collector/src/server/trpc/items.ts:46).
  // 한도 ×3을 원칙으로 하되 500 cap을 적용 — rag-standard 댓글 600 → 500. 의미 풀이 충분히 큰 데다
  // 후속 시계열 후샘플(stratifiedSample)이 200으로 줄이므로 300/500 차이는 분석 결과에 큰 영향 없다.
  const RAG_TOPK_CAP = 500;
  const articleVideoTopK = Math.min(articleVideoTarget * 3, RAG_TOPK_CAP);
  const commentTopK = Math.min(commentTarget * 3, RAG_TOPK_CAP);

  const [articlesVideosResp, commentsResp] = await Promise.all([
    ragConfig && articleVideoTopK > 0
      ? client.items.query.query({
          keyword: opts.keyword,
          dateRange: dateRangeIso,
          sources: opts.sources,
          itemTypes: ['article', 'video'],
          subscriptionId: opts.subscriptionId,
          mode: 'rag',
          ragOptions: { topK: articleVideoTopK, semanticQuery: opts.keyword },
          maxContentLength,
          limit: articleVideoTopK,
        })
      : client.items.query.query({
          keyword: opts.keyword,
          dateRange: dateRangeIso,
          sources: opts.sources,
          itemTypes: ['article', 'video'],
          subscriptionId: opts.subscriptionId,
          mode: 'all',
          maxContentLength,
          limit: 2000,
        }),
    ragConfig && commentTopK > 0
      ? client.items.query.query({
          keyword: opts.keyword,
          dateRange: dateRangeIso,
          sources: opts.sources,
          itemTypes: ['comment'],
          subscriptionId: opts.subscriptionId,
          mode: 'rag',
          ragOptions: { topK: commentTopK, semanticQuery: opts.keyword },
          maxComments: maxContentLength,
          limit: commentTopK,
        })
      : client.items.query.query({
          keyword: opts.keyword,
          dateRange: dateRangeIso,
          sources: opts.sources,
          itemTypes: ['comment'],
          subscriptionId: opts.subscriptionId,
          mode: 'all',
          maxComments: maxContentLength,
          limit: MAX_COMMENTS_RAW,
        }),
  ]);

  // RAG 보충 호출: 응답이 요청 topK의 80% 미만이면 mode='all'로 빈자리 채움
  let articleVideoItems = articlesVideosResp.items as unknown as CollectorItem[];
  let commentItems = commentsResp.items as unknown as CollectorItem[];

  if (ragConfig) {
    const fillTasks: Array<Promise<void>> = [];
    if (articleVideoTopK > 0 && articleVideoItems.length < articleVideoTopK * 0.8) {
      fillTasks.push(
        client.items.query
          .query({
            keyword: opts.keyword,
            dateRange: dateRangeIso,
            sources: opts.sources,
            itemTypes: ['article', 'video'],
            subscriptionId: opts.subscriptionId,
            mode: 'all',
            maxContentLength,
            limit: 2000,
          })
          .then((fillResp) => {
            articleVideoItems = dedupItems([
              ...articleVideoItems,
              ...(fillResp.items as unknown as CollectorItem[]),
            ]);
          }),
      );
    }
    if (commentTopK > 0 && commentItems.length < commentTopK * 0.8) {
      fillTasks.push(
        client.items.query
          .query({
            keyword: opts.keyword,
            dateRange: dateRangeIso,
            sources: opts.sources,
            itemTypes: ['comment'],
            subscriptionId: opts.subscriptionId,
            mode: 'all',
            maxComments: maxContentLength,
            limit: MAX_COMMENTS_RAW,
          })
          .then((fillResp) => {
            commentItems = dedupItems([
              ...commentItems,
              ...(fillResp.items as unknown as CollectorItem[]),
            ]);
          }),
      );
    }
    if (fillTasks.length > 0) {
      await Promise.all(fillTasks);
    }
  }

  const toDate = (d: string | Date | null): Date => {
    if (!d) return new Date(0);
    return d instanceof Date ? d : new Date(d);
  };

  const articlesOut = articleVideoItems
    .filter((i) => i.itemType === 'article' && i.title)
    .map((a) => ({
      title: a.title as string,
      content: a.content,
      publisher: a.publisher,
      publishedAt: toDate(a.publishedAt),
      source: a.source,
    }));

  const videosOut = articleVideoItems
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

  const commentsOut = commentItems
    .filter((c) => c.content)
    .map((c) => ({
      content: c.content as string,
      source: c.source,
      author: c.author,
      likeCount: c.metrics?.likeCount ?? null,
      dislikeCount: null,
      publishedAt: toDate(c.publishedAt),
    }));

  const rawInput: AnalysisInput = {
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

  const budget = calculateBudget({
    dateRange: rawInput.dateRange,
    totalArticles: rawInput.articles.length,
    totalComments: rawInput.comments.length,
    totalVideos: rawInput.videos.length,
  });

  const sampled = applyTimeSeriesSampling(rawInput, budget);
  return { input: sampled.input, samplingStats: sampled.stats };
}
