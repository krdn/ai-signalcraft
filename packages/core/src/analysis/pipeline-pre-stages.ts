// 분석 파이프라인 — Stage 1 이전 입력 가공 단계
//
// pipeline-orchestrator.ts에서 분리된 헬퍼:
//   1. runDomainNormalization — 도메인 특화 정규화 (은어/반어/개체명)
//   2. runTokenOptimization — 토큰 최적화 전처리 (RAG 후샘플 또는 일반 preprocess)
//
// 두 헬퍼는 입력을 변형하므로 새 input과 stats를 반환한다 (호출 측이 ctx.input에 재할당).
import { logError } from '../utils/logger';
import { recordStageDuration, withSpan } from '../metrics';
import { updateJobProgress } from '../pipeline/persist';
import {
  preprocessAnalysisInput,
  normalizeAnalysisInput,
  type OptimizationPreset,
} from './preprocessing';
import type { AnalysisInput } from './types';

/**
 * 도메인 특화 정규화 — 토큰 최적화 유무와 무관하게 항상 적용.
 * 실패 시 원본 input을 그대로 반환 (분석 차단 아님).
 */
export async function runDomainNormalization(
  jobId: number,
  input: AnalysisInput,
): Promise<AnalysisInput> {
  let normalized = input;
  await withSpan(
    'normalization',
    async () => {
      const normStart = Date.now();
      try {
        await updateJobProgress(jobId, {
          normalization: { status: 'running', domain: input.domain ?? 'default' },
        }).catch((err) => logError('pipeline-orchestrator', err));
        const { input: normalizedInput, stats: normStats } = normalizeAnalysisInput(
          input,
          input.domain,
        );
        normalized = normalizedInput;
        await updateJobProgress(jobId, {
          normalization: { status: 'completed', ...normStats },
        }).catch((err) => logError('pipeline-orchestrator', err));
        await recordStageDuration('normalization', Date.now() - normStart, 'completed');
      } catch (error) {
        console.error(`[pipeline] 도메인 정규화 실패 (원본 유지):`, error);
        await updateJobProgress(jobId, {
          normalization: { status: 'failed' },
        }).catch((err) => logError('pipeline-orchestrator', err));
        await recordStageDuration('normalization', Date.now() - normStart, 'failed');
      }
    },
    { domain: input.domain ?? 'default' },
  );
  return normalized;
}

/**
 * 토큰 최적화 전처리.
 *
 * 분기:
 *   - usingCollectorRag: collector가 이미 의미 검색 완료 → 시계열 후샘플(stratifiedSample)만 적용
 *   - 일반 RAG/dedup/cluster: preprocessAnalysisInput 위임 (정규화는 이미 적용됨, skipNormalization=true)
 *   - none: 진행 표시만 'skipped'로 기록
 *
 * 실패 시 원본 input 반환 (분석 차단 아님).
 */
export async function runTokenOptimization(params: {
  jobId: number;
  input: AnalysisInput;
  tokenOptimization: OptimizationPreset;
  isCollectorPath: boolean;
}): Promise<AnalysisInput> {
  const { jobId, tokenOptimization, isCollectorPath } = params;
  let { input } = params;

  // P2+P4: RAG 프리셋 + collector loader 경로 → collector가 이미 의미 검색 완료.
  // 분석 측 ragRetrieve(분석 DB articles 검색)는 구독 경로에서 무효화되어 있어 우회한다.
  // 시계열 후샘플(stratifiedSample)만 호출해 한도 내로 줄이면서 시간 분포를 보존.
  const usingCollectorRag =
    isCollectorPath &&
    (tokenOptimization === 'rag-light' ||
      tokenOptimization === 'rag-standard' ||
      tokenOptimization === 'rag-aggressive');

  if (usingCollectorRag) {
    // collector RAG로 들어온 의미 풀(topK×3)을 한도(presetTopK)로 시계열 균등 컷
    const tokenStart = Date.now();
    try {
      await updateJobProgress(jobId, {
        'token-optimization': {
          status: 'running',
          preset: tokenOptimization,
          phase: 'collector-rag-postsample',
        },
      }).catch((err) => logError('pipeline-orchestrator', err));

      const { RAG_CONFIGS } = await import('./preprocessing/rag-retriever');
      const ragConfig = RAG_CONFIGS[tokenOptimization];
      const articleLimit = ragConfig.articleTopK + ragConfig.clusterRepresentatives;
      const commentLimit = ragConfig.commentTopK;
      const originalArticles = input.articles.length;
      const originalComments = input.comments.length;

      const { calculateBudget, stratifiedSample } = await import('./sampling');

      const cutByTimeStratified = <T>(
        items: T[],
        limit: number,
        getTs: (i: T) => Date | null,
        getLike: (i: T) => number | null,
      ): T[] => {
        if (items.length <= limit || limit <= 0) return items;
        const budget = calculateBudget({
          dateRange: input.dateRange,
          totalArticles: 0,
          totalComments: items.length,
          totalVideos: 0,
        });
        const tuned = {
          ...budget,
          targets: { ...budget.targets, comments: limit },
          minimums: {
            ...budget.minimums,
            comments: Math.max(1, Math.floor(limit / Math.max(1, budget.binCount))),
          },
        };
        return stratifiedSample(items, tuned, getTs, getLike).sampled;
      };

      const cutArticles = cutByTimeStratified(
        input.articles,
        articleLimit,
        (a) => a.publishedAt,
        () => null,
      );
      const cutComments = cutByTimeStratified(
        input.comments,
        commentLimit,
        (c) => c.publishedAt,
        (c) => c.likeCount,
      );

      input = { ...input, articles: cutArticles, comments: cutComments };

      await updateJobProgress(jobId, {
        'token-optimization': {
          status: 'completed',
          phase: 'collector-rag-postsample',
          preset: tokenOptimization,
          originalArticles,
          optimizedArticles: cutArticles.length,
          originalComments,
          optimizedComments: cutComments.length,
        },
      }).catch((err) => logError('pipeline-orchestrator', err));
      await recordStageDuration('token-optimization', Date.now() - tokenStart, 'completed');
    } catch (error) {
      console.error(`[pipeline] collector RAG 후샘플 실패:`, error);
      await updateJobProgress(jobId, {
        'token-optimization': { status: 'failed', phase: 'collector-rag-postsample' },
      }).catch((err) => logError('pipeline-orchestrator', err));
      await recordStageDuration('token-optimization', Date.now() - tokenStart, 'failed');
    }
  } else if (tokenOptimization !== 'none') {
    const tokenStart = Date.now();
    try {
      await updateJobProgress(jobId, {
        'token-optimization': { status: 'running', preset: tokenOptimization },
      }).catch((err) => logError('pipeline-orchestrator', err));
      const preprocessed = await preprocessAnalysisInput(input, tokenOptimization, jobId, {
        skipNormalization: true,
      });
      input = preprocessed.input;
      await updateJobProgress(jobId, {
        'token-optimization': {
          status: 'completed',
          phase: 'preprocessing',
          ...preprocessed.stats,
        },
      }).catch((err) => logError('pipeline-orchestrator', err));
      await recordStageDuration('token-optimization', Date.now() - tokenStart, 'completed');
    } catch (error) {
      console.error(`[pipeline] 토큰 최적화 실패:`, error);
      await updateJobProgress(jobId, {
        'token-optimization': { status: 'failed', phase: 'error' },
      }).catch((err) => logError('pipeline-orchestrator', err));
      await recordStageDuration('token-optimization', Date.now() - tokenStart, 'failed');
    }
  } else {
    await updateJobProgress(jobId, { 'token-optimization': { status: 'skipped' } }).catch((err) =>
      logError('pipeline-orchestrator', err),
    );
  }

  return input;
}
