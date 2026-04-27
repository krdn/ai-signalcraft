import { median, mad, zScore, zScoreToScore } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

export const BUCKET_MS = 5 * 60 * 1000;
const MIN_SAMPLES_FOR_FULL_CONFIDENCE = 30;

export type CommentRow = {
  itemId: string;
  parentSourceId: string;
  source: string;
  time: Date;
  excerpt: string;
};

export function computeBurstFromComments(comments: CommentRow[]): SignalResult {
  const t0 = Date.now();
  if (comments.length === 0) {
    return emptyResult(Date.now() - t0);
  }

  const byParent = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (!byParent.has(c.parentSourceId)) byParent.set(c.parentSourceId, []);
    byParent.get(c.parentSourceId)!.push(c);
  }

  let maxZ = 0;
  const topBuckets: {
    parentId: string;
    ts: string;
    count: number;
    zScore: number;
    samples: CommentRow[];
  }[] = [];

  for (const [parentId, list] of byParent) {
    if (list.length < 5) continue;
    const counts = new Map<number, CommentRow[]>();
    for (const c of list) {
      const bucket = Math.floor(c.time.getTime() / BUCKET_MS) * BUCKET_MS;
      if (!counts.has(bucket)) counts.set(bucket, []);
      counts.get(bucket)!.push(c);
    }
    const values = Array.from(counts.values()).map((arr) => arr.length);
    if (values.length < 3) continue;
    const m = median(values);
    // 1.4826 = MAD→σ 보정 상수 (정규분포 가정)
    const scale = mad(values) * 1.4826 || 1;
    for (const [bucket, items] of counts) {
      const z = zScore(items.length, m, scale);
      if (z > maxZ) maxZ = z;
      if (z >= 3) {
        topBuckets.push({
          parentId,
          ts: new Date(bucket).toISOString(),
          count: items.length,
          zScore: z,
          samples: items.slice(0, 5),
        });
      }
    }
  }

  topBuckets.sort((a, b) => b.zScore - a.zScore);
  const evidence: EvidenceCard[] = topBuckets.slice(0, 10).map((b, idx) => ({
    signal: 'burst',
    severity: b.zScore >= 5 ? 'high' : b.zScore >= 4 ? 'medium' : 'low',
    title: `5분간 댓글 ${b.count}개 집중 (z=${b.zScore.toFixed(1)})`,
    summary: `parent_source_id=${b.parentId}, 시간 ${b.ts}`,
    visualization: {
      kind: 'burst-heatmap',
      buckets: [{ ts: b.ts, count: b.count, zScore: b.zScore }],
    },
    rawRefs: b.samples.map((s) => ({
      itemId: s.itemId,
      source: s.source,
      time: s.time.toISOString(),
      excerpt: s.excerpt,
    })),
    rank: idx,
  }));

  const score = zScoreToScore(maxZ);
  const confidence = Math.min(1, comments.length / MIN_SAMPLES_FOR_FULL_CONFIDENCE);

  return {
    signal: 'burst',
    score,
    confidence,
    evidence,
    metrics: { maxZ, parentCount: byParent.size, sampleCount: comments.length },
    computeMs: Date.now() - t0,
  };
}

function emptyResult(computeMs: number): SignalResult {
  return {
    signal: 'burst',
    score: 0,
    confidence: 0,
    evidence: [],
    metrics: { maxZ: 0, parentCount: 0, sampleCount: 0 },
    computeMs,
  };
}
