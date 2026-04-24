// 수집 데이터를 DB 스키마에 맞게 정규화
import type {
  NaverArticle,
  NaverComment,
  YoutubeVideo,
  YoutubeComment,
  CommunityPost,
  CommunityComment,
  DataSourceSnapshot,
} from '@ai-signalcraft/collectors';
import type { articles, videos, comments } from '../db/schema/collections';
import type { CommunitySource } from '../types/pipeline';

export type { CommunitySource } from '../types/pipeline';

/** BullMQ 직렬화로 문자열이 된 Date를 복원 */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** NaverArticle -> articles 테이블 insert 형식 */
export function normalizeNaverArticle(article: NaverArticle): typeof articles.$inferInsert {
  return {
    source: 'naver-news',
    sourceId: article.sourceId,
    url: article.url,
    title: article.title,
    content: article.content,
    author: article.author,
    publisher: article.publisher,
    publishedAt: toDate(article.publishedAt),
    rawData: article.rawData,
  };
}

/**
 * 동적 소스(RSS/HTML)로부터 수집된 article을 articles 테이블 insert 형식으로 정규화.
 * - source: adapterType ('rss' | 'html')
 * - dataSourceId: data_sources 행의 uuid FK
 * - publisher: 기본값은 snapshot.name (관리자가 지정한 표시명)
 */
export function normalizeFeedArticle(
  article: NaverArticle,
  snapshot: DataSourceSnapshot,
): typeof articles.$inferInsert {
  return {
    source: snapshot.adapterType,
    sourceId: article.sourceId,
    dataSourceId: snapshot.id,
    url: article.url,
    title: article.title,
    content: article.content,
    author: article.author,
    publisher: article.publisher ?? snapshot.name,
    publishedAt: toDate(article.publishedAt),
    rawData: article.rawData,
  };
}

/** NaverComment -> comments 테이블 insert 형식 */
export function normalizeNaverComment(
  comment: NaverComment,
  articleDbId?: number,
): typeof comments.$inferInsert {
  return {
    source: 'naver-news',
    sourceId: comment.sourceId,
    parentId: comment.parentId,
    articleId: articleDbId ?? null,
    videoId: null,
    content: comment.content,
    author: comment.author,
    likeCount: comment.likeCount,
    dislikeCount: comment.dislikeCount,
    publishedAt: toDate(comment.publishedAt),
    rawData: comment.rawData,
  };
}

/** YoutubeVideo -> videos 테이블 insert 형식 */
export function normalizeYoutubeVideo(video: YoutubeVideo): typeof videos.$inferInsert {
  return {
    source: 'youtube',
    sourceId: video.sourceId,
    url: video.url,
    title: video.title,
    description: video.description,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    durationSec: video.durationSec ?? null,
    publishedAt: toDate(video.publishedAt),
    rawData: video.rawData,
    transcript: video.transcript ?? null,
    transcriptLang: video.transcriptLang ?? null,
  };
}

/** YoutubeComment -> comments 테이블 insert 형식 */
export function normalizeYoutubeComment(
  comment: YoutubeComment,
  videoDbId?: number,
): typeof comments.$inferInsert {
  return {
    source: 'youtube',
    sourceId: comment.sourceId,
    parentId: comment.parentId,
    articleId: null,
    videoId: videoDbId ?? null,
    content: comment.content,
    author: comment.author,
    likeCount: comment.likeCount,
    dislikeCount: 0,
    publishedAt: toDate(comment.publishedAt),
    rawData: comment.rawData,
  };
}

/** CommunityPost -> articles 테이블 insert 형식 */
export function normalizeCommunityPost(
  post: CommunityPost,
  source: CommunitySource,
): typeof articles.$inferInsert {
  return {
    source,
    sourceId: post.sourceId,
    url: post.url,
    title: post.title,
    content: post.content,
    author: post.author,
    publisher: post.boardName, // 갤러리/게시판 이름을 publisher로 매핑
    publishedAt: toDate(post.publishedAt),
    rawData: post.rawData,
  };
}

/** CommunityComment -> comments 테이블 insert 형식 */
export function normalizeCommunityComment(
  comment: CommunityComment,
  source: CommunitySource,
  articleDbId?: number,
): typeof comments.$inferInsert {
  return {
    source,
    sourceId: comment.sourceId,
    parentId: comment.parentId,
    articleId: articleDbId ?? null,
    videoId: null,
    content: comment.content,
    author: comment.author,
    likeCount: comment.likeCount,
    dislikeCount: comment.dislikeCount,
    publishedAt: toDate(comment.publishedAt),
    rawData: comment.rawData,
  };
}
