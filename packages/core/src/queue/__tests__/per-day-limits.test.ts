import { describe, expect, it } from 'vitest';
import {
  applyPerDayInflation,
  computeDayCount,
  type CollectionLimitValues,
} from '../per-day-limits';

const sampleLimits: CollectionLimitValues = {
  naverArticles: 100,
  youtubeVideos: 20,
  communityPosts: 30,
  commentsPerItem: 500,
};

describe('computeDayCount', () => {
  it('동일 날짜는 1일로 계산된다', () => {
    const iso = '2026-04-15T12:00:00.000Z';
    expect(computeDayCount(iso, iso)).toBe(1);
  });

  it('인접 1일 차이는 2일로 계산된다 (inclusive)', () => {
    const start = '2026-04-15T00:00:00.000Z';
    const end = '2026-04-16T00:00:00.000Z';
    expect(computeDayCount(start, end)).toBe(2);
  });

  it('7일 범위는 8일로 계산된다 (inclusive)', () => {
    const start = '2026-04-10T00:00:00.000Z';
    const end = '2026-04-17T00:00:00.000Z';
    expect(computeDayCount(start, end)).toBe(8);
  });

  it('월 경계를 넘어가도 정상 계산된다', () => {
    const start = '2026-03-29T00:00:00.000Z';
    const end = '2026-04-02T00:00:00.000Z';
    expect(computeDayCount(start, end)).toBe(5);
  });

  it('end < start 같은 비정상 입력에도 최소 1일을 반환한다', () => {
    const start = '2026-04-17T00:00:00.000Z';
    const end = '2026-04-10T00:00:00.000Z';
    expect(computeDayCount(start, end)).toBe(1);
  });
});

describe('applyPerDayInflation', () => {
  it("'perDay' 모드에서 naver/youtube/community에만 dayCount를 곱한다", () => {
    const result = applyPerDayInflation(sampleLimits, 7, 'perDay');
    expect(result.naverArticles).toBe(700);
    expect(result.youtubeVideos).toBe(140);
    expect(result.communityPosts).toBe(210);
    // commentsPerItem은 항목당 한도라 곱하지 않음
    expect(result.commentsPerItem).toBe(500);
  });

  it("'total' 모드에서는 입력값을 그대로 반환한다", () => {
    const result = applyPerDayInflation(sampleLimits, 7, 'total');
    expect(result).toEqual(sampleLimits);
  });

  it('mode가 undefined면 total로 간주되어 원본과 동일하다', () => {
    const result = applyPerDayInflation(sampleLimits, 7, undefined);
    expect(result).toEqual(sampleLimits);
  });

  it("'perDay' + dayCount=1은 팽창 없이 그대로 반환된다", () => {
    const result = applyPerDayInflation(sampleLimits, 1, 'perDay');
    expect(result).toEqual(sampleLimits);
  });

  it('반환값은 원본 객체와 참조가 분리되어 있다 (mutation 안전)', () => {
    const result = applyPerDayInflation(sampleLimits, 3, 'perDay');
    expect(result).not.toBe(sampleLimits);
  });
});
