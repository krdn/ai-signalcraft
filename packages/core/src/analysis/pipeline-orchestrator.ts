// 분석 파이프라인 오케스트레이션 -- Stage 0~4 전체 관리
// runner.ts에서 분리 (D-03: 단일 실행과 오케스트레이션 분리)
import { eq } from 'drizzle-orm';
import { generateIntegratedReport } from '../report/generator';
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
import { persistAnalysisResult } from './persist-analysis';
import { analyzeItems } from './item-analyzer';
import type { AnalysisModule, AnalysisModuleResult, AnalysisInput } from './types';
import { getModuleModelConfig } from './model-config';
import { getConcurrencyConfig } from './concurrency-config';

/** 재시작 옵션 -- 완료된 모듈은 DB에서 로드하고 실패/미실행 모듈만 재실행 */
export interface ResumeOptions {
  /** 특정 모듈만 재실행 (나머지 completed는 DB에서 로드). 미지정 시: 모든 non-completed 모듈 실행 */
  retryModules?: string[];
  /** 리포트만 재생성 (분석 전부 스킵) */
  reportOnly?: boolean;
}

/**
 * DB에서 이미 완료된 분석 결과를 로드하여 allResults/priorResults를 채움
 * retryModules에 포함된 모듈은 재실행 대상이므로 건너뜀
 */
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
    // 재실행 대상 모듈은 건너뜀
    if (retryModules?.includes(row.module)) continue;
    // completed만 로드 (failed/pending/running은 재실행 대상)
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
 * 모듈 목록의 프로바이더를 조회하여 최소 동시성을 결정
 * 같은 배치에 gemini 모듈이 하나라도 있으면 동시성 1로 제한
 */
async function _resolveConcurrency(
  modules: AnalysisModule[],
  providerConcurrency: Record<string, number>,
): Promise<number> {
  if (modules.length <= 1) return 1;
  const configs = await Promise.all(modules.map((m) => getModuleModelConfig(m.name)));
  const minConcurrency = Math.min(...configs.map((c) => providerConcurrency[c.provider] ?? 2));
  console.log(
    `[pipeline] 동시성 결정: ${modules.map((m) => m.name).join(', ')} → ` +
      `providers=[${configs.map((c) => c.provider).join(', ')}], concurrency=${minConcurrency}`,
  );
  return minConcurrency;
}

/**
 * 프로바이더별로 모듈을 그룹화하여 병렬 실행
 * 다른 프로바이더 그룹은 동시에, 같은 프로바이더 내에서는 동시성 제한 적용
 * 예: OpenAI 2개 + Gemini 2개 → OpenAI 그룹과 Gemini 그룹이 동시 실행
 */
async function runWithProviderGrouping(
  modules: AnalysisModule[],
  fn: (m: AnalysisModule) => Promise<AnalysisModuleResult>,
  providerConcurrency: Record<string, number>,
): Promise<PromiseSettledResult<AnalysisModuleResult>[]> {
  if (modules.length <= 1) {
    return Promise.allSettled(modules.map(fn));
  }

  // 프로바이더별 그룹화
  const configs = await Promise.all(modules.map((m) => getModuleModelConfig(m.name)));
  const groups = new Map<string, AnalysisModule[]>();
  for (let i = 0; i < modules.length; i++) {
    const provider = configs[i].provider;
    if (!groups.has(provider)) groups.set(provider, []);
    groups.get(provider)!.push(modules[i]);
  }

  console.log(
    `[pipeline] 프로바이더 그룹핑: ${[...groups.entries()]
      .map(([p, ms]) => `${p}=[${ms.map((m) => m.name).join(', ')}]`)
      .join(', ')}`,
  );

  // 각 프로바이더 그룹을 해당 프로바이더의 동시성으로 실행, 그룹 간 동시 실행
  const groupPromises = [...groups.entries()].map(async ([provider, groupModules]) => {
    const concurrency = providerConcurrency[provider] ?? 2;
    return runWithConcurrency(groupModules, fn, concurrency);
  });

  const groupResults = await Promise.allSettled(groupPromises);

  // 결과 평탄화
  const allResults: PromiseSettledResult<AnalysisModuleResult>[] = [];
  for (const gr of groupResults) {
    if (gr.status === 'fulfilled') {
      allResults.push(...gr.value);
    }
  }
  return allResults;
}

/** 동시성 제한 병렬 실행 (rate limit 방지) */
async function runWithConcurrency(
  modules: AnalysisModule[],
  fn: (m: AnalysisModule) => Promise<AnalysisModuleResult>,
  concurrency: number = 2,
): Promise<PromiseSettledResult<AnalysisModuleResult>[]> {
  if (concurrency <= 1) {
    // 순차 실행 (gemini 무료 등)
    const results: PromiseSettledResult<AnalysisModuleResult>[] = [];
    for (const m of modules) {
      const r = await Promise.allSettled([fn(m)]);
      results.push(...r);
    }
    return results;
  }
  const results: PromiseSettledResult<AnalysisModuleResult>[] = [];
  for (let i = 0; i < modules.length; i += concurrency) {
    const batch = modules.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * 전체 분석 파이프라인 실행 (D-10: 3단계)
 * Stage 1: 병렬 (모듈 1~4, 독립)
 * Stage 2: 순차 (모듈 5~7, Stage 1 결과 의존)
 * Stage 3: 최종 요약 (모듈 8, 모든 선행 결과 참조)
 *
 * 부분 실패 시에도 가용한 결과로 계속 진행
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
  const input = await loadAnalysisInput(jobId);

  // 체크포인트 복원: DB에서 이미 완료된 모듈 결과를 로드
  const loaded = await loadCompletedResults(jobId, options?.retryModules);
  const allResults: Record<string, AnalysisModuleResult> = loaded.allResults;
  const priorResults: Record<string, unknown> = loaded.priorResults;

  if (Object.keys(loaded.allResults).length > 0) {
    console.log(
      `[pipeline] 체크포인트 복원: ${Object.keys(loaded.allResults).length}개 완료 결과 로드 — ${Object.keys(loaded.allResults).join(', ')}`,
    );
    appendJobEvent(
      jobId,
      'info',
      `체크포인트 복원: ${Object.keys(loaded.allResults).join(', ')} (DB에서 로드)`,
    ).catch(() => {});
  }

  let cancelledByUser = false;
  let costLimitExceeded = false;

  // reportOnly 모드: 분석 스킵, 리포트만 재생성
  if (options?.reportOnly) {
    console.log(`[pipeline] reportOnly 모드: 리포트만 재생성`);
    const completedModules = Object.values(allResults)
      .filter((r) => r.status === 'completed')
      .map((r) => r.module);
    if (completedModules.length === 0) {
      throw new Error('완료된 분석 결과가 없어 리포트를 생성할 수 없습니다');
    }
    const failedModules = Object.values(allResults)
      .filter((r) => r.status === 'failed')
      .map((r) => r.module);
    const report = await generateIntegratedReport({
      jobId: input.jobId,
      keyword: input.keyword,
      dateRange: input.dateRange,
      results: allResults,
      completedModules,
      failedModules,
    });
    return { results: allResults, completedModules, failedModules, report };
  }

  // 병렬처리 설정 로드 (파이프라인 시작 시 1회)
  const concurrencyConfig = await getConcurrencyConfig();
  const providerConcurrency = concurrencyConfig.providerConcurrency;

  // 스킵 모듈 목록 로드
  const skippedModules = await getSkippedModules(jobId);

  // 모듈 실행 전 공통 체크 (취소/일시정지/비용한도)
  async function preRunCheck(): Promise<boolean> {
    // 취소 확인
    if (await isPipelineCancelled(jobId)) {
      cancelledByUser = true;
      return false;
    }
    // 일시정지 대기
    const resumed = await waitIfPaused(jobId);
    if (!resumed) {
      cancelledByUser = true;
      return false;
    }
    // 비용 한도 확인
    const costCheck = await checkCostLimit(jobId);
    if (costCheck.exceeded) {
      costLimitExceeded = true;
      console.log(`[cost-limit] 비용 한도 초과: $${costCheck.currentCost} / $${costCheck.limit}`);
      return false;
    }
    return true;
  }

  // 모듈 스킵 여부 확인
  function isSkipped(moduleName: string): boolean {
    return skippedModules.includes(moduleName);
  }

  // 이미 DB에서 로드된 완료 모듈 여부 확인 (체크포인트 복원)
  function isAlreadyCompleted(moduleName: string): boolean {
    return allResults[moduleName]?.status === 'completed';
  }

  // 실패 모듈 발생 시 파이프라인 즉시 중단 (fail-fast)
  function checkFailAndAbort(stageName: string): boolean {
    const failed = Object.values(allResults).filter(
      (r) => r.status === 'failed' && r.errorMessage !== '사용자에 의해 스킵됨',
    );
    if (failed.length > 0) {
      const failedNames = failed.map((f) => f.module).join(', ');
      console.log(`[pipeline] ${stageName} 실패 감지 — 파이프라인 중단: ${failedNames}`);
      appendJobEvent(
        input.jobId,
        'error',
        `${stageName}에서 실패 발생 (${failedNames}), 파이프라인 중단`,
      ).catch(() => {});
      return true;
    }
    return false;
  }

  // 스킵된 모듈은 DB에 기록
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

  // Stage 0: 개별 기사/댓글 감정 분석 (옵션 활성화 시만)
  const [jobRow] = await getDb()
    .select({ options: collectionJobs.options })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (jobRow?.options?.enableItemAnalysis) {
    if (!(await preRunCheck())) {
      return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
    }
    try {
      console.log(`[runner] 개별 항목 분석 시작: job=${jobId}`);
      await analyzeItems(jobId);
      console.log(`[runner] 개별 항목 분석 완료: job=${jobId}`);
    } catch (error) {
      console.error(`[runner] 개별 항목 분석 실패 (집계 분석은 계속 진행):`, error);
      await updateJobProgress(jobId, {
        'item-analysis': { status: 'failed', phase: 'error' },
      }).catch(() => {});
    }
  } else {
    // 옵션 비활성 → skipped 상태 기록 (UI에서 skipped 표시)
    await updateJobProgress(jobId, {
      'item-analysis': { status: 'skipped' },
    }).catch(() => {});
  }

  // Stage 1: 병렬 실행 (모듈 1~4, 독립)
  console.log(
    `[pipeline] Stage 1 시작: 기본 분석 (${STAGE1_MODULES.map((m) => m.name).join(', ')})`,
  );
  if (!(await preRunCheck())) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  const stage1Active = STAGE1_MODULES.filter(
    (m) => !isSkipped(m.name) && !isAlreadyCompleted(m.name),
  );
  const stage1Skipped = STAGE1_MODULES.filter((m) => isSkipped(m.name));
  const stage1Loaded = STAGE1_MODULES.filter((m) => isAlreadyCompleted(m.name));
  for (const m of stage1Skipped) await markSkipped(m.name);
  if (stage1Loaded.length > 0) {
    console.log(
      `[pipeline] Stage 1: ${stage1Loaded.map((m) => m.name).join(', ')} — DB에서 로드 (스킵)`,
    );
  }

  // Stage 1 모듈은 서로 독립 → Map-Reduce + 프로바이더별 병렬 실행
  const stage1Results = await runWithProviderGrouping(
    stage1Active,
    (m) => runModuleMapReduce(m, input),
    providerConcurrency,
  );
  for (const settled of stage1Results) {
    if (settled.status === 'fulfilled') {
      const result = settled.value;
      allResults[result.module] = result;
      if (result.status === 'completed') {
        priorResults[result.module] = result.result;
      }
    }
  }

  console.log(`[pipeline] Stage 1 완료: ${Object.keys(allResults).length}개 모듈 처리`);

  // Stage 1 실패 시 즉시 중단
  if (checkFailAndAbort('Stage 1')) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 2: risk-map + opportunity 병렬, strategy 순차 (의존성 기반)
  // - opportunityModule: Stage 1 결과만 참조 (risk-map 불필요)
  // - strategyModule: Stage 1 + risk-map + opportunity 전부 필요
  // → risk-map과 opportunity를 병렬 실행 후 strategy 순차 실행
  console.log(`[pipeline] Stage 2 시작: 심층 분석 (risk-map, opportunity, strategy)`);
  if (await preRunCheck()) {
    const [riskMapMod, opportunityMod, strategyMod] = STAGE2_MODULES;

    // risk-map + opportunity 병렬 실행 (서로 독립, Stage 1 결과만 참조)
    const stage2Parallel = [riskMapMod, opportunityMod].filter(
      (m) => !isSkipped(m.name) && !isAlreadyCompleted(m.name),
    );
    const stage2Skipped = [riskMapMod, opportunityMod].filter((m) => isSkipped(m.name));
    const stage2Loaded = [riskMapMod, opportunityMod].filter((m) => isAlreadyCompleted(m.name));
    if (stage2Loaded.length > 0) {
      console.log(
        `[pipeline] Stage 2: ${stage2Loaded.map((m) => m.name).join(', ')} — DB에서 로드 (스킵)`,
      );
    }
    for (const m of stage2Skipped) await markSkipped(m.name);

    const stage2Results = await runWithProviderGrouping(
      stage2Parallel,
      (m) => runModule(m, input, priorResults),
      providerConcurrency,
    );
    for (const settled of stage2Results) {
      if (settled.status === 'fulfilled') {
        const result = settled.value;
        allResults[result.module] = result;
        if (result.status === 'completed') {
          priorResults[result.module] = result.result;
        }
      }
    }

    // strategy 순차 실행 (risk-map + opportunity 결과 필요)
    if (strategyMod && (await preRunCheck())) {
      if (isSkipped(strategyMod.name)) {
        await markSkipped(strategyMod.name);
      } else if (isAlreadyCompleted(strategyMod.name)) {
        console.log(`[pipeline] Stage 2: ${strategyMod.name} — DB에서 로드 (스킵)`);
      } else {
        const result = await runModule(strategyMod, input, priorResults);
        allResults[result.module] = result;
        if (result.status === 'completed') {
          priorResults[result.module] = result.result;
        }
      }
    }
  }

  if (cancelledByUser || costLimitExceeded) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 2 실패 시 즉시 중단
  if (checkFailAndAbort('Stage 2')) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 3: 최종 요약 (모듈 8, 모든 선행 결과 참조)
  console.log(`[pipeline] Stage 3 시작: 최종 요약`);
  if (!(await preRunCheck())) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  if (isSkipped(finalSummaryModule.name)) {
    await markSkipped(finalSummaryModule.name);
  } else if (isAlreadyCompleted(finalSummaryModule.name)) {
    console.log(`[pipeline] Stage 3: ${finalSummaryModule.name} — DB에서 로드 (스킵)`);
  } else {
    const finalResult = await runModule(finalSummaryModule, input, priorResults);
    allResults[finalResult.module] = finalResult;
    if (finalResult.status === 'completed') {
      priorResults[finalResult.module] = finalResult.result;
    }
  }

  // Stage 3 실패 시 즉시 중단
  if (checkFailAndAbort('Stage 3')) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // 기본 완료/실패 모듈 집계 (Stage 1~3)
  const getCompletedModules = () =>
    Object.values(allResults)
      .filter((r) => r.status === 'completed')
      .map((r) => r.module);
  const getFailedModules = () =>
    Object.values(allResults)
      .filter((r) => r.status === 'failed')
      .map((r) => r.module);

  // 리포트는 모든 분석(Stage 4 포함) 완료 후 한 번만 생성
  let report: { markdownContent: string; oneLiner: string; totalTokens: number } | undefined;

  // Stage 4: 고급 분석 (ADVN 모듈)
  console.log(
    `[pipeline] Stage 4 시작: 고급 분석 (${STAGE4_PARALLEL.concat(STAGE4_SEQUENTIAL)
      .map((m) => m.name)
      .join(', ')})`,
  );
  if (await preRunCheck()) {
    const stage4aActive = STAGE4_PARALLEL.filter(
      (m) => !isSkipped(m.name) && !isAlreadyCompleted(m.name),
    );
    const stage4aSkipped = STAGE4_PARALLEL.filter((m) => isSkipped(m.name));
    const stage4aLoaded = STAGE4_PARALLEL.filter((m) => isAlreadyCompleted(m.name));
    if (stage4aLoaded.length > 0) {
      console.log(
        `[pipeline] Stage 4a: ${stage4aLoaded.map((m) => m.name).join(', ')} — DB에서 로드 (스킵)`,
      );
    }
    for (const m of stage4aSkipped) await markSkipped(m.name);

    // approval-rating + frame-war 병렬 실행 (서로 독립)
    const stage4aResults = await runWithProviderGrouping(
      stage4aActive,
      (m) => runModule(m, input, priorResults),
      providerConcurrency,
    );
    for (const settled of stage4aResults) {
      if (settled.status === 'fulfilled') {
        const result = settled.value;
        allResults[result.module] = result;
        if (result.status === 'completed') {
          priorResults[result.module] = result.result;
        }
      }
    }

    // Stage 4a 실패 시 즉시 중단
    if (checkFailAndAbort('Stage 4a')) {
      return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
    }

    // Stage 4b: 순차 실행
    for (const module of STAGE4_SEQUENTIAL) {
      if (!(await preRunCheck())) break;
      if (isSkipped(module.name)) {
        await markSkipped(module.name);
        continue;
      }
      if (isAlreadyCompleted(module.name)) {
        console.log(`[pipeline] Stage 4b: ${module.name} — DB에서 로드 (스킵)`);
        continue;
      }

      const result = await runModule(module, input, priorResults);
      allResults[result.module] = result;
      if (result.status === 'completed') {
        priorResults[result.module] = result.result;
      }
      // Stage 4b 개별 모듈 실패 시 즉시 중단
      if (checkFailAndAbort('Stage 4b')) {
        return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
      }
    }
  }

  // 모든 분석 완료 후 통합 리포트 1회 생성
  console.log(
    `[pipeline] 리포트 생성 시작: 완료 ${getCompletedModules().length}개, 실패 ${getFailedModules().length}개 모듈`,
  );
  try {
    report = await generateIntegratedReport({
      jobId: input.jobId,
      keyword: input.keyword,
      dateRange: input.dateRange,
      results: allResults,
      completedModules: getCompletedModules(),
      failedModules: getFailedModules(),
    });
  } catch (reportError) {
    console.error('리포트 생성 실패 (부분 결과로 계속 진행):', reportError);
    report = {
      markdownContent: `# ${input.keyword} 분석 리포트\n\n> 리포트 자동 생성에 실패했습니다. 개별 모듈 분석 결과를 확인하세요.\n\n## 완료된 모듈\n${getCompletedModules()
        .map((m) => `- ${m}`)
        .join('\n')}\n\n## 실패한 모듈\n${getFailedModules()
        .map((m) => `- ${m}`)
        .join('\n')}`,
      oneLiner: '리포트 생성 실패 -- 개별 모듈 결과 참조',
      totalTokens: 0,
    };
  }

  return {
    results: allResults,
    completedModules: getCompletedModules(),
    failedModules: getFailedModules(),
    report: report!,
    cancelledByUser,
    costLimitExceeded,
  };
}

/** 조기 종료 시 결과 빌드 헬퍼 */
async function buildResult(
  allResults: Record<string, AnalysisModuleResult>,
  cancelledByUser: boolean,
  costLimitExceeded: boolean,
  input: AnalysisInput,
) {
  const completedModules = Object.values(allResults)
    .filter((r) => r.status === 'completed')
    .map((r) => r.module);
  const failedModules = Object.values(allResults)
    .filter((r) => r.status === 'failed')
    .map((r) => r.module);

  const reason = cancelledByUser ? '사용자에 의해 중지됨' : '비용 한도 초과로 중지됨';
  let report: { markdownContent: string; oneLiner: string; totalTokens: number };

  if (completedModules.length > 0) {
    try {
      report = await generateIntegratedReport({
        jobId: input.jobId,
        keyword: input.keyword,
        dateRange: input.dateRange,
        results: allResults,
        completedModules,
        failedModules,
      });
    } catch {
      report = {
        markdownContent: `# ${input.keyword} 분석 리포트 (부분)\n\n> ${reason}\n\n완료된 모듈: ${completedModules.join(', ') || '없음'}`,
        oneLiner: reason,
        totalTokens: 0,
      };
    }
  } else {
    report = {
      markdownContent: `# ${input.keyword} 분석 리포트\n\n> ${reason}\n\n완료된 모듈이 없습니다.`,
      oneLiner: reason,
      totalTokens: 0,
    };
  }

  return {
    results: allResults,
    completedModules,
    failedModules,
    report,
    cancelledByUser,
    costLimitExceeded,
  };
}
