import { describe, it, expect } from 'vitest';
import { computeCrossPlatform } from '../signals/cross-platform';
import type { SimilarityCluster } from '../signals/similarity';

function cluster(sources: string[], spanMin: number): SimilarityCluster {
  const baseTs = Date.parse('2026-04-27T10:00:00Z');
  return {
    representative: 'X',
    members: sources.map((s, i) => ({
      itemId: `${s}-${i}`,
      source: s,
      author: `u${i}`,
      text: 'X',
      time: new Date(baseTs + (i * spanMin * 60 * 1000) / Math.max(1, sources.length - 1)),
    })),
    sourceSet: new Set(sources),
    authorSet: new Set(sources.map((_, i) => `u${i}`)),
    timeSpanMs: spanMin * 60 * 1000,
  };
}

describe('cross-platform signal', () => {
  it('단일 플랫폼 클러스터는 점수 0', () => {
    const c = cluster(['dcinside', 'dcinside', 'dcinside'], 10);
    const result = computeCrossPlatform([c]);
    expect(result.score).toBe(0);
  });

  it('3개 플랫폼 + 짧은 시간 = 높은 점수', () => {
    const c = cluster(['dcinside', 'youtube', 'naver-news'], 15);
    const result = computeCrossPlatform([c]);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.evidence.length).toBe(1);
  });

  it('빈 입력은 confidence 0', () => {
    const result = computeCrossPlatform([]);
    expect(result.confidence).toBe(0);
  });
});
