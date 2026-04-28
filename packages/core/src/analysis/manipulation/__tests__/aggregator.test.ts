import { describe, it, expect } from 'vitest';
import { aggregate } from '../aggregator';
import type { SignalResult, DomainConfig } from '../types';

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

function r(signal: SignalResult['signal'], score: number, confidence = 1): SignalResult {
  return { signal, score, confidence, evidence: [], metrics: {}, computeMs: 0 };
}

describe('aggregator', () => {
  it('모든 신호 0 → score 0', () => {
    const out = aggregate(
      [
        r('burst', 0),
        r('similarity', 0),
        r('vote', 0),
        r('media-sync', 0),
        r('trend-shape', 0),
        r('cross-platform', 0),
        r('temporal', 0),
      ],
      config,
    );
    expect(out.manipulationScore).toBe(0);
    expect(out.confidenceFactor).toBe(1);
  });

  it('모든 신호 100 + confidence 1 → score 100', () => {
    const out = aggregate(
      [
        r('burst', 100),
        r('similarity', 100),
        r('vote', 100),
        r('media-sync', 100),
        r('trend-shape', 100),
        r('cross-platform', 100),
        r('temporal', 100),
      ],
      config,
    );
    expect(out.manipulationScore).toBeCloseTo(100, 1);
  });

  it('가중 평균 계산 검증', () => {
    // similarity만 100, 나머지 0 → 100 * 0.22 = 22
    const out = aggregate(
      [
        r('burst', 0),
        r('similarity', 100),
        r('vote', 0),
        r('media-sync', 0),
        r('trend-shape', 0),
        r('cross-platform', 0),
        r('temporal', 0),
      ],
      config,
    );
    expect(out.manipulationScore).toBeCloseTo(22, 0);
  });

  it('confidence 낮으면 score 하향', () => {
    const out = aggregate(
      [
        r('burst', 100, 0.5),
        r('similarity', 100, 0.5),
        r('vote', 100, 0.5),
        r('media-sync', 100, 0.5),
        r('trend-shape', 100, 0.5),
        r('cross-platform', 100, 0.5),
        r('temporal', 100, 0.5),
      ],
      config,
    );
    expect(out.confidenceFactor).toBeCloseTo(0.5, 5);
    expect(out.manipulationScore).toBeCloseTo(50, 1);
  });

  it('signalScores 맵 정확도', () => {
    const out = aggregate(
      [
        r('burst', 50),
        r('similarity', 60),
        r('vote', 70),
        r('media-sync', 80),
        r('trend-shape', 90),
        r('cross-platform', 100),
        r('temporal', 10),
      ],
      config,
    );
    expect(out.signalScores.burst).toBe(50);
    expect(out.signalScores.similarity).toBe(60);
    expect(out.signalScores['cross-platform']).toBe(100);
  });

  it('일부 신호 누락 → 기본 0 + confidence 희석', () => {
    // 3개만 100점, 나머지 4개 누락 (score=0, confidence=0 자동 채워짐)
    const out = aggregate([r('burst', 100), r('similarity', 100), r('vote', 100)], config);
    // signalScores 모든 7개 키 존재 (누락은 0)
    expect(out.signalScores['media-sync']).toBe(0);
    expect(out.signalScores.temporal).toBe(0);
    expect(out.signalScores['trend-shape']).toBe(0);
    expect(out.signalScores['cross-platform']).toBe(0);
    // confidenceFactor = (1+1+1+0+0+0+0)/7 ≈ 0.4286
    expect(out.confidenceFactor).toBeCloseTo(3 / 7, 5);
    // weighted = 100*(0.18+0.22+0.14) = 54, score = clamp(54 * 0.4286, 0, 100) ≈ 23.14
    expect(out.manipulationScore).toBeCloseTo(54 * (3 / 7), 1);
  });

  it('가중치 누락 신호 검출', () => {
    const badConfig = { ...config, weights: { ...config.weights, burst: undefined as any } };
    expect(() =>
      aggregate(
        [
          r('burst', 50),
          r('similarity', 0),
          r('vote', 0),
          r('media-sync', 0),
          r('trend-shape', 0),
          r('cross-platform', 0),
          r('temporal', 0),
        ],
        badConfig,
      ),
    ).toThrow(/burst/);
  });
});
