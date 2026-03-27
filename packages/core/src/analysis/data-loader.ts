// DB에서 jobId 기반으로 수집 데이터를 로드하여 AnalysisInput 형식으로 변환
// N:M 조인 테이블 경유 조회
import { getDb } from '../db';
import { articles, videos, comments, collectionJobs, articleJobs, videoJobs, commentJobs } from '../db/schema/collections';
import { eq, desc } from 'drizzle-orm';
import type { AnalysisInput } from './types';

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

  // 기사 로드 (조인 테이블 경유)
  const articleRows = await getDb()
    .select({
      title: articles.title,
      content: articles.content,
      publisher: articles.publisher,
      publishedAt: articles.publishedAt,
      source: articles.source,
    })
    .from(articles)
    .innerJoin(articleJobs, eq(articles.id, articleJobs.articleId))
    .where(eq(articleJobs.jobId, jobId));

  // 영상 로드 (조인 테이블 경유)
  const videoRows = await getDb()
    .select({
      title: videos.title,
      description: videos.description,
      channelTitle: videos.channelTitle,
      viewCount: videos.viewCount,
      likeCount: videos.likeCount,
      publishedAt: videos.publishedAt,
    })
    .from(videos)
    .innerJoin(videoJobs, eq(videos.id, videoJobs.videoId))
    .where(eq(videoJobs.jobId, jobId));

  // 댓글 로드 (조인 테이블 경유, 좋아요순 상위 N개)
  const commentRows = await getDb()
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
    .limit(MAX_COMMENTS);

  return {
    jobId,
    keyword: job.keyword,
    articles: articleRows.map((a) => ({
      ...a,
      // 기사 본문 500자 제한
      content: a.content ? a.content.slice(0, MAX_ARTICLE_CONTENT_LENGTH) : null,
    })),
    videos: videoRows,
    comments: commentRows,
    dateRange: {
      start: job.startDate,
      end: job.endDate,
    },
  };
}
