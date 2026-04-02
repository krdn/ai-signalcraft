import { describe, it, expect, vi } from 'vitest';
import { deduplicateArticles } from '../deduplicator';
import type { AnalysisInput } from '../../types';

vi.mock('../embeddings', () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map((t) => {
      if (t.includes('이슈A')) return [1, 0, 0];
      if (t.includes('이슈B')) return [0, 1, 0];
      return [0, 0, 1];
    }),
  ),
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    let dot = 0,
      nA = 0,
      nB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      nA += a[i] * a[i];
      nB += b[i] * b[i];
    }
    return dot / (Math.sqrt(nA) * Math.sqrt(nB));
  }),
}));

function makeArticle(title: string, content: string, source: string): AnalysisInput['articles'][0] {
  return { title, content, publisher: null, publishedAt: new Date(), source };
}

describe('deduplicateArticles', () => {
  it('중복 기사를 제거하고 대표 기사만 반환', async () => {
    const articles = [
      makeArticle('이슈A 보도1', '이슈A 상세 내용이 아주 긴 기사', 'naver'),
      makeArticle('이슈A 보도2', '이슈A 짧은 기사', 'dcinside'),
      makeArticle('이슈B 보도1', '이슈B 완전히 다른 내용의 기사', 'youtube'),
    ];

    const result = await deduplicateArticles(articles, 0.9);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.title === '이슈A 보도1')).toBeDefined();
    expect(result.find((a) => a.title === '이슈B 보도1')).toBeDefined();
  });

  it('기사가 1건 이하면 그대로 반환', async () => {
    const articles = [makeArticle('유일한 기사', '이슈C 내용', 'naver')];
    const result = await deduplicateArticles(articles, 0.9);
    expect(result).toHaveLength(1);
  });

  it('빈 배열은 빈 배열 반환', async () => {
    const result = await deduplicateArticles([], 0.9);
    expect(result).toHaveLength(0);
  });
});
