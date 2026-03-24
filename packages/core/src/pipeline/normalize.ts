// 수집 데이터를 DB 스키마에 맞게 정규화
import type { NaverArticle, NaverComment, YoutubeVideo, YoutubeComment, CommunityPost, CommunityComment } from '@ai-signalcraft/collectors';
import type { articles, videos, comments } from '../db/schema/collections';

/** 커뮤니티 소스 타입 */
export type CommunitySource = 'dcinside' | 'fmkorea' | 'clien';

/** NaverArticle -> articles 테이블 insert 형식 */
export function normalizeNaverArticle(
  article: NaverArticle,
  jobId: number,
): typeof articles.$inferInsert {
  return {
    jobId,
    source: 'naver-news',
    sourceId: article.sourceId,
    url: article.url,
    title: article.title,
    content: article.content,
    author: article.author,
    publisher: article.publisher,
    publishedAt: article.publishedAt,
    rawData: article.rawData,
  };
}

/** NaverComment -> comments 테이블 insert 형식 */
export function normalizeNaverComment(
  comment: NaverComment,
  jobId: number,
  articleDbId?: number,
): typeof comments.$inferInsert {
  return {
    jobId,
    source: 'naver-news',
    sourceId: comment.sourceId,
    parentId: comment.parentId,
    articleId: articleDbId ?? null,
    videoId: null,
    content: comment.content,
    author: comment.author,
    likeCount: comment.likeCount,
    dislikeCount: comment.dislikeCount,
    publishedAt: comment.publishedAt,
    rawData: comment.rawData,
  };
}

/** YoutubeVideo -> videos 테이블 insert 형식 */
export function normalizeYoutubeVideo(
  video: YoutubeVideo,
  jobId: number,
): typeof videos.$inferInsert {
  return {
    jobId,
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
    publishedAt: video.publishedAt,
    rawData: video.rawData,
  };
}

/** YoutubeComment -> comments 테이블 insert 형식 */
export function normalizeYoutubeComment(
  comment: YoutubeComment,
  jobId: number,
  videoDbId?: number,
): typeof comments.$inferInsert {
  return {
    jobId,
    source: 'youtube',
    sourceId: comment.sourceId,
    parentId: comment.parentId,
    articleId: null,
    videoId: videoDbId ?? null,
    content: comment.content,
    author: comment.author,
    likeCount: comment.likeCount,
    dislikeCount: 0,
    publishedAt: comment.publishedAt,
    rawData: comment.rawData,
  };
}

/** CommunityPost -> articles 테이블 insert 형식 */
export function normalizeCommunityPost(
  post: CommunityPost,
  jobId: number,
  source: CommunitySource,
): typeof articles.$inferInsert {
  return {
    jobId,
    source,
    sourceId: post.sourceId,
    url: post.url,
    title: post.title,
    content: post.content,
    author: post.author,
    publisher: post.boardName, // 갤러리/게시판 이름을 publisher로 매핑
    publishedAt: post.publishedAt,
    rawData: post.rawData,
  };
}

/** CommunityComment -> comments 테이블 insert 형식 */
export function normalizeCommunityComment(
  comment: CommunityComment,
  jobId: number,
  source: CommunitySource,
  articleDbId?: number,
): typeof comments.$inferInsert {
  return {
    jobId,
    source,
    sourceId: comment.sourceId,
    parentId: comment.parentId,
    articleId: articleDbId ?? null,
    videoId: null,
    content: comment.content,
    author: comment.author,
    likeCount: comment.likeCount,
    dislikeCount: comment.dislikeCount,
    publishedAt: comment.publishedAt,
    rawData: comment.rawData,
  };
}
