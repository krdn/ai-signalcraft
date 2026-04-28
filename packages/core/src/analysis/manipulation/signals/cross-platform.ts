import { clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';
import type { SimilarityCluster } from './similarity';

const PLATFORM_BONUS_MAX = 60;
const PLATFORM_BONUS_PER = 25;
const SPEED_BONUS_FAST = 30;
const SPEED_BONUS_MED = 15;
const SPEED_BONUS_SLOW = 5;
const SPEED_FAST_THRESHOLD_MS = 15 * 60 * 1000;
const SPEED_MED_THRESHOLD_MS = 60 * 60 * 1000;
const HIGH_PLATFORM_COUNT = 3;
const MAX_EVIDENCE_CARDS = 10;
const MAX_RAW_REF_EXCERPT = 200;
const MAX_MESSAGE_EXCERPT = 60;

/**
 * S7 Cross-Platform — S3(similarity)가 만든 클러스터를 후처리하여
 * 멀티 플랫폼 캐스케이드 패턴만 추출.
 *
 * 입력 클러스터 중 sourceSet.size >= 2 인 것만 점수 계산:
 *   score = platformBonus(플랫폼 수 * 25, max 60) + speedBonus(빠르면 30, 중간 15, 느림 5)
 *
 * confidence semantics:
 *   - 빈 입력: 0 (분석 입력 자체 없음)
 *   - 단일 플랫폼만: 1 (분석 가능했지만 cross-platform 클러스터 없음)
 *   - 멀티 플랫폼 존재: 1
 */
export function computeCrossPlatform(clusters: SimilarityCluster[]): SignalResult {
  const t0 = Date.now();
  if (clusters.length === 0) {
    return {
      signal: 'cross-platform',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { multiPlatformClusters: 0 },
      computeMs: Date.now() - t0,
    };
  }

  const multi = clusters.filter((c) => c.sourceSet.size >= 2);
  if (multi.length === 0) {
    return {
      signal: 'cross-platform',
      score: 0,
      confidence: 1,
      evidence: [],
      metrics: { multiPlatformClusters: 0, totalClusters: clusters.length },
      computeMs: Date.now() - t0,
    };
  }

  let topScore = 0;
  for (const c of multi) {
    const platformBonus = Math.min(PLATFORM_BONUS_MAX, c.sourceSet.size * PLATFORM_BONUS_PER);
    const speedBonus =
      c.timeSpanMs < SPEED_FAST_THRESHOLD_MS
        ? SPEED_BONUS_FAST
        : c.timeSpanMs < SPEED_MED_THRESHOLD_MS
          ? SPEED_BONUS_MED
          : SPEED_BONUS_SLOW;
    const s = platformBonus + speedBonus;
    if (s > topScore) topScore = s;
  }
  const score = clamp(topScore, 0, 100);

  const evidence: EvidenceCard[] = multi.slice(0, MAX_EVIDENCE_CARDS).map((c, idx) => {
    const sortedMembers = [...c.members].sort((a, b) => a.time.getTime() - b.time.getTime());
    const hops: { from: string; to: string; time: string; message: string; count: number }[] = [];
    for (let i = 1; i < sortedMembers.length; i++) {
      hops.push({
        from: sortedMembers[i - 1].source,
        to: sortedMembers[i].source,
        time: sortedMembers[i].time.toISOString(),
        message: c.representative.slice(0, MAX_MESSAGE_EXCERPT),
        count: 1,
      });
    }
    return {
      signal: 'cross-platform',
      severity: c.sourceSet.size >= HIGH_PLATFORM_COUNT ? 'high' : 'medium',
      title: `${c.sourceSet.size}개 플랫폼 동시 출현 (${Math.round(c.timeSpanMs / 60000)}분)`,
      summary: c.representative.slice(0, 80),
      visualization: { kind: 'cross-platform-flow', hops },
      rawRefs: c.members.map((m) => ({
        itemId: m.itemId,
        source: m.source,
        time: m.time.toISOString(),
        excerpt: m.text.slice(0, MAX_RAW_REF_EXCERPT),
      })),
      rank: idx,
    };
  });

  return {
    signal: 'cross-platform',
    score,
    confidence: 1,
    evidence,
    metrics: {
      multiPlatformClusters: multi.length,
      totalClusters: clusters.length,
    },
    computeMs: Date.now() - t0,
  };
}
