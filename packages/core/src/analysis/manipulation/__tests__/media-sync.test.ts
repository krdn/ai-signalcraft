import { describe, it, expect } from 'vitest';
import { computeMediaSync } from '../signals/media-sync';
import type { ArticleEmbedded } from '../signals/media-sync';

function art(
  id: string,
  publisher: string,
  headline: string,
  emb: number[],
  isoTime: string,
): ArticleEmbedded {
  return {
    itemId: id,
    publisher,
    headline,
    embedding: emb,
    time: new Date(isoTime),
  };
}

describe('media-sync signal', () => {
  it('동일 publisher 묶음은 점수 안 줌', () => {
    const items = [
      art('1', 'P1', 'H', [1, 0], '2026-04-27T10:00:00Z'),
      art('2', 'P1', 'H', [1, 0], '2026-04-27T10:05:00Z'),
    ];
    const result = computeMediaSync(items);
    expect(result.score).toBe(0);
  });

  it('30분 윈도우 내 3개 매체 동조화 = 65점 이상', () => {
    const items = [
      art('1', 'P1', '동일 헤드라인', [0.9, 0.1], '2026-04-27T10:00:00Z'),
      art('2', 'P2', '동일 헤드라인', [0.9, 0.1], '2026-04-27T10:10:00Z'),
      art('3', 'P3', '동일 헤드라인', [0.9, 0.1], '2026-04-27T10:20:00Z'),
    ];
    const result = computeMediaSync(items);
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('빈 입력 confidence 0', () => {
    const result = computeMediaSync([]);
    expect(result.confidence).toBe(0);
  });
});
