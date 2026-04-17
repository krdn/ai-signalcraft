import { describe, it, expect } from 'vitest';
import {
  toLimitCell,
  mergeLimits,
  buildDateRange,
  mergeTimeline,
  collectDateKeys,
} from '@/components/dashboard/summary-widgets/helpers';

describe('toLimitCell', () => {
  it('actual/limit 비율을 소수점 1자리까지 계산', () => {
    expect(toLimitCell(150, 500)).toEqual({ limit: 500, actual: 150, pct: 30 });
    expect(toLimitCell(1, 3)).toEqual({ limit: 3, actual: 1, pct: 33.3 });
  });

  it('limit 0/음수일 때 pct 0', () => {
    expect(toLimitCell(50, 0)).toEqual({ limit: 0, actual: 50, pct: 0 });
    expect(toLimitCell(50, -1)).toEqual({ limit: 0, actual: 50, pct: 0 });
  });

  it('actual이 limit을 초과해도 pct 그대로 반환(cap은 UI에서)', () => {
    expect(toLimitCell(600, 500).pct).toBe(120);
  });
});

describe('mergeLimits', () => {
  const defaults = {
    naverArticles: 500,
    youtubeVideos: 50,
    communityPosts: 50,
    commentsPerItem: 500,
  };

  it('jobLimits가 null이면 defaults 반환 + source=default', () => {
    const { effective, source } = mergeLimits(null, defaults);
    expect(effective).toEqual(defaults);
    expect(source).toBe('default');
  });

  it('jobLimits가 undefined여도 defaults 반환', () => {
    const { source } = mergeLimits(undefined, defaults);
    expect(source).toBe('default');
  });

  it('jobLimits가 부분적일 때 defaults와 병합', () => {
    const { effective, source } = mergeLimits({ naverArticles: 1000 }, defaults);
    expect(effective.naverArticles).toBe(1000);
    expect(effective.youtubeVideos).toBe(50);
    expect(source).toBe('job');
  });
});

describe('buildDateRange', () => {
  it('start=end이면 1일', () => {
    const d = new Date('2026-04-15T00:00:00Z');
    expect(buildDateRange(d, d)).toEqual(['2026-04-15']);
  });

  it('end < start이면 빈 배열', () => {
    const a = new Date('2026-04-15T00:00:00Z');
    const b = new Date('2026-04-10T00:00:00Z');
    expect(buildDateRange(a, b)).toEqual([]);
  });

  it('여러 날짜 범위 생성', () => {
    const a = new Date('2026-04-14T00:00:00Z');
    const b = new Date('2026-04-17T00:00:00Z');
    expect(buildDateRange(a, b)).toEqual(['2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17']);
  });
});

describe('mergeTimeline', () => {
  it('날짜 키 순서대로 3개 시리즈 병합, 누락은 0', () => {
    const a = new Map([
      ['2026-04-15', 10],
      ['2026-04-16', 20],
    ]);
    const v = new Map([['2026-04-16', 5]]);
    const c = new Map([
      ['2026-04-15', 100],
      ['2026-04-17', 50],
    ]);

    const result = mergeTimeline(a, v, c, ['2026-04-15', '2026-04-16', '2026-04-17']);
    expect(result).toEqual([
      { date: '2026-04-15', articles: 10, videos: 0, comments: 100 },
      { date: '2026-04-16', articles: 20, videos: 5, comments: 0 },
      { date: '2026-04-17', articles: 0, videos: 0, comments: 50 },
    ]);
  });
});

describe('collectDateKeys', () => {
  it('여러 Map의 키 합집합 정렬', () => {
    const m1 = new Map([['2026-04-16', 1]]);
    const m2 = new Map([
      ['2026-04-15', 1],
      ['2026-04-17', 1],
    ]);
    expect(collectDateKeys(m1, m2)).toEqual(['2026-04-15', '2026-04-16', '2026-04-17']);
  });

  it('모두 비어있으면 빈 배열', () => {
    expect(collectDateKeys(new Map(), new Map())).toEqual([]);
  });
});
