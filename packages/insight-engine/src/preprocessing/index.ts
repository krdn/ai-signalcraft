import type { AnalysisInput } from '../types';
import { OPTIMIZATION_PRESETS, type OptimizationPreset } from './presets';
import { deduplicateArticles } from './deduplicator';
import { clusterArticles } from './clusterer';
import { compressComments } from './comment-compressor';

export { OPTIMIZATION_PRESETS, type OptimizationPreset, type PresetConfig } from './presets';
export { compressComments } from './comment-compressor';
export { deduplicateArticles } from './deduplicator';
export { clusterArticles } from './clusterer';

export interface PreprocessingResult {
  input: AnalysisInput;
  stats: {
    originalArticles: number;
    optimizedArticles: number;
    originalComments: number;
    optimizedComments: number;
    reductionPercent: number;
    preset: OptimizationPreset;
  };
}

export async function preprocessAnalysisInput(
  input: AnalysisInput,
  preset: OptimizationPreset,
  _jobId: number,
): Promise<PreprocessingResult> {
  const config = OPTIMIZATION_PRESETS[preset];
  const originalArticles = input.articles.length;
  const originalComments = input.comments.length;

  let articles = input.articles;
  let comments = input.comments;

  // 1. 중복 제거
  if (config.deduplication && config.similarityThreshold !== null) {
    try {
      articles = await deduplicateArticles(articles, config.similarityThreshold);
    } catch (error) {
      console.error(`[preprocessing] 중복 제거 실패 (원본 유지):`, error);
    }
  }

  // 2. 클러스터링 (강력 모드)
  if (config.clustering && config.similarityThreshold !== null) {
    try {
      articles = await clusterArticles(articles, config.similarityThreshold);
    } catch (error) {
      console.error(`[preprocessing] 클러스터링 실패 (원본 유지):`, error);
    }
  }

  // 3. 댓글 압축
  comments = compressComments(comments, config.commentLimit);

  const optimizedArticles = articles.length;
  const optimizedComments = comments.length;
  const totalOriginal = originalArticles + originalComments;
  const totalOptimized = optimizedArticles + optimizedComments;
  const reductionPercent =
    totalOriginal > 0 ? Math.round(((totalOriginal - totalOptimized) / totalOriginal) * 100) : 0;

  return {
    input: { ...input, articles, comments },
    stats: {
      originalArticles,
      optimizedArticles,
      originalComments,
      optimizedComments,
      reductionPercent,
      preset,
    },
  };
}
