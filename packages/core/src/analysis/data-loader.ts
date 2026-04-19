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
import type { AnalysisInput } from './types';
import type { AnalysisDomain } from './domain';

// 토큰 절약 상수 (Pitfall 1 대응)
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
