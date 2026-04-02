import { describe, it, expect, vi } from 'vitest';
import { clusterArticles } from '../clusterer';
import type { AnalysisInput } from '../../types';

vi.mock('../embeddings', () => ({
  embedTexts: vi.fn(async (texts: string[]) =>
    texts.map((t) => {
      if (t.includes('클러스터1')) return [1, 0, 0];
      if (t.includes('클러스터2')) return [0, 1, 0];
      if (t.includes('클러스터3')) return [0, 0, 1];
      return [0.5, 0.5, 0];
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

describe('clusterArticles', () => {
  it('유사 기사를 클러스터링하고 대표 기사만 반환', async () => {
    const articles = [
      makeArticle('클러스터1 기사A', '클러스터1 내용 아주 길게', 'naver'),
      makeArticle('클러스터1 기사B', '클러스터1 짧게', 'dcinside'),
      makeArticle('클러스터2 기사A', '클러스터2 내용이 긴 기사', 'youtube'),
      makeArticle('클러스터3 기사A', '클러스터3 독립 기사', 'fmkorea'),
    ];

    const result = await clusterArticles(articles, 0.85);
    expect(result).toHaveLength(3);
  });

  it('기사가 1건이면 그대로 반환', async () => {
    const articles = [makeArticle('유일한 기사', '클러스터1 내용', 'naver')];
    const result = await clusterArticles(articles, 0.85);
    expect(result).toHaveLength(1);
  });
});
