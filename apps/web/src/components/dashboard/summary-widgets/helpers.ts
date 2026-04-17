import type { CollectionLimits } from '@ai-signalcraft/core';

export type TimelinePoint = {
  date: string; // YYYY-MM-DD (KST)
  articles: number;
  videos: number;
  comments: number;
};

export type LimitCell = {
  limit: number;
  actual: number;
  pct: number;
};

export type LimitsSummary = {
  naverArticles: LimitCell;
  youtubeVideos: LimitCell;
  communityPosts: LimitCell;
  commentsPerItem: LimitCell & { actualAvg: number; actualMax: number };
};

export function toLimitCell(actual: number, limit: number): LimitCell {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 0;
  const pct = safeLimit > 0 ? Math.round((actual / safeLimit) * 1000) / 10 : 0;
  return { limit: safeLimit, actual, pct };
}

export function mergeLimits(
  jobLimits: Partial<CollectionLimits> | null | undefined,
  defaults: CollectionLimits,
): { effective: CollectionLimits; source: 'job' | 'default' } {
  if (!jobLimits) return { effective: { ...defaults }, source: 'default' };
  return {
    effective: {
      naverArticles: jobLimits.naverArticles ?? defaults.naverArticles,
      youtubeVideos: jobLimits.youtubeVideos ?? defaults.youtubeVideos,
      communityPosts: jobLimits.communityPosts ?? defaults.communityPosts,
      commentsPerItem: jobLimits.commentsPerItem ?? defaults.commentsPerItem,
    },
    source: 'job',
  };
}

function toKSTDateString(d: Date): string {
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

export function buildDateRange(start: Date, end: Date): string[] {
  if (end < start) return [];
  const out: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    out.push(toKSTDateString(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function mergeTimeline(
  articlesByDate: Map<string, number>,
  videosByDate: Map<string, number>,
  commentsByDate: Map<string, number>,
  dateKeys: string[],
): TimelinePoint[] {
  return dateKeys.map((date) => ({
    date,
    articles: articlesByDate.get(date) ?? 0,
    videos: videosByDate.get(date) ?? 0,
    comments: commentsByDate.get(date) ?? 0,
  }));
}

export function collectDateKeys(...maps: Map<string, number>[]): string[] {
  const set = new Set<string>();
  for (const m of maps) for (const k of m.keys()) set.add(k);
  return Array.from(set).sort();
}
