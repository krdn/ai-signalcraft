// 분석 파이프라인 오케스트레이션 — Stage 0~4 전체 관리
import { eq } from 'drizzle-orm';
import { getSkippedModules } from '../pipeline/control';
import { awaitStageGate } from '../pipeline/pipeline-checks';
import { appendJobEvent, updateJobProgress } from '../pipeline/persist';
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
import { loadAnalysisInput } from './data-loader';
import { preprocessAnalysisInput, type OptimizationPreset } from './preprocessing';
import { analyzeItems } from './item-analyzer';
import { getConcurrencyConfig } from './concurrency-config';
import { runWithProviderGrouping } from './concurrency';
import { buildResult, generateFinalReport } from './report-builder';
import { extractEntitiesFromResults } from './ontology-extractor';
import { persistOntology } from './persist-ontology';
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
  let input = await loadAnalysisInput(jobId);
  const loaded = await loadCompletedResults(jobId, options?.retryModules);

  if (Object.keys(loaded.allResults).length > 0) {
    console.log(
      `[pipeline] 체크포인트 복원: ${Object.keys(loaded.allResults).length}개 완료 결과 로드`,
    );
    appendJobEvent(
      jobId,
      'info',
      `체크포인트 복원: ${Object.keys(loaded.allResults).join(', ')} (DB에서 로드)`,
    ).catch(() => {});
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

  // 토큰 최적화 전처리
  const tokenOptimization = (jobRow?.options?.tokenOptimization ?? 'none') as OptimizationPreset;
  if (tokenOptimization !== 'none') {
    try {
      await updateJobProgress(jobId, {
        'token-optimization': { status: 'running', preset: tokenOptimization },
      }).catch(() => {});
      const preprocessed = await preprocessAnalysisInput(input, tokenOptimization, jobId);
      input = preprocessed.input;
      ctx.input = input;
      await updateJobProgress(jobId, {
        'token-optimization': {
          status: 'completed',
          phase: 'preprocessing',
          ...preprocessed.stats,
        },
      }).catch(() => {});
    } catch (error) {
      console.error(`[pipeline] 토큰 최적화 실패:`, error);
      await updateJobProgress(jobId, {
        'token-optimization': { status: 'failed', phase: 'error' },
      }).catch(() => {});
    }
  } else {
    await updateJobProgress(jobId, { 'token-optimization': { status: 'skipped' } }).catch(() => {});
  }

  // BP 게이트: 토큰 최적화 완료 후
  if (!(await awaitStageGate(jobId, 'token-optimization'))) {
    ctx.cancelledByUser = true;
    return buildResult(ctx.allResults, ctx.cancelledByUser, ctx.costLimitExceeded, ctx.input);
  }

  // Stage 0: 개별 항목 분석
  let itemAnalysisPromise: Promise<void> = Promise.resolve();
  if (jobRow?.options?.enableItemAnalysis) {
    itemAnalysisPromise = (async () => {
      try {
        await analyzeItems(jobId);
      } catch (error) {
        console.error(`[runner] 개별 항목 분석 실패:`, error);
        await updateJobProgress(jobId, {
          'item-analysis': { status: 'failed', phase: 'error' },
        }).catch(() => {});
      }
    })();
  } else {
    await updateJobProgress(jobId, { 'item-analysis': { status: 'skipped' } }).catch(() => {});
  }

  // BP 게이트: 개별 감정 분석 완료 후
  // (itemAnalysisPromise는 Stage 1과 병렬로 시작했으므로 게이트 전에 await)
  await itemAnalysisPromise;
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
