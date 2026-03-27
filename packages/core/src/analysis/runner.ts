// 분석 모듈 단일 실행 러너 + Stage 상수 정의
// 오케스트레이션 로직은 pipeline-orchestrator.ts로 분리 (D-03)
import { analyzeStructured, type AIGatewayOptions } from '@ai-signalcraft/ai-gateway';
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

/** Rate limit 에러 감지 */
function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('Rate limit') || msg.includes('429') || msg.includes('TPM') || msg.includes('RPM');
}

/** Rate limit 에러에서 대기 시간 추출 (초) */
function parseRetryAfter(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/try again in ([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) : 0;
}

/** 지정 시간(ms) 대기 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 5;

/**
 * 단일 분석 모듈 실행 (AI Gateway 호출 + DB 저장)
 * 부분 실패 허용 -- 실패 시에도 에러를 throw하지 않고 failed 상태 반환
 * Rate limit 발생 시 exponential backoff로 재시도
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

    const gatewayOptions: AIGatewayOptions = {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      systemPrompt: module.buildSystemPrompt(),
      maxOutputTokens: 8192,
    };

    // Rate limit 재시도 루프
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      try {
        const result = await analyzeStructured(prompt, module.schema, gatewayOptions);

        const moduleResult: AnalysisModuleResult<T> = {
          module: module.name,
          status: 'completed',
          result: result.object,
          usage: {
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

        await persistAnalysisResult({
          jobId: input.jobId,
          module: module.name,
          status: 'completed',
          result: moduleResult.result,
          usage: moduleResult.usage,
        });

        return moduleResult;
      } catch (error) {
        lastError = error;
        if (isRateLimitError(error) && attempt < MAX_RATE_LIMIT_RETRIES) {
          const retryAfterSec = parseRetryAfter(error);
          const backoffMs = Math.max(retryAfterSec * 1000, (attempt + 1) * 3000);
          console.log(`[runner] ${module.name}: rate limit 도달, ${backoffMs}ms 후 재시도 (${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`);
          await sleep(backoffMs);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
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
