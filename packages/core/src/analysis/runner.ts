// 분석 실행 러너 -- 3단계 병렬/순차 오케스트레이션 (D-10)
import { analyzeStructured } from '@ai-signalcraft/ai-gateway';
import { generateIntegratedReport } from '../report/generator';
import {
  macroViewModule,
  segmentationModule,
  sentimentFramingModule,
  messageImpactModule,
  riskMapModule,
  opportunityModule,
  strategyModule,
  finalSummaryModule,
  approvalRatingModule,
  frameWarModule,
  crisisScenarioModule,
  winSimulationModule,
} from './modules';
import { loadAnalysisInput } from './data-loader';
import { persistAnalysisResult } from './persist-analysis';
import type { AnalysisModule, AnalysisInput, AnalysisModuleResult } from './types';

// Stage 1: 병렬 실행 (독립 모듈)
export const STAGE1_MODULES: AnalysisModule[] = [
  macroViewModule,
  segmentationModule,
  sentimentFramingModule,
  messageImpactModule,
];

// Stage 2: 순차 실행 (Stage 1 결과 의존)
export const STAGE2_MODULES: AnalysisModule[] = [riskMapModule, opportunityModule, strategyModule];

// Stage 4: 고급 분석 (ADVN 모듈)
// ADVN-01(approval-rating), ADVN-02(frame-war): 병렬 (독립)
// ADVN-03(crisis-scenario): ADVN-01 + risk-map 의존
// ADVN-04(win-simulation): ADVN-01~03 전체 의존
export const STAGE4_PARALLEL: AnalysisModule[] = [approvalRatingModule, frameWarModule];
export const STAGE4_SEQUENTIAL: AnalysisModule[] = [crisisScenarioModule, winSimulationModule];

/**
 * 단일 분석 모듈 실행 (AI Gateway 호출 + DB 저장)
 * 부분 실패 허용 -- 실패 시에도 에러를 throw하지 않고 failed 상태 반환
 */
export async function runModule<T>(
  module: AnalysisModule<T>,
  input: AnalysisInput,
  priorResults?: Record<string, unknown>,
): Promise<AnalysisModuleResult<T>> {
  try {
    const prompt =
      priorResults && module.buildPromptWithContext
        ? module.buildPromptWithContext(input, priorResults)
        : module.buildPrompt(input);

    const result = await analyzeStructured(prompt, module.schema, {
      provider: module.provider,
      model: module.model,
      systemPrompt: module.buildSystemPrompt(),
      maxOutputTokens: 8192,
    });

    const moduleResult: AnalysisModuleResult<T> = {
      module: module.name,
      status: 'completed',
      result: result.object,
      usage: {
        // AI SDK usage 필드 -- promptTokens/completionTokens 형식
        inputTokens:
          (result.usage as any)?.promptTokens ??
          (result.usage as any)?.inputTokens ??
          0,
        outputTokens:
          (result.usage as any)?.completionTokens ??
          (result.usage as any)?.outputTokens ??
          0,
        totalTokens: (result.usage as any)?.totalTokens ?? 0,
        provider: module.provider,
        model: module.model,
      },
    };

    // DB에 결과 저장
    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'completed',
      result: moduleResult.result,
      usage: moduleResult.usage,
    });

    return moduleResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 실패도 DB에 기록
    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'failed',
      errorMessage,
    });

    return { module: module.name, status: 'failed', errorMessage };
  }
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
}> {
  const input = await loadAnalysisInput(jobId);
  const allResults: Record<string, AnalysisModuleResult> = {};

  // Stage 1: 병렬 실행 (모듈 1~4, 독립)
  const stage1Settled = await Promise.allSettled(
    STAGE1_MODULES.map((m) => runModule(m, input)),
  );

  // Stage 1 결과 수집
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
    const result = await runModule(module, input, priorResults);
    allResults[result.module] = result;
    if (result.status === 'completed') {
      priorResults[result.module] = result.result;
    }
  }

  // Stage 3: 최종 요약 (모듈 8, 모든 선행 결과 참조)
  const finalResult = await runModule(finalSummaryModule, input, priorResults);
  allResults[finalResult.module] = finalResult;
  if (finalResult.status === 'completed') {
    priorResults[finalResult.module] = finalResult.result;
  }

  // 기본 완료/실패 모듈 집계 (Stage 1~3)
  const getCompletedModules = () => Object.values(allResults)
    .filter((r) => r.status === 'completed')
    .map((r) => r.module);
  const getFailedModules = () => Object.values(allResults)
    .filter((r) => r.status === 'failed')
    .map((r) => r.module);

  // D-04: 기본 분석 완료 후 통합 리포트 생성
  let report = await generateIntegratedReport({
    jobId: input.jobId,
    keyword: input.keyword,
    dateRange: input.dateRange,
    results: allResults,
    completedModules: getCompletedModules(),
    failedModules: getFailedModules(),
  });

  // Stage 4: 고급 분석 (ADVN 모듈) -- 실패해도 기존 리포트에 영향 없음
  // Stage 4a: ADVN-01(approval-rating), ADVN-02(frame-war) 병렬 실행
  const stage4aSettled = await Promise.allSettled(
    STAGE4_PARALLEL.map((m) => runModule(m, input, priorResults)),
  );
  for (const settled of stage4aSettled) {
    if (settled.status === 'fulfilled') {
      allResults[settled.value.module] = settled.value;
      if (settled.value.status === 'completed') {
        priorResults[settled.value.module] = settled.value.result;
      }
    }
  }

  // Stage 4b: ADVN-03(crisis-scenario), ADVN-04(win-simulation) 순차 실행
  for (const module of STAGE4_SEQUENTIAL) {
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
    report = await generateIntegratedReport({
      jobId: input.jobId,
      keyword: input.keyword,
      dateRange: input.dateRange,
      results: allResults,
      completedModules: getCompletedModules(),
      failedModules: getFailedModules(),
    });
  }

  return {
    results: allResults,
    completedModules: getCompletedModules(),
    failedModules: getFailedModules(),
    report,
  };
}
