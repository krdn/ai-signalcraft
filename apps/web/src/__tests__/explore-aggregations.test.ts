import { describe, it, expect } from 'vitest';
import { DEFAULT_FILTERS, type ExploreFilterState } from '@/components/explore/explore-filters';
import { EXPLORE_HELP, SENTIMENT_COLORS } from '@/components/explore/explore-help';

/**
 * 탐색 탭 순수 로직 단위 테스트
 * — DB 통합 테스트는 별도 integration suite에서 수행
 * — 여기서는 필터 상태/헬프 메시지/색상 상수 shape 검증
 */

describe('DEFAULT_FILTERS', () => {
  it('빈 상태로 초기화되어야 함', () => {
    expect(DEFAULT_FILTERS.sources).toEqual([]);
    expect(DEFAULT_FILTERS.sentiments).toEqual([]);
    expect(DEFAULT_FILTERS.minScore).toBe(0);
    expect(DEFAULT_FILTERS.itemType).toBe('both');
  });

  it('ExploreFilterState 타입 호환', () => {
    const valid: ExploreFilterState = {
      sources: ['naver-news', 'youtube'],
      sentiments: ['positive', 'negative'],
      minScore: 0.7,
      itemType: 'comments',
      dateScope: 'job',
    };
    expect(valid.sources).toHaveLength(2);
  });
});

describe('EXPLORE_HELP', () => {
  const expectedKeys = [
    'filters',
    'stream',
    'calendar',
    'scatter',
    'matrix',
    'histogram',
    'treemap',
  ] as const;

  it('6개 차트 + 필터의 도움말이 모두 정의되어야 함', () => {
    for (const key of expectedKeys) {
      const help = EXPLORE_HELP[key];
      expect(help).toBeDefined();
      expect(help.title).toBeTruthy();
      expect(help.description).toBeTruthy();
      expect(Array.isArray(help.details)).toBe(true);
      expect(help.details.length).toBeGreaterThan(0);
    }
  });

  it('각 도움말은 source를 명시해야 함', () => {
    for (const key of expectedKeys) {
      expect(EXPLORE_HELP[key].source).toBeTruthy();
    }
  });
});

describe('SENTIMENT_COLORS', () => {
  it('3개 감정 모두 색상이 정의됨', () => {
    expect(SENTIMENT_COLORS.positive).toBeTruthy();
    expect(SENTIMENT_COLORS.negative).toBeTruthy();
    expect(SENTIMENT_COLORS.neutral).toBeTruthy();
  });

  it('HSL 형식이어야 함 (기존 sentiment-chart.tsx COLORS와 호환)', () => {
    for (const color of Object.values(SENTIMENT_COLORS)) {
      expect(color.startsWith('hsl(')).toBe(true);
    }
  });
});

describe('score distribution bin 로직', () => {
  // getScoreDistribution 내부 addToBin 로직과 동일한 계산
  const BIN_COUNT = 20;
  function computeBin(score: number): number {
    const clamped = Math.min(Math.max(score, 0), 0.9999);
    return Math.min(BIN_COUNT - 1, Math.floor(clamped * BIN_COUNT));
  }

  it('경계값이 정확한 빈에 배치됨', () => {
    expect(computeBin(0)).toBe(0);
    expect(computeBin(0.05)).toBe(1);
    expect(computeBin(0.5)).toBe(10);
    expect(computeBin(0.9999)).toBe(19);
    expect(computeBin(1)).toBe(19); // clamp
  });

  it('ambiguous zone (0.4~0.65) 빈 인덱스', () => {
    expect(computeBin(0.4)).toBe(8);
    expect(computeBin(0.64)).toBe(12);
  });
});
