import { describe, it, expect } from 'vitest';
import { computeQuantitativeDelta } from '../../src/analysis/delta/compute-delta';
import type { SentimentFramingResult } from '../../src/analysis/schemas/sentiment-framing.schema';
import type { MacroViewResult } from '../../src/analysis/schemas/macro-view.schema';

// 헬퍼: 기본값 제공 후 overrides 병합
function makeSentimentFraming(
  overrides: Partial<SentimentFramingResult> = {},
): SentimentFramingResult {
  return {
    sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
    topKeywords: [
      { keyword: '경제', count: 10, sentiment: 'neutral' },
      { keyword: '정책', count: 8, sentiment: 'positive' },
      { keyword: '위기', count: 5, sentiment: 'negative' },
    ],
    relatedKeywords: [],
    positiveFrames: [],
    negativeFrames: [],
    frameConflict: {
      description: '프레임 충돌 없음',
      dominantFrame: '미확인',
      challengingFrame: '미확인',
    },
    ...overrides,
  };
}

function makeMacroView(overrides: Partial<MacroViewResult> = {}): MacroViewResult {
  return {
    overallDirection: 'mixed',
    summary: '여론 요약',
    timeline: [],
    inflectionPoints: [],
    dailyMentionTrend: [
      {
        date: '2026-03-18',
        count: 100,
        sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
      },
      {
        date: '2026-03-19',
        count: 120,
        sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
      },
    ],
    ...overrides,
  };
}

const defaultStats = {
  newArticles: 50,
  newComments: 200,
  totalArticles: 100,
  totalComments: 400,
};

describe('computeQuantitativeDelta', () => {
  it('감성 비율 변화를 올바르게 계산한다', () => {
    const before = {
      sentimentFraming: makeSentimentFraming({
        sentimentRatio: { positive: 0.4, negative: 0.4, neutral: 0.2 },
      }),
      macroView: makeMacroView(),
    };
    const after = {
      sentimentFraming: makeSentimentFraming({
        sentimentRatio: { positive: 0.6, negative: 0.2, neutral: 0.2 },
      }),
      macroView: makeMacroView(),
    };

    const result = computeQuantitativeDelta(before, after, defaultStats);

    expect(result.sentiment.before.positive).toBe(0.4);
    expect(result.sentiment.after.positive).toBe(0.6);
    expect(result.sentiment.delta.positive).toBeCloseTo(0.2);
    expect(result.sentiment.delta.negative).toBeCloseTo(-0.2);
    expect(result.sentiment.delta.neutral).toBeCloseTo(0);
  });

  it('언급량 변화를 올바르게 계산한다', () => {
    const before = {
      sentimentFraming: makeSentimentFraming(),
      macroView: makeMacroView({
        dailyMentionTrend: [
          {
            date: '2026-03-10',
            count: 50,
            sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
          },
          {
            date: '2026-03-11',
            count: 50,
            sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
          },
        ],
      }),
    };
    const after = {
      sentimentFraming: makeSentimentFraming(),
      macroView: makeMacroView({
        dailyMentionTrend: [
          {
            date: '2026-03-17',
            count: 75,
            sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
          },
          {
            date: '2026-03-18',
            count: 75,
            sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
          },
        ],
      }),
    };

    const result = computeQuantitativeDelta(before, after, defaultStats);

    expect(result.mentions.before).toBe(100);
    expect(result.mentions.after).toBe(150);
    expect(result.mentions.delta).toBe(50);
    expect(result.mentions.deltaPercent).toBe(50);
  });

  it('키워드 등장/소멸을 감지한다', () => {
    const before = {
      sentimentFraming: makeSentimentFraming({
        topKeywords: [
          { keyword: '경제', count: 10, sentiment: 'neutral' as const },
          { keyword: '위기', count: 5, sentiment: 'negative' as const },
        ],
      }),
      macroView: makeMacroView(),
    };
    const after = {
      sentimentFraming: makeSentimentFraming({
        topKeywords: [
          { keyword: '경제', count: 12, sentiment: 'neutral' as const },
          { keyword: '성장', count: 8, sentiment: 'positive' as const },
        ],
      }),
      macroView: makeMacroView(),
    };

    const result = computeQuantitativeDelta(before, after, defaultStats);

    expect(result.keywords.appeared).toContain('성장');
    expect(result.keywords.disappeared).toContain('위기');
    expect(result.keywords.appeared).not.toContain('위기');
    expect(result.keywords.disappeared).not.toContain('성장');
  });

  it('overallDirection 변화를 추적한다', () => {
    const before = {
      sentimentFraming: makeSentimentFraming(),
      macroView: makeMacroView({ overallDirection: 'negative' as const }),
    };
    const after = {
      sentimentFraming: makeSentimentFraming(),
      macroView: makeMacroView({ overallDirection: 'positive' as const }),
    };

    const result = computeQuantitativeDelta(before, after, defaultStats);

    expect(result.overallDirection.before).toBe('negative');
    expect(result.overallDirection.after).toBe('positive');
  });

  it('이전 언급량이 0일 때 deltaPercent를 안전하게 처리한다', () => {
    const before = {
      sentimentFraming: makeSentimentFraming(),
      macroView: makeMacroView({
        dailyMentionTrend: [],
      }),
    };
    const afterWithMentions = {
      sentimentFraming: makeSentimentFraming(),
      macroView: makeMacroView({
        dailyMentionTrend: [
          {
            date: '2026-03-18',
            count: 50,
            sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
          },
        ],
      }),
    };
    const afterZero = {
      sentimentFraming: makeSentimentFraming(),
      macroView: makeMacroView({
        dailyMentionTrend: [],
      }),
    };

    const resultWithMentions = computeQuantitativeDelta(before, afterWithMentions, defaultStats);
    const resultBothZero = computeQuantitativeDelta(before, afterZero, defaultStats);

    // 이전 0, 이후 50 → 100%
    expect(resultWithMentions.mentions.before).toBe(0);
    expect(resultWithMentions.mentions.after).toBe(50);
    expect(resultWithMentions.mentions.deltaPercent).toBe(100);

    // 둘 다 0 → 0%
    expect(resultBothZero.mentions.deltaPercent).toBe(0);
  });
});
