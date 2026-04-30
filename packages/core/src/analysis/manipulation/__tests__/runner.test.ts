import { describe, it, expect } from 'vitest';
import { runManipulationDetection } from '../runner';
import type { DomainConfig, CommentRow } from '../types';
import type { ManipulationDataLoader } from '../loader-types';

const config: DomainConfig = {
  domain: 'political',
  weights: {
    burst: 0.18,
    similarity: 0.22,
    vote: 0.14,
    'media-sync': 0.16,
    'trend-shape': 0.1,
    'cross-platform': 0.12,
    temporal: 0.08,
  },
  thresholds: {
    burst: { medium: 50, high: 70 },
    similarity: { medium: 50, high: 70 },
    vote: { medium: 50, high: 70 },
    'media-sync': { medium: 50, high: 65 },
    'trend-shape': { medium: 50, high: 70 },
    'cross-platform': { medium: 50, high: 70 },
    temporal: { medium: 50, high: 70 },
  },
  baselineDays: 30,
  narrativeContext: 'test',
};

function emptyLoader(): ManipulationDataLoader {
  return {
    loadComments: async () => [],
    loadVotes: async () => [],
    loadEmbeddedComments: async () => [],
    loadEmbeddedArticles: async () => [],
    loadTrendSeries: async () => [],
    loadTemporalBaselines: async () => ({}),
  };
}

describe('runManipulationDetection', () => {
  it('빈 데이터에서도 7개 신호 모두 0점 반환', async () => {
    const result = await runManipulationDetection({
      jobId: 1,
      subscriptionId: null,
      config,
      dateRange: {
        start: new Date('2026-04-01'),
        end: new Date('2026-04-27'),
      },
      loader: emptyLoader(),
    });
    expect(result.signals).toHaveLength(7);
    expect(result.aggregate.manipulationScore).toBe(0);
    expect(result.aggregate.confidenceFactor).toBe(0);
  });

  it('signal 결과는 7개 모두 포함', async () => {
    const result = await runManipulationDetection({
      jobId: 1,
      subscriptionId: null,
      config,
      dateRange: {
        start: new Date('2026-04-01'),
        end: new Date('2026-04-27'),
      },
      loader: emptyLoader(),
    });
    const types = result.signals.map((s) => s.signal).sort();
    expect(types).toEqual([
      'burst',
      'cross-platform',
      'media-sync',
      'similarity',
      'temporal',
      'trend-shape',
      'vote',
    ]);
  });

  it('burst 신호가 데이터 받으면 점수 산출', async () => {
    const burstComments: CommentRow[] = [];
    for (let i = 0; i < 12; i++) {
      const min = String(i * 5).padStart(2, '0');
      burstComments.push({
        itemId: `c${i}`,
        parentSourceId: 'p1',
        source: 'dcinside',
        time: new Date(`2026-04-27T08:${min}:00Z`),
        excerpt: '',
      });
    }
    for (let i = 0; i < 30; i++) {
      const sec = String(i * 2).padStart(2, '0');
      burstComments.push({
        itemId: `b${i}`,
        parentSourceId: 'p1',
        source: 'dcinside',
        time: new Date(`2026-04-27T10:00:${sec}Z`),
        excerpt: '',
      });
    }

    const loader: ManipulationDataLoader = {
      ...emptyLoader(),
      loadComments: async () => burstComments,
    };

    const result = await runManipulationDetection({
      jobId: 1,
      subscriptionId: null,
      config,
      dateRange: {
        start: new Date('2026-04-27T00:00:00Z'),
        end: new Date('2026-04-27T23:59:59Z'),
      },
      loader,
    });
    const burst = result.signals.find((s) => s.signal === 'burst')!;
    expect(burst.score).toBeGreaterThanOrEqual(70);
  });
});
