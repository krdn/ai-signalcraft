import { clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';
import { cosineSimilarity } from './similarity';

const WINDOW_MS = 30 * 60 * 1000;
const COSINE_MIN = 0.88;
const MIN_SAMPLES_FOR_CONFIDENCE = 50;
const HIGH_PUBLISHER_COUNT = 4;
const MEDIUM_PUBLISHER_COUNT = 3;
const TWO_PUBLISHER_BASE_SCORE = 35;
const TWO_PUBLISHER_SPEED_BONUS_MAX = 20;
const TWO_PUBLISHER_SCORE_MAX = 60;
const THREE_PLUS_BASE_SCORE = 65;
const THREE_PLUS_PER_EXTRA = 8;
const THREE_PLUS_SPEED_BONUS_MAX = 15;

export type ArticleEmbedded = {
  itemId: string;
  publisher: string;
  headline: string;
  embedding: number[];
  time: Date;
};

type MediaCluster = {
  members: ArticleEmbedded[];
  publisherSet: Set<string>;
  spanMs: number;
};

export function computeMediaSync(items: ArticleEmbedded[]): SignalResult {
  const t0 = Date.now();
  if (items.length === 0) {
    return {
      signal: 'media-sync',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { topClusterSize: 0, clusterCount: 0 },
      computeMs: Date.now() - t0,
    };
  }

  // 시간순 정렬 후 30분 윈도우 슬라이딩으로 cluster 빌드
  const sorted = [...items].sort((a, b) => a.time.getTime() - b.time.getTime());
  const visited = new Set<number>();
  const clusters: MediaCluster[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (visited.has(i)) continue;
    const cluster: ArticleEmbedded[] = [sorted[i]];
    visited.add(i);
    for (let j = i + 1; j < sorted.length; j++) {
      if (visited.has(j)) continue;
      // 시간 정렬됐으므로, j가 윈도우 벗어나면 break
      if (sorted[j].time.getTime() - sorted[i].time.getTime() > WINDOW_MS) break;
      if (cosineSimilarity(sorted[i].embedding, sorted[j].embedding) >= COSINE_MIN) {
        cluster.push(sorted[j]);
        visited.add(j);
      }
    }
    const publisherSet = new Set(cluster.map((c) => c.publisher));
    // 같은 publisher만 모인 묶음은 동조화 신호 아님 → 2개 이상 publisher일 때만 등록
    if (publisherSet.size >= 2) {
      const times = cluster.map((c) => c.time.getTime());
      clusters.push({
        members: cluster,
        publisherSet,
        spanMs: Math.max(...times) - Math.min(...times),
      });
    }
  }

  // 로컬 변수 clusters는 외부 caller가 보지 않으므로 in-place sort 안전
  const topCluster = clusters.sort((a, b) => b.publisherSet.size - a.publisherSet.size)[0];
  const topSize = topCluster?.publisherSet.size ?? 0;
  const speedFactor = topCluster ? 1 - topCluster.spanMs / WINDOW_MS : 0;

  let score = 0;
  if (topSize >= MEDIUM_PUBLISHER_COUNT) {
    score = clamp(
      THREE_PLUS_BASE_SCORE +
        (topSize - MEDIUM_PUBLISHER_COUNT) * THREE_PLUS_PER_EXTRA +
        speedFactor * THREE_PLUS_SPEED_BONUS_MAX,
      0,
      100,
    );
  } else if (topSize === 2) {
    score = clamp(
      TWO_PUBLISHER_BASE_SCORE + speedFactor * TWO_PUBLISHER_SPEED_BONUS_MAX,
      0,
      TWO_PUBLISHER_SCORE_MAX,
    );
  }

  const evidence: EvidenceCard[] = [];
  if (topCluster && topSize >= 2) {
    evidence.push({
      signal: 'media-sync',
      severity:
        topSize >= HIGH_PUBLISHER_COUNT
          ? 'high'
          : topSize >= MEDIUM_PUBLISHER_COUNT
            ? 'medium'
            : 'low',
      title: `${topSize}개 매체 동시 동조화 (${Math.round(topCluster.spanMs / 60000)}분 내)`,
      summary: topCluster.members[0].headline.slice(0, 80),
      visualization: {
        kind: 'media-sync-timeline',
        cluster: topCluster.members[0].headline,
        items: topCluster.members.map((m) => ({
          publisher: m.publisher,
          time: m.time.toISOString(),
          headline: m.headline,
        })),
      },
      rawRefs: topCluster.members.map((m) => ({
        itemId: m.itemId,
        source: m.publisher,
        time: m.time.toISOString(),
        excerpt: m.headline,
      })),
      rank: 0,
    });
  }

  return {
    signal: 'media-sync',
    score,
    confidence: Math.min(1, items.length / MIN_SAMPLES_FOR_CONFIDENCE),
    evidence,
    metrics: { topClusterSize: topSize, clusterCount: clusters.length, sampleCount: items.length },
    computeMs: Date.now() - t0,
  };
}
