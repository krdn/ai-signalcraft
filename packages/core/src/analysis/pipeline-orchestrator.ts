// 분석 파이프라인 오케스트레이션 — Stage 0~4 전체 관리
import { eq } from 'drizzle-orm';
import { getSkippedModules } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { appendJobEvent, updateJobProgress } from '../pipeline/persist';
import { logError } from '../utils/logger';
import { evaluateAlerts } from '../alerts';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { recordStageDuration, withSpan } from '../metrics';
import { persistFromCollectorPayload } from '../pipeline/persist-from-collector';
import { finalSummaryModule } from './modules';
import {
  runModule,
  STAGE1_MODULES,
  STAGE2_MODULES,
  getStage4Modules,
  createModelConfigAdapter,
} from './runner';
import { runModuleMapReduce } from './map-reduce';
import {
  loadAnalysisInput,
  loadAnalysisInputViaCollector,
  shouldUseCollectorLoader,
  type CollectorAnalysisResult,
} from './data-loader';
import {
  preprocessAnalysisInput,
  normalizeAnalysisInput,
  type OptimizationPreset,
} from './preprocessing';
import { analyzeItems } from './item-analyzer';
import { getConcurrencyConfig } from './concurrency-config';
import { runWithProviderGrouping } from './concurrency';
import { buildResult, generateFinalReport } from './report-builder';
import { extractEntitiesFromResults } from './ontology-extractor';
import { persistOntology } from './persist-ontology';
import { persistAnalysisResult } from './persist-analysis';
import { runSeriesDeltaAnalysis } from './delta';
import { runStage5Manipulation } from './manipulation';
import type { AnalysisModuleResult } from './types';
import type { PipelineContext } from './pipeline-context';
import {
  loadCompletedResults,
  preRunCheck,
  isSkipped,
  isAlreadyCompleted,
  checkFailAndAbort,
  markSkipped,
  collectResults,
} from './pipeline-helpers';

/** 재시작 옵션 */
export interface ResumeOptions {
  retryModules?: string[];
  reportOnly?: boolean;
  useCollectorLoader?: boolean;
  skipItemAnalysis?: boolean;
}

/**
 * 전체 분석 파이프라인 실행
 * Stage 0: 개별 항목 분석 (선택)
 * Stage 1: 병렬 (모듈 1~4, 독립)
 * Stage 2: risk-map+opportunity 병렬, strategy 순차
 * Stage 3: 최종 요약
 * Stage 4: 고급 분석 (선택)
 */
export async function runAnalysisPipeline(
  jobId: number,
  options?: ResumeOptions,
): Promise<{
  results: Record<string, AnalysisModuleResult>;
  completedModules: string[];
  failedModules: string[];
  report: { markdownContent: string; oneLiner: string; totalTokens: number };
  cancelledByUser?: boolean;
  costLimitExceeded?: boolean;
}> {
  // 구독 단축 경로: 잡 데이터 또는 DB options에서 useCollectorLoader 확인
  const cjRow = await getDb()
    .select()
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1)
    .then((r) => r[0]);
  const jobOptions = (cjRow?.options as Record<string, unknown>) || {};

  const isCollectorPath =
    options?.useCollectorLoader || jobOptions.useCollectorLoader || shouldUseCollectorLoader();

  const loadResult = isCollectorPath
    ? await loadAnalysisInputViaCollector(jobId)
    : await loadAnalysisInput(jobId);
  let input = loadResult.input;
  const samplingStats = loadResult.samplingStats;

  // 구독 단축 경로에서도 article_jobs/comment_jobs/video_jobs를 채워
  // RAG SQL과 UI 카운트가 일반 경로와 동일한 의미를 갖도록 보장.
  // (job 271 사례 — linkage 0건 결함 수정)
  if (isCollectorPath && 'fullset' in loadResult) {
    const collectorResult = loadResult as CollectorAnalysisResult;
    await updateJobProgress(jobId, {
      persist: { status: 'running', source: 'collector' },
    }).catch((err) => logError('pipeline-orchestrator', err));
    try {
      const persistResult = await persistFromCollectorPayload(jobId, collectorResult.fullset);
      await updateJobProgress(jobId, {
        persist: {
          status: 'completed',
          source: 'collector',
          articles: persistResult.articles,
          videos: persistResult.videos,
          comments: persistResult.comments,
        },
      }).catch((err) => logError('pipeline-orchestrator', err));
    } catch (err) {
      await updateJobProgress(jobId, {
        persist: {
          status: 'failed',
          source: 'collector',
          error: err instanceof Error ? err.message : String(err),
        },
      }).catch((err) => logError('pipeline-orchestrator', err));
      // 분석 자체는 RAG sample 입력으로 계속 진행 (linkage 누락은 가시성 손실이지 분석 차단 아님)
      try {
        await appendJobEvent(
          jobId,
          'warn',
          `persistFromCollectorPayload 실패: ${err instanceof Error ? err.message : String(err)}`,
        );
      } catch (err) {
        logError('pipeline-orchestrator', err);
      }
    }
  }

  // P3: 시계열 샘플링 통계를 progress에 기록 (구간별 입력/샘플 분포)
  // 폴백 동작·시간 편향 디버깅용. items 배열은 빠지므로 페이로드는 작음.
  await updateJobProgress(jobId, {
    sampling: {
      status: 'completed',
      binCount: samplingStats.binCount,
      binIntervalMs: samplingStats.binIntervalMs,
      articles: {
        totalInput: samplingStats.articles.totalInput,
        totalSampled: samplingStats.articles.totalSampled,
        binsUsed: samplingStats.articles.binsUsed,
        nullPoolSize: samplingStats.articles.nullPoolSize,
        nullPoolSampled: samplingStats.articles.nullPoolSampled,
        perBin: samplingStats.articles.perBin.map((b) => ({
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          inputCount: b.inputCount,
          sampledCount: b.sampledCount,
        })),
      },
      comments: {
        totalInput: samplingStats.comments.totalInput,
        totalSampled: samplingStats.comments.totalSampled,
        binsUsed: samplingStats.comments.binsUsed,
        nullPoolSize: samplingStats.comments.nullPoolSize,
        nullPoolSampled: samplingStats.comments.nullPoolSampled,
        perBin: samplingStats.comments.perBin.map((b) => ({
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          inputCount: b.inputCount,
          sampledCount: b.sampledCount,
        })),
      },
      videos: {
        totalInput: samplingStats.videos.totalInput,
        totalSampled: samplingStats.videos.totalSampled,
        binsUsed: samplingStats.videos.binsUsed,
        nullPoolSize: samplingStats.videos.nullPoolSize,
        nullPoolSampled: samplingStats.videos.nullPoolSampled,
      },
    },
  }).catch((err) => logError('pipeline-orchestrator', err));

  // 구독 단축 경로: collector API에서 로드한 데이터 통계를 progress에 기록
  // (수집/정규화 단계가 없으므로 UI에서 건수를 표시할 수 있도록)
  if (isCollectorPath) {
    const subStats: Record<
      string,
      { status: string; articles: number; comments: number; videos: number }
    > = {};
    const sourceGroups = new Map<string, { articles: number; comments: number; videos: number }>();
    for (const a of input.articles) {
      const src = a.source || 'unknown';
      const g = sourceGroups.get(src) || { articles: 0, comments: 0, videos: 0 };
      g.articles++;
      sourceGroups.set(src, g);
    }
    for (const c of input.comments) {
      const src = c.source || 'unknown';
      const g = sourceGroups.get(src) || { articles: 0, comments: 0, videos: 0 };
      g.comments++;
      sourceGroups.set(src, g);
    }
    for (const _v of input.videos) {
      const src = 'youtube';
      const g = sourceGroups.get(src) || { articles: 0, comments: 0, videos: 0 };
      g.videos++;
      sourceGroups.set(src, g);
    }
    for (const [src, g] of sourceGroups) {
      subStats[src] = { status: 'completed', ...g };
    }
    await updateJobProgress(jobId, subStats).catch((err) => logError('pipeline-orchestrator', err));
  }

  const loaded = await loadCompletedResults(jobId, options?.retryModules);

  if (Object.keys(loaded.allResults).length > 0) {
    console.log(
      `[pipeline] 체크포인트 복원: ${Object.keys(loaded.allResults).length}개 완료 결과 로드`,
    );
    appendJobEvent(
      jobId,
      'info',
      `체크포인트 복원: ${Object.keys(loaded.allResults).join(', ')} (DB에서 로드)`,
    ).catch((err) => logError('pipeline-orchestrator', err));
  }

  // reportOnly 모드 — ctx 구성 전 조기 반환
  if (options?.reportOnly) {
    const allResults = loaded.allResults;
    const completedModules = Object.values(allResults)
      .filter((r) => r.status === 'completed')
      .map((r) => r.module);
    if (completedModules.length === 0) {
      throw new Error('완료된 분석 결과가 없어 리포트를 생성할 수 없습니다');
    }
    const failedModules = Object.values(allResults)
      .filter((r) => r.status === 'failed')
      .map((r) => r.module);
    await updateJobProgress(input.jobId, { report: { status: 'running' } });
    const { generateIntegratedReport } = await import('../report/generator');
    const report = await generateIntegratedReport({
      jobId: input.jobId,
      keyword: input.keyword,
      dateRange: input.dateRange,
      results: allResults,
      completedModules,
      failedModules,
      domain: input.domain,
    });
    await updateJobProgress(input.jobId, { report: { status: 'completed' } });
    return { results: allResults, completedModules, failedModules, report };
  }

  // jobRow 조회 (옵션 + 프리셋 slug 확인용)
  const [jobRow] = await getDb()
    .select({ options: collectionJobs.options, keywordType: collectionJobs.keywordType })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  // 프리셋별 모델 설정 어댑터 생성
  const presetSlug = jobRow?.keywordType ?? undefined;
  const modelAdapter = createModelConfigAdapter(presetSlug);

  const concurrencyConfig = await getConcurrencyConfig();
  const providerConcurrency = concurrencyConfig.providerConcurrency;
  const skippedModules = await getSkippedModules(jobId);

  // PipelineContext 구성
  const ctx: PipelineContext = {
    jobId,
    input,
    allResults: loaded.allResults,
    priorResults: loaded.priorResults,
    cancelledByUser: false,
    costLimitExceeded: false,
    skippedModules,
    providerConcurrency,
    modelAdapter,
  };

  // 도메인 특화 정규화 (은어/반어/개체명 통합) — 토큰 최적화 유무와 무관하게 항상 적용
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
        input = normalizedInput;
        ctx.input = input;
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

  // 토큰 최적화 전처리 (정규화는 이미 적용됨 — preprocessAnalysisInput 내부에서
  // 한 번 더 호출되지만 멱등하므로 안전. 단 매칭 카운트만 0에 가깝게 나옴)
  const tokenOptimization = (jobRow?.options?.tokenOptimization ?? 'none') as OptimizationPreset;

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
      ctx.input = input;

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
      ctx.input = input;
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

  // BP 게이트: 토큰 최적화 완료 후
  if (!(await awaitStageGate(jobId, 'token-optimization'))) {
    ctx.cancelledByUser = true;
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // Stage 0: 개별 항목 분석 — Stage 1(AI 분석) 시작 전 필수 선행 단계
  // 구독 단축 경로에서는 이미 collector에서 감정 분석 완료
  const shouldSkipItemAnalysis = options?.skipItemAnalysis || jobOptions.skipItemAnalysis;

  if (!shouldSkipItemAnalysis) {
    try {
      await analyzeItems(jobId);
    } catch (error) {
      console.error(`[runner] 개별 항목 분석 실패:`, error);
      await updateJobProgress(jobId, {
        'item-analysis': { status: 'failed', phase: 'error' },
      }).catch((err) => logError('pipeline-orchestrator', err));
    }
  } else {
    console.log(`[pipeline] 구독 단축 경로: Stage 0(개별 감정 분석) 스킵`);
    await appendJobEvent(
      jobId,
      'info',
      '구독 단축 경로: 개별 감정 분석 스킵 (collector에서 이미 완료)',
    ).catch((err) => logError('pipeline-orchestrator', err));
  }

  // BP 게이트: 개별 감정 분석 완료 후
  if (!(await awaitStageGate(jobId, 'item-analysis'))) {
    ctx.cancelledByUser = true;
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // Stage 1: 병렬 실행
  if (!(await preRunCheck(ctx))) {
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  const stage1Active = STAGE1_MODULES.filter(
    (m) => !isSkipped(ctx, m.name) && !isAlreadyCompleted(ctx, m.name),
  );
  for (const m of STAGE1_MODULES.filter((m) => isSkipped(ctx, m.name)))
    await markSkipped(ctx, m.name);

  const stage1Results = await runWithProviderGrouping(
    stage1Active,
    (m) => runModuleMapReduce(m, ctx.input, undefined, ctx.modelAdapter),
    ctx.providerConcurrency,
  );
  collectResults(ctx, stage1Results);

  // Post-processing: macro-view dailyMentionTrend 보정 (AI가 빈 배열 반환 시 입력 데이터로 채움)
  const macroResult = ctx.allResults['macro-view'];
  if (macroResult?.status === 'completed' && macroResult.result) {
    const mv = macroResult.result as Record<string, unknown>;
    const trend = mv.dailyMentionTrend as Array<Record<string, unknown>> | undefined;
    if (!trend || trend.length === 0) {
      const dailyMap = new Map<string, { count: number }>();

      // collector loader 경로: 분석 입력은 RAG topK 한도로 좁아져 있으므로
      // collector DB의 수집 전체를 기준으로 일별 카운트를 가져온다.
      // 그래야 trend 차트가 실제 여론 볼륨을 반영한다.
      const usingCollectorLoader =
        options?.useCollectorLoader || jobOptions.useCollectorLoader || shouldUseCollectorLoader();
      const subscriptionId = jobOptions.subscriptionId as number | undefined;
      let trendSource: 'analysis-input' | 'collector-stats' = 'analysis-input';

      if (usingCollectorLoader && subscriptionId) {
        try {
          const { getCollectorClient } = await import('../collector-client');
          const client = getCollectorClient();
          const stats = await client.items.collectionStats.query({
            subscriptionId,
            dateRange: {
              start: ctx.input.dateRange.start.toISOString(),
              end: ctx.input.dateRange.end.toISOString(),
            },
          });
          for (const row of [...stats.articleDaily, ...stats.commentDaily, ...stats.videoDaily]) {
            if (!row.date) continue;
            const entry = dailyMap.get(row.date) || { count: 0 };
            entry.count += row.count;
            dailyMap.set(row.date, entry);
          }
          if (dailyMap.size > 0) trendSource = 'collector-stats';
        } catch (err) {
          logError('pipeline-orchestrator', err);
          // collector 호출 실패 시 분석 입력 폴백으로 떨어진다 (아래 블록).
        }
      }

      // 분석 입력 폴백 (collector 경로가 아니거나 collector 호출 실패한 경우)
      if (dailyMap.size === 0) {
        for (const item of [...ctx.input.articles, ...ctx.input.comments]) {
          const ts = item.publishedAt;
          if (!ts) continue;
          const date = new Date(ts).toISOString().split('T')[0];
          if (date === '1970-01-01') continue;
          const entry = dailyMap.get(date) || { count: 0 };
          entry.count++;
          dailyMap.set(date, entry);
        }
      }

      if (dailyMap.size > 0) {
        // AI가 sentimentRatio를 제공하지 않았으므로 null로 설정.
        // 가짜 비율을 만들어내지 않기 위함 — 대시보드에서는 null을 미제공으로 표시.
        mv.dailyMentionTrend = Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, entry]) => ({
            date,
            count: entry.count,
            sentimentRatio: null,
          }));
        console.log(
          `[pipeline] dailyMentionTrend 보정: ${dailyMap.size}일 분량 주입 (source=${trendSource})`,
        );
        appendJobEvent(
          jobId,
          'warn',
          `macro-view dailyMentionTrend: AI 빈 배열 — ${dailyMap.size}일치 count 주입 (source=${trendSource})`,
        ).catch((err) => logError('pipeline-orchestrator', err));
        // DB 동기화 — map-reduce에서 이미 빈 배열이 저장됐으므로 보정값을 덮어써야
        // 대시보드(DB 직접 조회)가 보정 결과를 볼 수 있다. usage는 기존값 유지.
        await persistAnalysisResult({
          jobId,
          module: 'macro-view',
          status: 'completed',
          result: mv as never,
          usage: macroResult.usage,
        }).catch((err) => logError('pipeline-orchestrator', err));
      }
    }
  }

  if (checkFailAndAbort(ctx, 'Stage 1')) {
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // BP 게이트: AI 분석 Stage 1 완료 후
  if (!(await awaitStageGate(jobId, 'analysis-stage1'))) {
    ctx.cancelledByUser = true;
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // Stage 2: risk-map + opportunity 병렬, strategy 순차
  if (await preRunCheck(ctx)) {
    const [riskMapMod, opportunityMod, strategyMod] = STAGE2_MODULES;

    const stage2Parallel = [riskMapMod, opportunityMod].filter(
      (m) => !isSkipped(ctx, m.name) && !isAlreadyCompleted(ctx, m.name),
    );
    for (const m of [riskMapMod, opportunityMod].filter((m) => isSkipped(ctx, m.name)))
      await markSkipped(ctx, m.name);

    const stage2Results = await runWithProviderGrouping(
      stage2Parallel,
      (m) => runModule(m, ctx.input, ctx.priorResults, ctx.modelAdapter),
      ctx.providerConcurrency,
    );
    collectResults(ctx, stage2Results);

    if (strategyMod && (await preRunCheck(ctx))) {
      if (isSkipped(ctx, strategyMod.name)) {
        await markSkipped(ctx, strategyMod.name);
      } else if (!isAlreadyCompleted(ctx, strategyMod.name)) {
        const result = await runModule(strategyMod, ctx.input, ctx.priorResults, ctx.modelAdapter);
        ctx.allResults[result.module] = result;
        if (result.status === 'completed') ctx.priorResults[result.module] = result.result;
      }
    }
  }

  if (ctx.cancelledByUser || ctx.costLimitExceeded) {
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }
  if (checkFailAndAbort(ctx, 'Stage 2')) {
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // Stage 3: 최종 요약
  if (!(await preRunCheck(ctx))) {
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }
  if (isSkipped(ctx, finalSummaryModule.name)) {
    await markSkipped(ctx, finalSummaryModule.name);
  } else if (!isAlreadyCompleted(ctx, finalSummaryModule.name)) {
    const finalResult = await runModule(
      finalSummaryModule,
      ctx.input,
      ctx.priorResults,
      ctx.modelAdapter,
    );
    ctx.allResults[finalResult.module] = finalResult;
    if (finalResult.status === 'completed')
      ctx.priorResults[finalResult.module] = finalResult.result;
  }

  if (checkFailAndAbort(ctx, 'Stage 3')) {
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // BP 게이트: AI 분석 Stage 2/3 완료 후
  if (!(await awaitStageGate(jobId, 'analysis-stage2'))) {
    ctx.cancelledByUser = true;
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // Stage 4: 고급 분석 (도메인별 모듈 라우팅)
  if (await preRunCheck(ctx)) {
    const { parallel: stage4Parallel, sequential: stage4Sequential } = getStage4Modules(
      ctx.input.domain,
    );
    const stage4aActive = stage4Parallel.filter(
      (m) => !isSkipped(ctx, m.name) && !isAlreadyCompleted(ctx, m.name),
    );
    for (const m of stage4Parallel.filter((m) => isSkipped(ctx, m.name)))
      await markSkipped(ctx, m.name);

    collectResults(
      ctx,
      await runWithProviderGrouping(
        stage4aActive,
        (m) => runModule(m, ctx.input, ctx.priorResults, ctx.modelAdapter),
        ctx.providerConcurrency,
      ),
    );

    if (checkFailAndAbort(ctx, 'Stage 4a')) {
      return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
    }

    for (const module of stage4Sequential) {
      if (!(await preRunCheck(ctx))) break;
      if (isSkipped(ctx, module.name)) {
        await markSkipped(ctx, module.name);
        continue;
      }
      if (isAlreadyCompleted(ctx, module.name)) continue;

      const result = await runModule(module, ctx.input, ctx.priorResults, ctx.modelAdapter);
      ctx.allResults[result.module] = result;
      if (result.status === 'completed') ctx.priorResults[result.module] = result.result;
      if (checkFailAndAbort(ctx, 'Stage 4b')) {
        return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
      }
    }
  }

  // BP 게이트: AI 분석 Stage 4 완료 후
  if (!(await awaitStageGate(jobId, 'analysis-stage4'))) {
    ctx.cancelledByUser = true;
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // Stage 5: Manipulation Detection (옵션, 비차단)
  // - default OFF: jobOptions.runManipulation === true 일 때만 실행
  // - 구독 경로 한정: subscriptionId 없으면 SKIP
  // - dateRange는 collectionJobs.startDate/endDate (분석 데이터 윈도우, 실행 시각이 아님)
  try {
    const [windowRow] = await getDb()
      .select({ startDate: collectionJobs.startDate, endDate: collectionJobs.endDate })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (windowRow?.startDate && windowRow?.endDate) {
      await runStage5Manipulation({
        jobId,
        jobOptions,
        domain: ctx.input.domain,
        dateRange: { start: windowRow.startDate, end: windowRow.endDate },
      });
    } else {
      logError('manipulation-stage5', new Error(`jobId ${jobId}: startDate/endDate 누락`));
    }
  } catch (err) {
    logError('manipulation-stage5', err);
  }

  // 리포트 생성
  const report = await generateFinalReport(ctx.allResults, ctx.input);

  // 온톨로지 추출 (비차단 — 실패해도 파이프라인 결과에 영향 없음)
  try {
    const completedResultMap: Record<string, { status: string; result?: unknown }> = {};
    for (const [key, val] of Object.entries(ctx.allResults)) {
      if (val.status === 'completed') {
        completedResultMap[key] = val;
      }
    }
    const { entities: extractedEntities, relations: extractedRelations } =
      extractEntitiesFromResults(completedResultMap);
    if (extractedEntities.length > 0) {
      const stats = await persistOntology(jobId, extractedEntities, extractedRelations);
      await appendJobEvent(
        jobId,
        'info',
        `온톨로지 추출 완료: 엔티티 ${stats.entityCount}개, 관계 ${stats.relationCount}개`,
      );
    }
  } catch (e) {
    console.error('[ontology] 추출 실패:', e);
  }

  // 시리즈에 속한 job이면 델타 분석 실행 (비차단)
  try {
    const [jobRow] = await getDb()
      .select({ seriesId: collectionJobs.seriesId })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (jobRow?.seriesId) {
      await runSeriesDeltaAnalysis(jobRow.seriesId, jobId);
    }
  } catch (e) {
    console.error('[delta] 델타 분석 실패:', e);
  }

  // 알림 규칙 평가 — 사용자 정의 임계값 검사 후 알림 전송 (비차단)
  evaluateAlerts(jobId, ctx.allResults as unknown as Record<string, unknown>).catch((err) =>
    logError('alerts', err),
  );

  const completedModules = Object.values(ctx.allResults)
    .filter((r) => r.status === 'completed')
    .map((r) => r.module);
  const failedModules = Object.values(ctx.allResults)
    .filter((r) => r.status === 'failed')
    .map((r) => r.module);

  return {
    results: ctx.allResults,
    completedModules,
    failedModules,
    report: report!,
    cancelledByUser: ctx.cancelledByUser,
    costLimitExceeded: ctx.costLimitExceeded,
  };
}
