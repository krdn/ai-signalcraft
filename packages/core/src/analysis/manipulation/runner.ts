import { computeBurstFromComments } from './signals/burst';
import { computeVoteAnomaly } from './signals/vote';
import { computeSimilarity, extractClustersForCrossPlatform } from './signals/similarity';
import { computeMediaSync } from './signals/media-sync';
import { computeTrendShape } from './signals/trend-shape';
import { computeTemporalAnomaly } from './signals/temporal';
import { computeCrossPlatform } from './signals/cross-platform';
import { aggregate, type AggregateResult } from './aggregator';
import type { SignalResult, SignalContext, ManipulationDataLoader, DomainConfig } from './types';

export type RunInput = {
  jobId: number;
  subscriptionId: number | null;
  config: DomainConfig; // domain은 config.domain에서 파생
  dateRange: { start: Date; end: Date };
  loader: ManipulationDataLoader;
};

export type RunOutput = {
  signals: SignalResult[];
  aggregate: AggregateResult;
};

/**
 * 7개 신호 모듈을 단일 entry-point로 통합 실행.
 *
 * 흐름:
 *   1. SignalContext 구성 → loader 6개 메서드를 Promise.all로 병렬 호출
 *   2. 각 신호 계산은 직렬 (결정론적·CPU 바운드 — 병렬화 이득 미미)
 *   3. S3(similarity)와 S7(cross-platform)는 같은 EmbeddedItem[]에서 두 번 클러스터링
 *      (TODO: 클러스터 결과 재사용 최적화)
 *   4. aggregator로 7개 결과를 단일 manipulationScore + confidenceFactor로 축약
 *
 * loader는 raw_items DB 쿼리를 직접 하지 않도록 추상화 — 테스트 시 in-memory mock,
 * Phase 2에서는 orchestrator가 실제 DB 구현체를 주입.
 */
export async function runManipulationDetection(input: RunInput): Promise<RunOutput> {
  const ctx: SignalContext = {
    jobId: input.jobId,
    subscriptionId: input.subscriptionId,
    domain: input.config.domain, // config에서 파생
    config: input.config,
    dateRange: input.dateRange,
  };

  const [comments, votes, embComments, embArticles, trendSeries, baselines] = await Promise.all([
    input.loader.loadComments(ctx),
    input.loader.loadVotes(ctx),
    input.loader.loadEmbeddedComments(ctx),
    input.loader.loadEmbeddedArticles(ctx),
    input.loader.loadTrendSeries(ctx),
    input.loader.loadTemporalBaselines(ctx),
  ]);

  // 통계·임베딩 신호 (모두 결정론적, CPU 바운드)
  const burst = computeBurstFromComments(comments);
  const vote = computeVoteAnomaly(votes);
  const simResult = computeSimilarity(embComments);
  const mediaSync = computeMediaSync(embArticles);
  const trend = computeTrendShape(trendSeries);
  const temporal = computeTemporalAnomaly(comments, baselines);

  // S7는 S3 클러스터 후처리 — 같은 임베딩 셋을 다시 클러스터링
  const clusters = extractClustersForCrossPlatform(embComments);
  const crossPlatform = computeCrossPlatform(clusters);

  // 배열 순서는 의미 없음 — Aggregator/Persist 모두 s.signal 키로 lookup.
  const signals: SignalResult[] = [
    burst,
    simResult,
    vote,
    mediaSync,
    trend,
    crossPlatform,
    temporal,
  ];
  const aggregateResult = aggregate(signals, input.config);

  return { signals, aggregate: aggregateResult };
}
