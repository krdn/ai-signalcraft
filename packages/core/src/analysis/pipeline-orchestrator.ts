// 분석 파이프라인 오케스트레이션 -- Stage 0~4 전체 관리
import { eq } from 'drizzle-orm';
import {
  isPipelineCancelled,
  waitIfPaused,
  checkCostLimit,
  getSkippedModules,
} from '../pipeline/control';
import { appendJobEvent, updateJobProgress } from '../pipeline/persist';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults as analysisResultsTable } from '../db/schema/analysis';
import {
  runModule,
  STAGE1_MODULES,
  STAGE2_MODULES,
  STAGE4_PARALLEL,
  STAGE4_SEQUENTIAL,
} from './runner';
import { runModuleMapReduce } from './map-reduce';
import { finalSummaryModule } from './modules';
import { loadAnalysisInput } from './data-loader';
import { preprocessAnalysisInput, type OptimizationPreset } from './preprocessing';
import { persistAnalysisResult } from './persist-analysis';
import { analyzeItems } from './item-analyzer';
import type { AnalysisModuleResult } from './types';
import { getConcurrencyConfig } from './concurrency-config';
import { runWithProviderGrouping } from './concurrency';
import { buildResult, generateFinalReport } from './report-builder';

/** 재시작 옵션 */
export interface ResumeOptions {
  retryModules?: string[];
  reportOnly?: boolean;
}

/** DB에서 이미 완료된 분석 결과를 로드 (체크포인트 복원) */
async function loadCompletedResults(
  jobId: number,
  retryModules?: string[],
): Promise<{
  allResults: Record<string, AnalysisModuleResult>;
  priorResults: Record<string, unknown>;
}> {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisResultsTable)
    .where(eq(analysisResultsTable.jobId, jobId));

  const allResults: Record<string, AnalysisModuleResult> = {};
  const priorResults: Record<string, unknown> = {};

  for (const row of rows) {
    if (retryModules?.includes(row.module)) continue;
    if (row.status !== 'completed') continue;

    allResults[row.module] = {
      module: row.module,
      status: 'completed',
      result: row.result as any,
      usage: row.usage as any,
    };
    priorResults[row.module] = row.result;
  }

  return { allResults, priorResults };
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
  const allResults: Record<string, AnalysisModuleResult> = loaded.allResults;
  const priorResults: Record<string, unknown> = loaded.priorResults;

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

  let cancelledByUser = false;
  let costLimitExceeded = false;

  // reportOnly 모드
  if (options?.reportOnly) {
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
    });
    await updateJobProgress(input.jobId, { report: { status: 'completed' } });
    return { results: allResults, completedModules, failedModules, report };
  }

  const concurrencyConfig = await getConcurrencyConfig();
  const providerConcurrency = concurrencyConfig.providerConcurrency;
  const skippedModules = await getSkippedModules(jobId);

  // 공통 체크 (취소/일시정지/비용한도)
  async function preRunCheck(): Promise<boolean> {
    if (await isPipelineCancelled(jobId)) {
      cancelledByUser = true;
      return false;
    }
    const resumed = await waitIfPaused(jobId);
    if (!resumed) {
      cancelledByUser = true;
      return false;
    }
    const costCheck = await checkCostLimit(jobId);
    if (costCheck.exceeded) {
      costLimitExceeded = true;
      console.log(`[cost-limit] 비용 한도 초과: $${costCheck.currentCost} / $${costCheck.limit}`);
      return false;
    }
    return true;
  }

  function isSkipped(moduleName: string): boolean {
    return skippedModules.includes(moduleName);
  }

  function isAlreadyCompleted(moduleName: string): boolean {
    return allResults[moduleName]?.status === 'completed';
  }

  /** 실패 감지 — 전체 실패 시에만 중단, 부분 실패는 경고 후 계속 */
  function checkFailAndAbort(stageName: string): boolean {
    const stageModules = Object.values(allResults);
    const failed = stageModules.filter(
      (r) => r.status === 'failed' && r.errorMessage !== '사용자에 의해 스킵됨',
    );
    if (failed.length === 0) return false;

    const completed = stageModules.filter((r) => r.status === 'completed');
    const failedNames = failed.map((f) => f.module).join(', ');

    // 성공한 모듈이 1개라도 있으면 계속 진행 (부분 실패 허용)
    if (completed.length > 0) {
      console.warn(
        `[pipeline] ${stageName} 부분 실패 — 실패: ${failedNames}, 성공 ${completed.length}개로 계속 진행`,
      );
      appendJobEvent(
        input.jobId,
        'warn',
        `${stageName}에서 부분 실패 (${failedNames}), 성공한 결과로 계속 진행`,
      ).catch(() => {});
      return false;
    }

    // 전부 실패 시에만 중단
    console.error(`[pipeline] ${stageName} 전체 실패 — 파이프라인 중단: ${failedNames}`);
    for (const f of failed) {
      console.error(`[pipeline] 실패 상세 — ${f.module}: ${f.errorMessage ?? '원인 불명'}`);
    }
    appendJobEvent(
      input.jobId,
      'error',
      `${stageName}에서 전체 실패 (${failedNames}), 파이프라인 중단`,
    ).catch(() => {});
    return true;
  }

  async function markSkipped(moduleName: string) {
    await persistAnalysisResult({
      jobId,
      module: moduleName,
      status: 'failed',
      errorMessage: '사용자에 의해 스킵됨',
    });
    allResults[moduleName] = {
      module: moduleName,
      status: 'failed',
      errorMessage: '사용자에 의해 스킵됨',
    };
  }

  function collectResults(settled: PromiseSettledResult<AnalysisModuleResult>[]) {
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        allResults[s.value.module] = s.value;
        if (s.value.status === 'completed') {
          priorResults[s.value.module] = s.value.result;
        }
      }
    }
  }

  // jobRow 조회 (옵션 확인용)
  const [jobRow] = await getDb()
    .select({ options: collectionJobs.options })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  // 토큰 최적화 전처리
  const tokenOptimization = (jobRow?.options?.tokenOptimization ?? 'none') as OptimizationPreset;
  if (tokenOptimization !== 'none') {
    try {
      await updateJobProgress(jobId, {
        'token-optimization': { status: 'running', preset: tokenOptimization },
      }).catch(() => {});
      const preprocessed = await preprocessAnalysisInput(input, tokenOptimization, jobId);
      input = preprocessed.input;
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

  // Stage 1: 병렬 실행
  if (!(await preRunCheck())) {
    await itemAnalysisPromise;
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  const stage1Active = STAGE1_MODULES.filter(
    (m) => !isSkipped(m.name) && !isAlreadyCompleted(m.name),
  );
  for (const m of STAGE1_MODULES.filter((m) => isSkipped(m.name))) await markSkipped(m.name);

  const [, stage1Results] = await Promise.all([
    itemAnalysisPromise,
    runWithProviderGrouping(stage1Active, (m) => runModuleMapReduce(m, input), providerConcurrency),
  ]);
  collectResults(stage1Results);

  if (checkFailAndAbort('Stage 1')) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 2: risk-map + opportunity 병렬, strategy 순차
  if (await preRunCheck()) {
    const [riskMapMod, opportunityMod, strategyMod] = STAGE2_MODULES;

    const stage2Parallel = [riskMapMod, opportunityMod].filter(
      (m) => !isSkipped(m.name) && !isAlreadyCompleted(m.name),
    );
    for (const m of [riskMapMod, opportunityMod].filter((m) => isSkipped(m.name)))
      await markSkipped(m.name);

    const stage2Results = await runWithProviderGrouping(
      stage2Parallel,
      (m) => runModule(m, input, priorResults),
      providerConcurrency,
    );
    collectResults(stage2Results);

    if (strategyMod && (await preRunCheck())) {
      if (isSkipped(strategyMod.name)) {
        await markSkipped(strategyMod.name);
      } else if (!isAlreadyCompleted(strategyMod.name)) {
        const result = await runModule(strategyMod, input, priorResults);
        allResults[result.module] = result;
        if (result.status === 'completed') priorResults[result.module] = result.result;
      }
    }
  }

  if (cancelledByUser || costLimitExceeded) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }
  if (checkFailAndAbort('Stage 2')) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 3: 최종 요약
  if (!(await preRunCheck())) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }
  if (isSkipped(finalSummaryModule.name)) {
    await markSkipped(finalSummaryModule.name);
  } else if (!isAlreadyCompleted(finalSummaryModule.name)) {
    const finalResult = await runModule(finalSummaryModule, input, priorResults);
    allResults[finalResult.module] = finalResult;
    if (finalResult.status === 'completed') priorResults[finalResult.module] = finalResult.result;
  }

  if (checkFailAndAbort('Stage 3')) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 4: 고급 분석
  if (await preRunCheck()) {
    const stage4aActive = STAGE4_PARALLEL.filter(
      (m) => !isSkipped(m.name) && !isAlreadyCompleted(m.name),
    );
    for (const m of STAGE4_PARALLEL.filter((m) => isSkipped(m.name))) await markSkipped(m.name);

    collectResults(
      await runWithProviderGrouping(
        stage4aActive,
        (m) => runModule(m, input, priorResults),
        providerConcurrency,
      ),
    );

    if (checkFailAndAbort('Stage 4a')) {
      return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
    }

    for (const module of STAGE4_SEQUENTIAL) {
      if (!(await preRunCheck())) break;
      if (isSkipped(module.name)) {
        await markSkipped(module.name);
        continue;
      }
      if (isAlreadyCompleted(module.name)) continue;

      const result = await runModule(module, input, priorResults);
      allResults[result.module] = result;
      if (result.status === 'completed') priorResults[result.module] = result.result;
      if (checkFailAndAbort('Stage 4b')) {
        return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
      }
    }
  }

  // 리포트 생성
  const report = await generateFinalReport(allResults, input);
  const completedModules = Object.values(allResults)
    .filter((r) => r.status === 'completed')
    .map((r) => r.module);
  const failedModules = Object.values(allResults)
    .filter((r) => r.status === 'failed')
    .map((r) => r.module);

  return {
    results: allResults,
    completedModules,
    failedModules,
    report: report!,
    cancelledByUser,
    costLimitExceeded,
  };
}
