import type { AnalysisInput } from '../types';

// 본문 최대 길이 제한 (토큰 최적화)
const MAX_CONTENT_LENGTH = 500;

// 입력 데이터를 프롬프트용 구조로 변환
export function formatInputData(data: AnalysisInput) {
  const formatDate = (d: Date | null) => (d ? d.toISOString().split('T')[0] : '날짜 미상');

  const articles = data.articles.map((a) => ({
    title: a.title,
    content: a.content
      ? a.content.length > MAX_CONTENT_LENGTH
        ? a.content.slice(0, MAX_CONTENT_LENGTH) + '...'
        : a.content
      : '(본문 없음)',
    source: a.source,
    publisher: a.publisher ?? '출처 미상',
    publishedAt: formatDate(a.publishedAt),
  }));

  const videos = data.videos.map((v) => ({
    title: v.title,
    channel: v.channelTitle ?? '채널 미상',
    viewCount: v.viewCount ?? 0,
    likeCount: v.likeCount ?? 0,
    publishedAt: formatDate(v.publishedAt),
  }));

  const comments = data.comments.map((c) => ({
    content: c.content,
    source: c.source,
    author: c.author ?? '익명',
    likeCount: c.likeCount ?? 0,
    publishedAt: formatDate(c.publishedAt),
  }));

  const dateRange = `${formatDate(data.dateRange.start)} ~ ${formatDate(data.dateRange.end)}`;

  return { articles, videos, comments, dateRange };
}
