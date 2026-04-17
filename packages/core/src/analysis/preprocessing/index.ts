import type { AnalysisInput } from '../types';
import { OPTIMIZATION_PRESETS, type OptimizationPreset } from './presets';
import { deduplicateArticles } from './deduplicator';
import { clusterArticles } from './clusterer';
import { compressComments } from './comment-compressor';
import { ragRetrieve, isRAGPreset } from './rag-retriever';
import { normalizeAnalysisInput, type NormalizationStats } from './text-normalizer';

export { OPTIMIZATION_PRESETS, type OptimizationPreset, type PresetConfig } from './presets';
export { compressComments } from './comment-compressor';
export { deduplicateArticles } from './deduplicator';
export { clusterArticles } from './clusterer';
export { ragRetrieve, isRAGPreset } from './rag-retriever';
export {
  normalizeAnalysisInput,
  normalizeText,
  normalizeWithDomain,
  type NormalizationStats,
} from './text-normalizer';
export { getDomainLexicon } from './lexicon';
export type { DomainLexicon, PatternRule, EntityRule, SarcasmRule } from './lexicon';

export interface PreprocessingResult {
  input: AnalysisInput;
  stats: {
    originalArticles: number;
    optimizedArticles: number;
    originalComments: number;
    optimizedComments: number;
    reductionPercent: number;
    preset: OptimizationPreset;
    normalization?: NormalizationStats;
  };
}

export async function preprocessAnalysisInput(
  input: AnalysisInput,
  preset: OptimizationPreset,
  _jobId: number,
): Promise<PreprocessingResult> {
  const originalArticles = input.articles.length;
  const originalComments = input.comments.length;

  // 0. 도메인 특화 텍스트 정규화 (은어/반어/개체명 통합)
  // input.domain이 없으면 공통 규칙만 적용된다.
  const { input: normalizedInput, stats: normalizationStats } = normalizeAnalysisInput(
    input,
    input.domain,
  );

  // RAG 모드: DB 임베딩 기반 의미 검색으로 선별
  if (isRAGPreset(preset)) {
    const ragResult = await ragRetrieve(normalizedInput, preset);
    return {
      input: { ...normalizedInput, articles: ragResult.articles, comments: ragResult.comments },
      stats: {
        originalArticles,
        optimizedArticles: ragResult.stats.selectedArticles,
        originalComments,
        optimizedComments: ragResult.stats.selectedComments,
        reductionPercent: ragResult.stats.reductionPercent,
        preset,
        normalization: normalizationStats,
      },
    };
  }

  // 기존 모드: 임베딩 재계산 기반 전처리
  const config = OPTIMIZATION_PRESETS[preset];
  let articles = normalizedInput.articles;
  let comments = normalizedInput.comments;

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
    input: { ...normalizedInput, articles, comments },
    stats: {
      originalArticles,
      optimizedArticles,
      originalComments,
      optimizedComments,
      reductionPercent,
      preset,
      normalization: normalizationStats,
    },
  };
}
