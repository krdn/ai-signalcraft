import { klDivergence, clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard, CommentRow } from '../types';

const MIN_SAMPLES_FOR_CONFIDENCE = 50;
const KL_HIGH_THRESHOLD = 1.0;
const KL_MEDIUM_THRESHOLD = 0.5;
const KL_EVIDENCE_THRESHOLD = 0.3;

/**
 * 시간대 분포 이상 (KL divergence) 계산.
 *
 * @param comments 분석 대상 댓글 — `time`은 Date, UTC 기준으로 해석됨
 * @param baselineBySource 소스별 24시간 baseline 분포 (확률).
 *   배열 인덱스 0~23은 **UTC hour**여야 함 (현재 분포와 동일 컨벤션). 합=1.
 * @returns SignalResult — confidence는 (샘플 수) × (baseline 매칭된 source 비율)
 */
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
      metrics: { kl: 0, sampleCount: 0, measuredCount: 0, skippedSources: 0 },
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
  let measuredCommentCount = 0;
  let skippedSources = 0;
  for (const [source, hist] of bySource) {
    const total = hist.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const baseline = baselineBySource[source];
    if (!baseline || baseline.length !== 24) {
      skippedSources++;
      continue;
    }
    measuredCommentCount += total;
    const p = hist.map((v) => v / total);
    const kl = klDivergence(p, baseline);
    if (kl > maxKl) {
      maxKl = kl;
      worstSource = source;
      worstHist = hist;
      worstBaseline = baseline;
    }
  }

  const score = clamp(maxKl >= KL_HIGH_THRESHOLD ? 70 + (maxKl - 1) * 15 : maxKl * 70, 0, 100);
  // confidence: 샘플 수 충분 × 측정 가능 비율 (baseline 매칭된 source 댓글 비율)
  const sampleConfidence = Math.min(1, comments.length / MIN_SAMPLES_FOR_CONFIDENCE);
  const measuredFraction = comments.length === 0 ? 0 : measuredCommentCount / comments.length;
  const confidence = sampleConfidence * measuredFraction;

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
    metrics: {
      kl: maxKl,
      sampleCount: comments.length,
      measuredCount: measuredCommentCount,
      skippedSources,
    },
    computeMs: Date.now() - t0,
  };
}
