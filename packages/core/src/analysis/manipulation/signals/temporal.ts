import { klDivergence, clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard, CommentRow } from '../types';

const MIN_SAMPLES_FOR_CONFIDENCE = 50;
const KL_HIGH_THRESHOLD = 1.0;
const KL_MEDIUM_THRESHOLD = 0.5;
const KL_EVIDENCE_THRESHOLD = 0.3;

export function computeTemporalAnomaly(
  comments: CommentRow[],
  baselineBySource: Record<string, number[]>,
): SignalResult {
  const t0 = Date.now();
  if (comments.length === 0) {
    return {
      signal: 'temporal',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { kl: 0, sampleCount: 0 },
      computeMs: Date.now() - t0,
    };
  }

  const bySource = new Map<string, number[]>();
  for (const c of comments) {
    if (!bySource.has(c.source)) bySource.set(c.source, Array(24).fill(0));
    const hour = c.time.getUTCHours();
    bySource.get(c.source)![hour] += 1;
  }

  let maxKl = 0;
  let worstSource = '';
  let worstHist: number[] = [];
  let worstBaseline: number[] = [];
  for (const [source, hist] of bySource) {
    const total = hist.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const p = hist.map((v) => v / total);
    const baseline = baselineBySource[source];
    if (!baseline || baseline.length !== 24) continue;
    const kl = klDivergence(p, baseline);
    if (kl > maxKl) {
      maxKl = kl;
      worstSource = source;
      worstHist = hist;
      worstBaseline = baseline;
    }
  }

  const score = clamp(maxKl >= KL_HIGH_THRESHOLD ? 70 + (maxKl - 1) * 15 : maxKl * 70, 0, 100);
  const confidence = Math.min(1, comments.length / MIN_SAMPLES_FOR_CONFIDENCE);

  const evidence: EvidenceCard[] = [];
  if (worstSource && maxKl > KL_EVIDENCE_THRESHOLD) {
    const total = worstHist.reduce((a, b) => a + b, 0);
    evidence.push({
      signal: 'temporal',
      severity:
        maxKl >= KL_HIGH_THRESHOLD ? 'high' : maxKl >= KL_MEDIUM_THRESHOLD ? 'medium' : 'low',
      title: `${worstSource} 시간대 분포 이상 (KL=${maxKl.toFixed(2)})`,
      summary: `현재 분포가 baseline 대비 비정상`,
      visualization: {
        kind: 'temporal-bars',
        bars: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          current: worstHist[h] / total,
          baseline: worstBaseline[h],
        })),
      },
      rawRefs: [],
      rank: 0,
    });
  }

  return {
    signal: 'temporal',
    score,
    confidence,
    evidence,
    metrics: { kl: maxKl, sampleCount: comments.length },
    computeMs: Date.now() - t0,
  };
}
