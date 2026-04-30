// 분석 파이프라인 오케스트레이션 — Stage 0~5 전체 관리
import { eq } from 'drizzle-orm';
import { getSkippedModules } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { appendJobEvent, updateJobProgress } from '../pipeline/persist';
import { logError } from '../utils/logger';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
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
import { type OptimizationPreset } from './preprocessing';
import {
  persistCollectorFullset,
  recordSamplingStats,
  recordSubscriptionSourceStats,
} from './pipeline-input-prep';
import { runDomainNormalization, runTokenOptimization } from './pipeline-pre-stages';
import { analyzeItems } from './item-analyzer';
import { getConcurrencyConfig } from './concurrency-config';
import { runWithProviderGrouping } from './concurrency';
import { buildResult, generateFinalReport } from './report-builder';
import { persistAnalysisResult } from './persist-analysis';
import { runPostAnalysisStages, runStage5IfEnabled } from './pipeline-post-stages';
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

  const isCollectorPath = Boolean(
    options?.useCollectorLoader || jobOptions.useCollectorLoader || shouldUseCollectorLoader(),
  );

  const loadResult = isCollectorPath
    ? await loadAnalysisInputViaCollector(jobId)
    : await loadAnalysisInput(jobId);
  let input = loadResult.input;
  const samplingStats = loadResult.samplingStats;

  // 구독 단축 경로에서도 article_jobs/comment_jobs/video_jobs를 채워
  // RAG SQL과 UI 카운트가 일반 경로와 동일한 의미를 갖도록 보장.
  if (isCollectorPath) {
    await persistCollectorFullset(jobId, loadResult as CollectorAnalysisResult);
  }

  await recordSamplingStats(jobId, samplingStats);

  if (isCollectorPath) {
    await recordSubscriptionSourceStats(jobId, input);
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
  input = await runDomainNormalization(jobId, input);
  ctx.input = input;

  // 토큰 최적화 전처리 (정규화는 이미 적용됨 — preprocessAnalysisInput 내부에서
  // 한 번 더 호출되지만 멱등하므로 안전. 단 매칭 카운트만 0에 가깝게 나옴)
  const tokenOptimization = (jobRow?.options?.tokenOptimization ?? 'none') as OptimizationPreset;
  input = await runTokenOptimization({
    jobId,
    input,
    tokenOptimization,
    isCollectorPath,
  });
  ctx.input = input;

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
  await runStage5IfEnabled({
    jobId,
    jobOptions,
    domain: ctx.input.domain,
    cancelledByUser: ctx.cancelledByUser,
    costLimitExceeded: ctx.costLimitExceeded,
  });

  // 리포트 생성
  const report = await generateFinalReport(ctx.allResults, ctx.input);

  // 비차단 후처리 — 온톨로지 추출 + 시리즈 델타 분석 + 알림 규칙 평가
  await runPostAnalysisStages(jobId, ctx.allResults);

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
