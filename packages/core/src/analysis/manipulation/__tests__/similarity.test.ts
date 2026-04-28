import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  buildSimilarityClusters,
  scoreClusters,
  computeSimilarity,
} from '../signals/similarity';
import type { EmbeddedItem } from '../signals/similarity';

function item(
  id: string,
  source: string,
  author: string | null,
  text: string,
  emb: number[],
  isoTime: string,
): EmbeddedItem {
  return {
    itemId: id,
    source,
    author,
    text,
    embedding: emb,
    time: new Date(isoTime),
  };
}

describe('similarity signal', () => {
  describe('cosineSimilarity', () => {
    it('동일 벡터는 1', () => {
      expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    });
    it('직교 벡터는 0', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });
  });

  describe('buildSimilarityClusters', () => {
    it('유사도 임계 미만은 클러스터 안 만듦', () => {
      const items = [
        item('a', 'dcinside', 'u1', '안녕하세요', [1, 0], '2026-04-27T10:00:00Z'),
        item('b', 'clien', 'u2', '반갑습니다', [0, 1], '2026-04-27T10:01:00Z'),
      ];
      const clusters = buildSimilarityClusters(items, { cosineMin: 0.92, jaccardMin: 0.6 });
      expect(clusters.length).toBe(0);
    });

    it('동일 embedding이지만 텍스트 다르면 jaccard 게이트로 클러스터 안 만듦', () => {
      // cosine = 1.0 (passes 0.85), jaccard = 0 (fails 0.5)
      const items = [
        item(
          'a',
          'dcinside',
          'u1',
          '안녕하세요 좋은 아침입니다 오늘도 화이팅',
          [0.9, 0.1],
          '2026-04-27T10:00:00Z',
        ),
        item(
          'b',
          'clien',
          'u2',
          '저녁 메뉴 추천해주세요 김치찌개 어떨까요',
          [0.9, 0.1],
          '2026-04-27T10:01:00Z',
        ),
      ];
      const clusters = buildSimilarityClusters(items, { cosineMin: 0.85, jaccardMin: 0.5 });
      expect(clusters.length).toBe(0);
    });

    it('동일 텍스트 + 다른 작성자 + 다른 source 는 클러스터 형성', () => {
      const text = '이번 정책은 정말 우려스러운 부분이 많습니다 신중히 생각해야 합니다';
      const emb = [0.9, 0.1];
      const items = [
        item('a', 'dcinside', 'u1', text, emb, '2026-04-27T10:00:00Z'),
        item('b', 'clien', 'u2', text, emb, '2026-04-27T10:02:00Z'),
        item('c', 'fmkorea', 'u3', text, emb, '2026-04-27T10:05:00Z'),
      ];
      const clusters = buildSimilarityClusters(items, { cosineMin: 0.85, jaccardMin: 0.5 });
      expect(clusters.length).toBeGreaterThanOrEqual(1);
      expect(clusters[0].members.length).toBe(3);
      expect(clusters[0].sourceSet.size).toBe(3);
    });
  });

  describe('scoreClusters', () => {
    it('클러스터 없으면 score 0', () => {
      const result = scoreClusters([]);
      expect(result.score).toBe(0);
    });

    it('큰 클러스터 + 다양한 작성자 = 높은 점수', () => {
      const result = scoreClusters([
        {
          representative: 'X',
          members: Array.from({ length: 8 }, (_, i) => ({
            itemId: `${i}`,
            source: i < 4 ? 'dcinside' : 'clien',
            author: `u${i}`,
            text: 'X',
            time: new Date(`2026-04-27T10:0${i}:00Z`),
          })),
          sourceSet: new Set(['dcinside', 'clien']),
          authorSet: new Set(['u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']),
          timeSpanMs: 8 * 60 * 1000,
        },
      ]);
      // paper math: 60 (size clamp) + 30 (author) + 16 (source) + 20 (speed) = 126 → clamp 100
      expect(result.score).toBe(100);
    });
  });

  describe('computeSimilarity', () => {
    it('빈 배열은 score=0, confidence=0', () => {
      const result = computeSimilarity([]);
      expect(result.score).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.evidence).toHaveLength(0);
    });
  });
});
