export function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString('ko-KR');
}

export const SOURCE_LABEL_MAP: Record<string, string> = {
  'naver-news': '네이버 뉴스',
  'naver-comments': '네이버 댓글',
  youtube: '유튜브',
  dcinside: 'DC인사이드',
  fmkorea: '오늘의유머',
  clien: ' Clien',
};
