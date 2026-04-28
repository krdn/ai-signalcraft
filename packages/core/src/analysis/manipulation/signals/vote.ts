import { iqr, clamp } from '../utils/stats';
import type { SignalResult, EvidenceCard } from '../types';

const MIN_SAMPLES_FOR_CONFIDENCE = 30;
const MIN_PARENT_ROWS = 5;
const MIN_BASELINE_ROWS = 2;
const MAX_RAW_REFS = 20;
const OUTLIER_RATIO_HIGH = 0.15;
const OUTLIER_RATIO_MEDIUM = 0.05;
const OUTLIER_SCORE_MULTIPLIER = 500; // 0.20 비율 → 100점
const IQR_UPPER_FENCE_K = 1.5;

export type VoteRow = {
  itemId: string;
  source: string;
  parentSourceId: string;
  length: number;
  likeCount: number;
  time: Date;
};

/**
 * 비정상 추천(좋아요) 신호 — 게시물별 IQR 이상치 + 길이 회귀 잔차.
 *
 * 두 단계(two-pass) 접근으로 OLS leverage 문제 회피:
 *   1. IQR 임계(q3 + 1.5*IQR)로 baseline 후보 제외
 *   2. baseline (비-outlier) 만으로 길이 ~ 좋아요 회귀 적합
 *   3. 후보(IQR 초과)들의 잔차를 baseline 회귀선 기준으로 측정
 *      → 잔차 > IQR 이면 진짜 outlier로 확정
 *
 * 단순히 전체 데이터로 회귀를 적합하면 outlier 자체가 큰 leverage로 회귀선을 왜곡해
 * 일부 outlier의 expected 값이 자기 자신에 가깝게 잡혀 잔차가 작게 나오는 문제 발생
 * (Task 7 robust 패턴과 동일).
 *
 * @param rows 분석 대상 댓글(좋아요 포함). 추천 미수집 소스(예: 네이버)는 사전 필터.
 * @returns SignalResult — confidence는 샘플 수 기준 선형
 */
export function computeVoteAnomaly(rows: VoteRow[]): SignalResult {
  const t0 = Date.now();
  if (rows.length === 0) {
    return {
      signal: 'vote',
      score: 0,
      confidence: 0,
      evidence: [],
      metrics: { outlierRatio: 0, sampleCount: 0 },
      computeMs: Date.now() - t0,
    };
  }

  // 게시물별 그룹핑
  const byParent = new Map<string, VoteRow[]>();
  for (const r of rows) {
    if (!byParent.has(r.parentSourceId)) byParent.set(r.parentSourceId, []);
    byParent.get(r.parentSourceId)!.push(r);
  }

  const outliers: { row: VoteRow; expected: number; residual: number }[] = [];
  let totalCount = 0;
  for (const [, list] of byParent) {
    if (list.length < MIN_PARENT_ROWS) continue;
    const likes = list.map((r) => r.likeCount);
    const sortedLikes = [...likes].sort((a, b) => a - b);
    const q3 = sortedLikes[Math.floor(sortedLikes.length * 0.75)];
    const range = iqr(likes);
    const upper = q3 + IQR_UPPER_FENCE_K * range;

    // 1단계: IQR 후보 분리
    const baseline = list.filter((r) => r.likeCount <= upper);
    const candidates = list.filter((r) => r.likeCount > upper);

    // baseline이 너무 작으면(degenerate) 회귀 불가능 — 후보를 outlier로 인정
    if (baseline.length < MIN_BASELINE_ROWS) {
      for (const r of candidates) {
        outliers.push({ row: r, expected: 0, residual: r.likeCount });
      }
      totalCount += list.length;
      continue;
    }

    // 2단계: baseline만으로 회귀 적합 (leverage 회피)
    const meanLen = baseline.reduce((s, r) => s + r.length, 0) / baseline.length;
    const meanLike = baseline.reduce((s, r) => s + r.likeCount, 0) / baseline.length;
    let num = 0;
    let den = 0;
    for (const r of baseline) {
      num += (r.length - meanLen) * (r.likeCount - meanLike);
      den += (r.length - meanLen) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanLike - slope * meanLen;

    // 3단계: 후보들의 잔차를 baseline 회귀선 기준으로 측정
    for (const r of candidates) {
      const expected = slope * r.length + intercept;
      const residual = r.likeCount - expected;
      if (residual > range) {
        outliers.push({ row: r, expected, residual });
      }
    }
    totalCount += list.length;
  }

  const outlierRatio = totalCount === 0 ? 0 : outliers.length / totalCount;
  const score = clamp(outlierRatio * OUTLIER_SCORE_MULTIPLIER, 0, 100);
  // confidence: 샘플 수 충분 × 분석 가능 비율 (parent별 MIN_PARENT_ROWS 통과한 행 비율)
  const sampleConfidence = Math.min(1, rows.length / MIN_SAMPLES_FOR_CONFIDENCE);
  const analyzedFraction = rows.length === 0 ? 0 : totalCount / rows.length;
  const confidence = sampleConfidence * analyzedFraction;

  outliers.sort((a, b) => b.residual - a.residual);
  const evidence: EvidenceCard[] = [];
  if (outliers.length > 0) {
    const top = outliers.slice(0, MAX_RAW_REFS);
    evidence.push({
      signal: 'vote',
      severity:
        outlierRatio >= OUTLIER_RATIO_HIGH
          ? 'high'
          : outlierRatio >= OUTLIER_RATIO_MEDIUM
            ? 'medium'
            : 'low',
      title: `비정상 추천 ${outliers.length}건 (전체 ${totalCount}건 중)`,
      summary: `짧은 댓글이 비정상적으로 높은 좋아요`,
      visualization: {
        kind: 'vote-scatter',
        points: top.map((o) => ({
          length: o.row.length,
          likes: o.row.likeCount,
          isOutlier: true,
        })),
      },
      rawRefs: top.map((o) => ({
        itemId: o.row.itemId,
        source: o.row.source,
        time: o.row.time.toISOString(),
        excerpt: '',
      })),
      rank: 0,
    });
  }

  return {
    signal: 'vote',
    score,
    confidence,
    evidence,
    metrics: {
      outlierRatio,
      sampleCount: rows.length,
      analyzedCount: totalCount,
      skippedRows: rows.length - totalCount,
      outlierCount: outliers.length,
    },
    computeMs: Date.now() - t0,
  };
}
