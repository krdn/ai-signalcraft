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
import { isRateLimitError, isParseError, parseRetryAfter, sleep, MAX_RATE_LIMIT_RETRIES, MAX_PARSE_RETRIES } from './retry-utils';
import { isPipelineCancelled } from '../pipeline/control';
import { appendJobEvent } from '../pipeline/persist';
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

// Rate limit 유���리티는 retry-utils.ts에서 import

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
  // 수집 데이터가 없으면 분석 스킵 (빈 입력으로 LLM 호출 시 파싱 실패 방지)
  const totalItems = input.articles.length + input.videos.length + input.comments.length;
  if (totalItems === 0) {
    console.log(`[runner] ${module.name}: 수집 데이터 0건 — 분석 스킵 (jobId=${input.jobId})`);
    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'skipped',
      errorMessage: '수집 데이터 없음 — 분석 스킵',
    });
    return { module: module.name, status: 'skipped', errorMessage: '수집 데이터 없음' };
  }

  try {
    // 모듈 실행 시작을 DB에 'running' 상태로 기록
    await persistAnalysisResult({
      jobId: input.jobId,
      module: module.name,
      status: 'running',
    });
    console.log(`[runner] ${module.name}: 분석 시작 (jobId=${input.jobId})`);

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
      // 각 시도 전 취소 확인 — 실행 중인 모듈도 즉시 중단
      if (await isPipelineCancelled(input.jobId)) {
        console.log(`[runner] ${module.name}: 취소 감지 — 분석 중단 (jobId=${input.jobId})`);
        return { module: module.name, status: 'failed', errorMessage: '사용자에 의해 중지됨' };
      }

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
          const msg = `${module.name}: Rate limit 도달, ${Math.round(backoffMs / 1000)}초 후 재시도 (${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`;
          console.log(`[runner] ${msg}`);
          appendJobEvent(input.jobId, 'warn', msg).catch(() => {});
          await sleep(backoffMs);
          continue;
        }
        // 파싱 실패 (구조화 응답 생성 실패) — 최대 2회 재시도
        if (isParseError(error) && attempt < MAX_PARSE_RETRIES) {
          const backoffMs = (attempt + 1) * 5000;
          const msg = `${module.name}: 응답 파싱 실패, ${Math.round(backoffMs / 1000)}초 후 재시도 (${attempt + 1}/${MAX_PARSE_RETRIES})`;
          console.log(`[runner] ${msg}`);
          appendJobEvent(input.jobId, 'warn', msg).catch(() => {});
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

    appendJobEvent(input.jobId, 'error', `${module.name} 분석 실패: ${errorMessage}`).catch(() => {});
    return { module: module.name, status: 'failed', errorMessage };
  }
}

// 오케스트레이션 함수 re-export -- 기존 import 경로 호환성 유지
export { runAnalysisPipeline } from './pipeline-orchestrator';
