// 분석 모듈 단일 실행 러너 + Stage 상수 정의
// 오케스트레이션 로직은 pipeline-orchestrator.ts로 분리 (D-03)
import { analyzeStructured } from '@ai-signalcraft/ai-gateway';
import {
  macroViewModule,
  segmentationModule,
  sentimentFramingModule,
  messageImpactModule,
  riskMapModule,
  opportunityModule,
  strategyModule,
  approvalRatingModule,
  frameWarModule,
  crisisScenarioModule,
  winSimulationModule,
} from './modules';
import { persistAnalysisResult } from './persist-analysis';
import { getModuleModelConfig } from './model-config';
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
    // DB 설정 우선, 없으면 모듈 기본값 폴백
    const config = await getModuleModelConfig(module.name);
    console.log(`[runner] ${module.name}: provider=${config.provider}, model=${config.model}, baseUrl=${config.baseUrl ?? 'NONE'}, hasApiKey=${!!config.apiKey}`);

    const prompt =
      priorResults && module.buildPromptWithContext
        ? module.buildPromptWithContext(input, priorResults)
        : module.buildPrompt(input);

    const result = await analyzeStructured(prompt, module.schema, {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
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
        provider: config.provider,
        model: config.model,
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

// 오케스트레이션 함수 re-export -- 기존 import 경로 호환성 유지
export { runAnalysisPipeline } from './pipeline-orchestrator';
