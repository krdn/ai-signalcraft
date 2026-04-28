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
    expect(result.confidence).toBe(1); // 분석 가능했지만 cross-platform 클러스터 없음
  });

  it('3개 플랫폼 + 짧은 시간 = 높은 점수', () => {
    const c = cluster(['dcinside', 'youtube', 'naver-news'], 10); // 10min < 15min → FAST
    const result = computeCrossPlatform([c]);
    expect(result.score).toBe(90); // platformBonus=60 + speedBonus=30
    expect(result.evidence.length).toBe(1);
    expect(result.evidence[0].severity).toBe('high'); // sourceSet.size >= 3
  });

  it('2개 플랫폼 + 느린 시간 = medium severity', () => {
    const c = cluster(['dcinside', 'youtube'], 90); // 90min > 60min → SLOW
    const result = computeCrossPlatform([c]);
    expect(result.score).toBe(55); // platformBonus=50 + speedBonus=5
    expect(result.evidence[0].severity).toBe('medium');
  });

  it('4개 플랫폼은 3개와 동일 점수 (platformBonus 포화)', () => {
    const c4 = cluster(['dcinside', 'youtube', 'naver-news', 'clien'], 10);
    const c3 = cluster(['dcinside', 'youtube', 'naver-news'], 10);
    const r4 = computeCrossPlatform([c4]);
    const r3 = computeCrossPlatform([c3]);
    expect(r4.score).toBe(r3.score);
    expect(r4.score).toBe(90);
  });

  it('빈 입력은 confidence 0', () => {
    const result = computeCrossPlatform([]);
    expect(result.confidence).toBe(0);
  });
});
