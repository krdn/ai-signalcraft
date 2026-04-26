// 시계열 층화 샘플링 — 하이브리드 시간 분배 + 좋아요 제곱근 가중
import type { AnalysisInput } from '../types';
import type { SamplingBudget } from './budget-calculator';

export interface SamplingStats {
  totalInput: number;
  totalSampled: number;
  binsUsed: number;
  nullPoolSize: number;
  nullPoolSampled: number;
  perBin: Array<{
    index: number;
    start: Date;
    end: Date;
    inputCount: number;
    sampledCount: number;
  }>;
}

/**
 * 좋아요 제곱근 가중 복원 추출 샘플링
 * weight = (1 - alpha) + alpha * sqrt(likeCount / maxLike)
 * alpha=0.5: 균등과 인기의 균형
 */
function weightedSample<T>(
  items: T[],
  count: number,
  getLikeCount: (item: T) => number | null,
  alpha = 0.5,
): T[] {
  if (items.length <= count) return [...items];

  const likes = items.map((item) => getLikeCount(item) ?? 0);
  const maxLike = Math.max(...likes, 1);

  const weights = likes.map((like) => 1 - alpha + alpha * Math.sqrt(like / maxLike));

  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const selected = new Set<number>();
  const result: T[] = [];

  while (result.length < count && selected.size < items.length) {
    let r = Math.random() * (totalWeight - sumWeights(selected, weights));
    for (let i = 0; i < items.length; i++) {
      if (selected.has(i)) continue;
      r -= weights[i];
      if (r <= 0) {
        selected.add(i);
        result.push(items[i]);
        break;
      }
    }
  }

  return result;
}

function sumWeights(excluded: Set<number>, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    if (!excluded.has(i)) sum += weights[i];
  }
  return sum;
}

/** 아이템을 시간 구간에 할당 */
function assignToBins<T>(
  items: T[],
  binBoundaries: Date[],
  getTimestamp: (item: T) => Date | null,
): { bins: T[][]; nullPool: T[] } {
  const bins: T[][] = Array.from({ length: binBoundaries.length - 1 }, () => []);
  const nullPool: T[] = [];

  for (const item of items) {
    const ts = getTimestamp(item);
    if (!ts) {
      nullPool.push(item);
      continue;
    }

    let assigned = false;
    for (let i = 0; i < binBoundaries.length - 1; i++) {
      if (ts >= binBoundaries[i] && ts < binBoundaries[i + 1]) {
        bins[i].push(item);
        assigned = true;
        break;
      }
    }
    // 마지막 구간의 끝 경계 포함
    if (!assigned && ts.getTime() === binBoundaries[binBoundaries.length - 1].getTime()) {
      bins[bins.length - 1].push(item);
      assigned = true;
    }
    if (!assigned) {
      nullPool.push(item);
    }
  }

  return { bins, nullPool };
}

/** 제네릭 시계열 층화 샘플링 */
export function stratifiedSample<T>(
  items: T[],
  budget: SamplingBudget,
  getTimestamp: (item: T) => Date | null,
  getLikeCount: (item: T) => number | null,
  options?: { likeWeightAlpha?: number },
): { sampled: T[]; stats: SamplingStats } {
  if (items.length === 0) {
    return {
      sampled: [],
      stats: {
        totalInput: 0,
        totalSampled: 0,
        binsUsed: 0,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
    };
  }

  const alpha = options?.likeWeightAlpha ?? 0.5;
  const target = budget.targets.comments; // 호출부에서 아티클/댓글/비디오별로 호출
  const perBinMin = budget.minimums.comments;

  const { bins, nullPool } = assignToBins(items, budget.binBoundaries, getTimestamp);
  const binCount = bins.length;

  // Phase 1: 각 bin에서 최소 보장 수만큼 샘플링
  const binSamples: T[][] = bins.map((binItems) =>
    weightedSample(binItems, Math.min(perBinMin, binItems.length), getLikeCount, alpha),
  );

  let allocated = binSamples.reduce((sum, s) => sum + s.length, 0);
  const remaining = Math.max(0, target - allocated);

  // Phase 2: 잔여 슬롯을 수집량 비례로 분배
  if (remaining > 0) {
    const binCounts = bins.map((b) => b.length);
    const totalInBins = binCounts.reduce((a, b) => a + b, 0);

    if (totalInBins > 0) {
      // 각 bin에 수집량 비례로 추가 슬롯 배분
      const extraSlots = binCounts.map((count) => {
        const proportion = count / totalInBins;
        return Math.min(
          Math.round(remaining * proportion),
          count - binSamples[binCounts.indexOf(count)].length,
        );
      });

      // 반올림 오차 보정
      const totalExtra = extraSlots.reduce((a, b) => a + b, 0);
      let diff = remaining - totalExtra;
      for (let i = 0; diff > 0 && i < binCount; i++) {
        const binRemaining = bins[i].length - binSamples[i].length;
        if (binRemaining > 0) {
          extraSlots[i]++;
          diff--;
        }
      }

      for (let i = 0; i < binCount; i++) {
        if (extraSlots[i] <= 0) continue;
        const alreadySampled = new Set(binSamples[i]);
        const available = bins[i].filter((item) => !alreadySampled.has(item));
        const extra = weightedSample(available, extraSlots[i], getLikeCount, alpha);
        binSamples[i] = [...binSamples[i], ...extra];
      }
    }
  }

  // Phase 3: nullPool에서 잔여 보충
  allocated = binSamples.reduce((sum, s) => sum + s.length, 0);
  let nullPoolSampled = 0;
  if (allocated < target && nullPool.length > 0) {
    const needed = Math.min(target - allocated, nullPool.length);
    const nullSamples = weightedSample(nullPool, needed, getLikeCount, alpha);
    nullPoolSampled = nullSamples.length;
    binSamples.push(nullSamples);
  }

  // Phase 4: 시간순 병합 (nullPool은 마지막에)
  const sampled = binSamples.flat();

  const perBinStats = bins.map((binItems, i) => ({
    index: i,
    start: budget.binBoundaries[i],
    end: budget.binBoundaries[i + 1] ?? budget.binBoundaries[budget.binBoundaries.length - 1],
    inputCount: binItems.length,
    sampledCount: binSamples[i]?.length ?? 0,
  }));

  return {
    sampled,
    stats: {
      totalInput: items.length,
      totalSampled: sampled.length,
      binsUsed: bins.filter((b) => b.length > 0).length,
      nullPoolSize: nullPool.length,
      nullPoolSampled,
      perBin: perBinStats,
    },
  };
}

/** 시계열 샘플링 결과 통계 — pipeline-orchestrator가 progress에 기록 */
export interface AppliedSamplingStats {
  binCount: number;
  binIntervalMs: number;
  articles: SamplingStats;
  comments: SamplingStats;
  videos: SamplingStats;
}

/** AnalysisInput 전체에 시계열 샘플링 적용 */
export function applyTimeSeriesSampling(
  input: AnalysisInput,
  budget: SamplingBudget,
): { input: AnalysisInput; stats: AppliedSamplingStats } {
  // 기사 샘플링
  const articleResult = stratifiedSample(
    input.articles,
    {
      ...budget,
      targets: { ...budget.targets, comments: budget.targets.articles },
      minimums: { ...budget.minimums, comments: budget.minimums.articles },
    },
    (a) => a.publishedAt,
    () => null,
  );

  // 댓글 샘플링
  const commentResult = stratifiedSample(
    input.comments,
    budget,
    (c) => c.publishedAt,
    (c) => c.likeCount,
  );

  // 영상 샘플링
  const videoResult = stratifiedSample(
    input.videos,
    {
      ...budget,
      targets: { ...budget.targets, comments: budget.targets.videos },
      minimums: { ...budget.minimums, comments: budget.minimums.videos },
    },
    (v) => v.publishedAt,
    (v) => v.likeCount,
  );

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[sampling] 기사 ${input.articles.length}→${articleResult.sampled.length}, ` +
        `댓글 ${input.comments.length}→${commentResult.sampled.length}, ` +
        `영상 ${input.videos.length}→${videoResult.sampled.length}`,
    );
    console.log(
      `[sampling] 댓글 구간 분포:`,
      commentResult.stats.perBin
        .filter((b) => b.inputCount > 0)
        .map(
          (b) =>
            `${b.start.toISOString().slice(5, 16)}→${b.end.toISOString().slice(5, 16)}: ${b.sampledCount}/${b.inputCount}`,
        )
        .join(' | '),
    );
  }

  return {
    input: {
      ...input,
      articles: articleResult.sampled,
      comments: commentResult.sampled,
      videos: videoResult.sampled,
    },
    stats: {
      binCount: budget.binCount,
      binIntervalMs: budget.binIntervalMs,
      articles: articleResult.stats,
      comments: commentResult.stats,
      videos: videoResult.stats,
    },
  };
}
