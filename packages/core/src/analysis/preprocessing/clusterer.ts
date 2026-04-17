/**
 * 임베딩 기반 유사 기사 클러스터링 (대표만 유지).
 *
 * 개선:
 *   - 내적(정규화된 E5 벡터 기준) 사용으로 sqrt 연산 제거
 *   - 인덱스 기반 assigned 추적으로 hot loop 간소화
 */
import type { AnalysisInput } from '../types';
import { embedTexts } from './embeddings';

function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function clusterArticles(
  articles: AnalysisInput['articles'],
  similarityThreshold: number,
): Promise<AnalysisInput['articles']> {
  if (articles.length <= 1) return articles;

  const texts = articles.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);
  const embeddings = await embedTexts(texts);

  const assigned = new Uint8Array(articles.length);
  const representatives: number[] = [];

  for (let i = 0; i < articles.length; i++) {
    if (assigned[i]) continue;
    assigned[i] = 1;

    const cluster = [i];
    for (let j = i + 1; j < articles.length; j++) {
      if (assigned[j]) continue;
      if (dotProduct(embeddings[i], embeddings[j]) >= similarityThreshold) {
        cluster.push(j);
        assigned[j] = 1;
      }
    }

    // 대표: 본문 길이 최대인 기사
    let rep = cluster[0];
    let repLen = (articles[rep].content ?? '').length;
    for (const idx of cluster) {
      const len = (articles[idx].content ?? '').length;
      if (len > repLen) {
        rep = idx;
        repLen = len;
      }
    }
    representatives.push(rep);
  }

  return representatives.map((idx) => articles[idx]);
}
