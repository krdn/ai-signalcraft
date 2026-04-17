/**
 * 기사 중복 제거 — 3단계 계층 전략
 *
 * 1. 제목 exact duplicate (SHA-1 해시) — O(N), 즉시 제거
 * 2. LSH 기반 표면 유사 중복 (MinHash+LSH) — O(N log N), 거의 동일한 복붙/편집
 * 3. 임베딩 기반 의미 유사 중복 (E5 + cosine) — O(M²), 구조 다른 동일 주제
 *
 * 500건 기준: LSH로 80% 걸러내고 임베딩은 M=100건만 비교 → 전체 5배 이상 빠름
 */
import { createHash } from 'node:crypto';
import type { AnalysisInput } from '../types';
import { embedTexts } from './embeddings';
import { deduplicateArticlesLSH } from './lsh';

function titleHash(title: string): string {
  return createHash('sha1').update(title.trim().toLowerCase()).digest('hex');
}

function dotProduct(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** LSH pre-filter를 사용할 건수 기준점 (이하일 때는 바로 임베딩 dedup) */
const LSH_MIN_SIZE = 200;

export async function deduplicateArticles(
  articles: AnalysisInput['articles'],
  similarityThreshold: number,
): Promise<AnalysisInput['articles']> {
  if (articles.length <= 1) return articles;

  // 1. 제목 exact duplicate 제거
  const byHash = new Map<string, number>();
  for (let i = 0; i < articles.length; i++) {
    const h = titleHash(articles[i].title);
    const prev = byHash.get(h);
    if (prev === undefined) {
      byHash.set(h, i);
    } else {
      const prevLen = (articles[prev].content ?? '').length;
      const curLen = (articles[i].content ?? '').length;
      if (curLen > prevLen) byHash.set(h, i);
    }
  }
  const uniqueIdx = [...byHash.values()].sort((a, b) => a - b);
  let uniqueArticles = uniqueIdx.map((i) => articles[i]);

  if (uniqueArticles.length <= 1) return uniqueArticles;

  // 2. LSH pre-filter (200건 이상일 때만 적용 — 오버헤드 회피)
  if (uniqueArticles.length >= LSH_MIN_SIZE) {
    uniqueArticles = deduplicateArticlesLSH(uniqueArticles, {
      threshold: 0.85, // LSH는 표면 유사만 잡으므로 높은 임계값
    });
    if (uniqueArticles.length <= 1) return uniqueArticles;
  }

  // 3. 임베딩 기반 의미 유사 중복 제거
  const texts = uniqueArticles.map((a) => `${a.title} ${(a.content ?? '').slice(0, 300)}`);
  const embeddings = await embedTexts(texts);

  const kept: number[] = [0];
  for (let i = 1; i < uniqueArticles.length; i++) {
    let duplicate = false;
    for (const k of kept) {
      const sim = dotProduct(embeddings[i], embeddings[k]);
      if (sim >= similarityThreshold) {
        const currentLen = (uniqueArticles[k].content ?? '').length;
        const candidateLen = (uniqueArticles[i].content ?? '').length;
        if (candidateLen > currentLen) {
          kept[kept.indexOf(k)] = i;
        }
        duplicate = true;
        break;
      }
    }
    if (!duplicate) kept.push(i);
  }

  return kept.map((idx) => uniqueArticles[idx]);
}
