import type { AnalysisInput } from '../types';
import { embedTexts, cosineSimilarity } from './embeddings';

export async function clusterArticles(
  articles: AnalysisInput['articles'],
  similarityThreshold: number,
): Promise<AnalysisInput['articles']> {
  if (articles.length <= 1) return articles;

  const texts = articles.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);
  const embeddings = await embedTexts(texts);

  const clusterMap = new Map<number, number[]>();
  const assigned = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [i];
    assigned.add(i);

    for (let j = i + 1; j < articles.length; j++) {
      if (assigned.has(j)) continue;
      if (cosineSimilarity(embeddings[i], embeddings[j]) >= similarityThreshold) {
        cluster.push(j);
        assigned.add(j);
      }
    }

    const representative = cluster.reduce((best, idx) =>
      (articles[idx].content ?? '').length > (articles[best].content ?? '').length ? idx : best,
    );
    clusterMap.set(representative, cluster);
  }

  return Array.from(clusterMap.keys()).map((idx) => articles[idx]);
}
