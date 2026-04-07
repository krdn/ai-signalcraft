import type { AnalysisInput } from '../types';
import { embedTexts, cosineSimilarity } from './embeddings';

export async function deduplicateArticles(
  articles: AnalysisInput['articles'],
  similarityThreshold: number,
): Promise<AnalysisInput['articles']> {
  if (articles.length <= 1) return articles;

  const texts = articles.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);
  const embeddings = await embedTexts(texts);

  const kept: number[] = [0];

  for (let i = 1; i < articles.length; i++) {
    let isDuplicate = false;
    for (const k of kept) {
      if (cosineSimilarity(embeddings[i], embeddings[k]) >= similarityThreshold) {
        const currentLen = (articles[k].content ?? '').length;
        const candidateLen = (articles[i].content ?? '').length;
        if (candidateLen > currentLen) {
          kept[kept.indexOf(k)] = i;
        }
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) kept.push(i);
  }

  return kept.map((idx) => articles[idx]);
}
