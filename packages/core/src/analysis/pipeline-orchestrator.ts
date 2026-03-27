// 분석 파이프라인 오케스트레이션 -- Stage 0~4 전체 관리
// runner.ts에서 분리 (D-03: 단일 실행과 오케스트레이션 분리)
import { runModule, STAGE1_MODULES, STAGE2_MODULES, STAGE4_PARALLEL, STAGE4_SEQUENTIAL } from './runner';
import { generateIntegratedReport } from '../report/generator';
import { finalSummaryModule } from './modules';
import { loadAnalysisInput } from './data-loader';
import { persistAnalysisResult } from './persist-analysis';
import { isPipelineCancelled, waitIfPaused, checkCostLimit, getSkippedModules } from '../pipeline/control';
import { analyzeItems } from './item-analyzer';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { eq } from 'drizzle-orm';
import type { AnalysisModule, AnalysisModuleResult, AnalysisInput } from './types';

/** 동시성 제한 병렬 실행 (rate limit 방지) */
async function runWithConcurrency<T>(
  modules: AnalysisModule[],
  fn: (m: AnalysisModule) => Promise<AnalysisModuleResult>,
  concurrency: number = 2,
): Promise<PromiseSettledResult<AnalysisModuleResult>[]> {
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
export async function runAnalysisPipeline(jobId: number): Promise<{
  results: Record<string, AnalysisModuleResult>;
  completedModules: string[];
  failedModules: string[];
  report: { markdownContent: string; oneLiner: string; totalTokens: number };
  cancelledByUser?: boolean;
  costLimitExceeded?: boolean;
}> {
  const input = await loadAnalysisInput(jobId);
  const allResults: Record<string, AnalysisModuleResult> = {};
  let cancelledByUser = false;
  let costLimitExceeded = false;

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

  // 스킵된 모듈은 DB에 기록
  async function markSkipped(moduleName: string) {
    await persistAnalysisResult({
      jobId,
      module: moduleName,
      status: 'failed',
      errorMessage: '사용자에 의해 스킵됨',
    });
    allResults[moduleName] = { module: moduleName, status: 'failed', errorMessage: '사용자에 의해 스킵됨' };
  }

  // Stage 0: 개별 기사/댓글 감정 분석 (옵션 활성화 시만)
  const [jobRow] = await getDb()
    .select({ options: collectionJobs.options })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);

  if (jobRow?.options?.enableItemAnalysis) {
    if (!await preRunCheck()) {
      return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
    }
    try {
      console.log(`[runner] 개별 항목 분석 시작: job=${jobId}`);
      await analyzeItems(jobId);
      console.log(`[runner] 개별 항목 분석 완료: job=${jobId}`);
    } catch (error) {
      console.error(`[runner] 개별 항목 분석 실패 (집계 분석은 계속 진행):`, error);
    }
  }

  // Stage 1: 병렬 실행 (모듈 1~4, 독립)
  if (!await preRunCheck()) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  const stage1Active = STAGE1_MODULES.filter(m => !isSkipped(m.name));
  const stage1Skipped = STAGE1_MODULES.filter(m => isSkipped(m.name));
  for (const m of stage1Skipped) await markSkipped(m.name);

  const stage1Settled = await runWithConcurrency(
    stage1Active,
    (m) => runModule(m, input),
    2,
  );

  const priorResults: Record<string, unknown> = {};
  for (const settled of stage1Settled) {
    if (settled.status === 'fulfilled') {
      allResults[settled.value.module] = settled.value;
      if (settled.value.status === 'completed') {
        priorResults[settled.value.module] = settled.value.result;
      }
    }
  }

  // Stage 2: 순차 실행 (모듈 5~7, Stage 1 결과 의존)
  for (const module of STAGE2_MODULES) {
    if (!await preRunCheck()) break;
    if (isSkipped(module.name)) { await markSkipped(module.name); continue; }

    const result = await runModule(module, input, priorResults);
    allResults[result.module] = result;
    if (result.status === 'completed') {
      priorResults[result.module] = result.result;
    }
  }

  if (cancelledByUser || costLimitExceeded) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  // Stage 3: 최종 요약 (모듈 8, 모든 선행 결과 참조)
  if (!await preRunCheck()) {
    return buildResult(allResults, cancelledByUser, costLimitExceeded, input);
  }

  if (isSkipped(finalSummaryModule.name)) {
    await markSkipped(finalSummaryModule.name);
  } else {
    const finalResult = await runModule(finalSummaryModule, input, priorResults);
    allResults[finalResult.module] = finalResult;
    if (finalResult.status === 'completed') {
      priorResults[finalResult.module] = finalResult.result;
    }
  }

  // 기본 완료/실패 모듈 집계 (Stage 1~3)
  const getCompletedModules = () => Object.values(allResults)
    .filter((r) => r.status === 'completed')
    .map((r) => r.module);
  const getFailedModules = () => Object.values(allResults)
    .filter((r) => r.status === 'failed')
    .map((r) => r.module);

  // D-04: 기본 분석 완료 후 통합 리포트 생성
  let report: { markdownContent: string; oneLiner: string; totalTokens: number };
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
      markdownContent: `# ${input.keyword} 분석 리포트\n\n> 리포트 자동 생성에 실패했습니다. 개별 모듈 분석 결과를 확인하세요.\n\n## 완료된 모듈\n${getCompletedModules().map(m => `- ${m}`).join('\n')}\n\n## 실패한 모듈\n${getFailedModules().map(m => `- ${m}`).join('\n')}`,
      oneLiner: '리포트 생성 실패 -- 개별 모듈 결과 참조',
      totalTokens: 0,
    };
  }

  // Stage 4: 고급 분석 (ADVN 모듈)
  if (await preRunCheck()) {
    const stage4aActive = STAGE4_PARALLEL.filter(m => !isSkipped(m.name));
    const stage4aSkipped = STAGE4_PARALLEL.filter(m => isSkipped(m.name));
    for (const m of stage4aSkipped) await markSkipped(m.name);

    const stage4aSettled = await runWithConcurrency(
      stage4aActive,
      (m) => runModule(m, input, priorResults),
      2,
    );
    for (const settled of stage4aSettled) {
      if (settled.status === 'fulfilled') {
        allResults[settled.value.module] = settled.value;
        if (settled.value.status === 'completed') {
          priorResults[settled.value.module] = settled.value.result;
        }
      }
    }

    // Stage 4b: 순차 실행
    for (const module of STAGE4_SEQUENTIAL) {
      if (!await preRunCheck()) break;
      if (isSkipped(module.name)) { await markSkipped(module.name); continue; }

      const result = await runModule(module, input, priorResults);
      allResults[result.module] = result;
      if (result.status === 'completed') {
        priorResults[result.module] = result.result;
      }
    }

    // Stage 4 완료 후: 고급 분석 결과가 있으면 리포트 재생성
    const advnCompleted = STAGE4_PARALLEL.concat(STAGE4_SEQUENTIAL)
      .some(m => allResults[m.name]?.status === 'completed');

    if (advnCompleted) {
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
        console.error('고급 분석 리포트 재생성 실패 (기존 리포트 유지):', reportError);
      }
    }
  }

  return {
    results: allResults,
    completedModules: getCompletedModules(),
    failedModules: getFailedModules(),
    report,
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
  const completedModules = Object.values(allResults).filter(r => r.status === 'completed').map(r => r.module);
  const failedModules = Object.values(allResults).filter(r => r.status === 'failed').map(r => r.module);

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

  return { results: allResults, completedModules, failedModules, report, cancelledByUser, costLimitExceeded };
}
