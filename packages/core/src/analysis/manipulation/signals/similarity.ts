import { ngramSet, jaccard } from '../utils/ngram';
import { clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

const MIN_SAMPLES_FOR_CONFIDENCE = 200;
const COSINE_MIN_DEFAULT = 0.92;
const JACCARD_MIN_DEFAULT = 0.6;
const NGRAM_N = 5;

const SIZE_SCORE_MAX = 60;
const AUTHOR_DIVERSITY_MULTIPLIER = 30;
const SOURCE_BONUS_MAX = 20;
const SOURCE_BONUS_PER = 8;
const SPEED_BONUS_FAST = 20;
const SPEED_BONUS_MED = 10;
const SPEED_FAST_THRESHOLD_MS = 30 * 60 * 1000;
const SPEED_MED_THRESHOLD_MS = 2 * 60 * 60 * 1000;

const HIGH_CLUSTER_SIZE = 8;
const MEDIUM_CLUSTER_SIZE = 4;
const MAX_EVIDENCE_CARDS = 10;
const MAX_RAW_REF_EXCERPT = 200;

export type EmbeddedItem = {
  itemId: string;
  source: string;
  author: string | null;
  text: string;
  embedding: number[];
  time: Date;
};

export type ClusterMember = {
  itemId: string;
  source: string;
  author: string | null;
  text: string;
  time: Date;
};

export type SimilarityCluster = {
  representative: string;
  members: ClusterMember[];
  sourceSet: Set<string>;
  authorSet: Set<string>;
  timeSpanMs: number;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

export function buildSimilarityClusters(
  items: EmbeddedItem[],
  opts: { cosineMin: number; jaccardMin: number },
): SimilarityCluster[] {
  const visited = new Set<number>();
  const clusters: SimilarityCluster[] = [];

  // 단순 O(n^2) 검색 — 1만 미만에서 동작. 큰 데이터는 pgvector HNSW로 대체 (runner)
  for (let i = 0; i < items.length; i++) {
    if (visited.has(i)) continue;
    const cluster: ClusterMember[] = [
      {
        itemId: items[i].itemId,
        source: items[i].source,
        author: items[i].author,
        text: items[i].text,
        time: items[i].time,
      },
    ];
    visited.add(i);
    const ngramI = ngramSet(items[i].text, NGRAM_N);
    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(j)) continue;
      const cos = cosineSimilarity(items[i].embedding, items[j].embedding);
      if (cos < opts.cosineMin) continue;
      const ngramJ = ngramSet(items[j].text, NGRAM_N);
      if (jaccard(ngramI, ngramJ) < opts.jaccardMin) continue;
      cluster.push({
        itemId: items[j].itemId,
        source: items[j].source,
        author: items[j].author,
        text: items[j].text,
        time: items[j].time,
      });
      visited.add(j);
    }
    if (cluster.length >= 2) {
      const times = cluster.map((m) => m.time.getTime());
      clusters.push({
        representative: items[i].text,
        members: cluster,
        sourceSet: new Set(cluster.map((m) => m.source)),
        authorSet: new Set(cluster.map((m) => m.author).filter(Boolean) as string[]),
        timeSpanMs: Math.max(...times) - Math.min(...times),
      });
    }
  }
  return clusters;
}

export function scoreClusters(clusters: SimilarityCluster[]): {
  score: number;
  evidence: EvidenceCard[];
  metrics: Record<string, number>;
} {
  if (clusters.length === 0) {
    return {
      score: 0,
      evidence: [],
      metrics: { clusterCount: 0, maxClusterSize: 0 },
    };
  }

  let topScore = 0;
  for (const c of clusters) {
    const sizeScore = clamp(Math.log2(c.members.length) * 25, 0, SIZE_SCORE_MAX);
    const authorDiversity = c.authorSet.size / Math.max(1, c.members.length);
    const sourceBonus = Math.min(SOURCE_BONUS_MAX, c.sourceSet.size * SOURCE_BONUS_PER);
    const speedBonus =
      c.timeSpanMs < SPEED_FAST_THRESHOLD_MS
        ? SPEED_BONUS_FAST
        : c.timeSpanMs < SPEED_MED_THRESHOLD_MS
          ? SPEED_BONUS_MED
          : 0;
    const s = sizeScore + authorDiversity * AUTHOR_DIVERSITY_MULTIPLIER + sourceBonus + speedBonus;
    if (s > topScore) topScore = s;
  }
  topScore = clamp(topScore, 0, 100);

  clusters.sort((a, b) => b.members.length - a.members.length);
  const evidence: EvidenceCard[] = clusters.slice(0, MAX_EVIDENCE_CARDS).map((c, idx) => ({
    signal: 'similarity',
    severity:
      c.members.length >= HIGH_CLUSTER_SIZE
        ? 'high'
        : c.members.length >= MEDIUM_CLUSTER_SIZE
          ? 'medium'
          : 'low',
    title: `동일 문구 ${c.members.length}회 (${c.sourceSet.size}개 source, ${c.authorSet.size}명)`,
    summary: c.representative.slice(0, 80),
    visualization: {
      kind: 'similarity-cluster',
      representative: c.representative,
      matches: c.members.map((m) => ({
        author: m.author,
        source: m.source,
        time: m.time.toISOString(),
        text: m.text,
      })),
    },
    rawRefs: c.members.map((m) => ({
      itemId: m.itemId,
      source: m.source,
      time: m.time.toISOString(),
      excerpt: m.text.slice(0, MAX_RAW_REF_EXCERPT),
    })),
    rank: idx,
  }));

  return {
    score: topScore,
    evidence,
    metrics: {
      clusterCount: clusters.length,
      maxClusterSize: clusters[0]?.members.length ?? 0,
    },
  };
}

export function computeSimilarity(items: EmbeddedItem[]): SignalResult {
  const t0 = Date.now();
  if (items.length === 0) {
    return {
      signal: 'similarity',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { clusterCount: 0, maxClusterSize: 0 },
      computeMs: Date.now() - t0,
    };
  }
  const clusters = buildSimilarityClusters(items, {
    cosineMin: COSINE_MIN_DEFAULT,
    jaccardMin: JACCARD_MIN_DEFAULT,
  });
  const { score, evidence, metrics } = scoreClusters(clusters);
  const confidence = Math.min(1, items.length / MIN_SAMPLES_FOR_CONFIDENCE);
  return {
    signal: 'similarity',
    score,
    confidence,
    evidence,
    metrics: { ...metrics, sampleCount: items.length },
    computeMs: Date.now() - t0,
  };
}

// S7 Cross-Platform이 소비할 클러스터 raw 데이터 export
export function extractClustersForCrossPlatform(items: EmbeddedItem[]): SimilarityCluster[] {
  return buildSimilarityClusters(items, {
    cosineMin: COSINE_MIN_DEFAULT,
    jaccardMin: JACCARD_MIN_DEFAULT,
  });
}
