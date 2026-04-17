// Period 모드에서 사용자가 입력한 "날짜별 한도"를 수집기에 전달할 총량으로 확장하기 위한 순수 헬퍼.
// Redis/DB 의존성이 없어 단위 테스트 가능. flows.ts에서만 사용.

export type LimitMode = 'perDay' | 'total';

export interface CollectionLimitValues {
  naverArticles: number;
  youtubeVideos: number;
  communityPosts: number;
  commentsPerItem: number;
}

// naver-news 어댑터의 splitIntoDays와 동일 규칙(로컬 TZ, inclusive, 최소 1일)으로 날짜 수 계산.
export function computeDayCount(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(1, days);
}

// mode === 'perDay' 일 때만 naver/youtube/community 한도에 dayCount를 곱한다.
// commentsPerItem은 항목당 상한이므로 항상 그대로 유지.
export function applyPerDayInflation(
  limits: CollectionLimitValues,
  dayCount: number,
  mode: LimitMode | undefined,
): CollectionLimitValues {
  if (mode !== 'perDay' || dayCount <= 1) {
    return { ...limits };
  }
  return {
    naverArticles: limits.naverArticles * dayCount,
    youtubeVideos: limits.youtubeVideos * dayCount,
    communityPosts: limits.communityPosts * dayCount,
    commentsPerItem: limits.commentsPerItem,
  };
}
