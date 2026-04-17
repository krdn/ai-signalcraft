/**
 * Streaming 분석 실행기 (선택적 실행 경로)
 *
 * Vercel AI SDK v6 `streamObject`로 partial JSON을 실시간 수신.
 * UI에서 Stage 진행 중에도 부분 결과를 표시 가능.
 *
 * 의존성: 'ai', '@ai-sdk/anthropic' 등은 web 앱이 이미 사용 중.
 * 여기서는 동적 import로 core 패키지의 직접 의존성을 피함.
 *
 * 환경변수 AIS_STREAMING=on 또는 options.stream=true일 때만 활성화.
 * 기본은 기존 kit 기반 비동기 실행.
 */
import { updateJobProgress } from '../pipeline/persist';
import type { AnalysisModule, AnalysisInput, AnalysisModuleResult } from './types';

/** partial 업데이트 throttle: UI 과부하 방지 */
const PARTIAL_THROTTLE_MS = 500;

interface StreamingOptions {
  /** 부분 결과를 DB progress에 기록할지 (기본 true) */
  persistPartial?: boolean;
  /** abort signal */
  abortSignal?: AbortSignal;
}

async function resolveModel(provider: string, modelId: string): Promise<unknown | null> {
  try {
    switch (provider) {
      case 'anthropic': {
        const mod = (await import('@ai-sdk/anthropic' as string)) as any;
        return mod.anthropic(modelId);
      }
      case 'gemini':
      case 'google': {
        const mod = (await import('@ai-sdk/google' as string)) as any;
        return mod.google(modelId);
      }
      case 'openai': {
        const mod = (await import('@ai-sdk/openai' as string)) as any;
        return mod.openai(modelId);
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * 단일 모듈을 streaming으로 실행
 * 실패 시 null 반환 → 호출자는 kit 기반 경로로 fallback 필요
 */
export async function runModuleStreaming<T>(
  module: AnalysisModule<T>,
  input: AnalysisInput,
  providerConfig: { provider: string; model: string; apiKey?: string },
  priorResults?: Record<string, unknown>,
  options: StreamingOptions = {},
): Promise<AnalysisModuleResult<T> | null> {
  const model = await resolveModel(providerConfig.provider, providerConfig.model);
  if (!model) return null;

  let aiModule: any;
  try {
    aiModule = await import('ai' as string);
  } catch {
    return null;
  }

  const systemPrompt = module.buildSystemPrompt(input.domain);
  const prompt = module.buildPromptWithContext
    ? module.buildPromptWithContext(input, priorResults ?? {}, input.domain)
    : module.buildPrompt(input);

  // Anthropic의 message 레벨 cache_control 적용 (Stage 1의 공통 system prompt 캐시)
  const useAnthropicCache = providerConfig.provider === 'anthropic';

  let lastPartialAt = 0;

  try {
    const streamResult = aiModule.streamObject({
      model,
      schema: module.schema,
      ...(useAnthropicCache
        ? {
            messages: [
              {
                role: 'system',
                content: systemPrompt,
                providerOptions: {
                  anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } },
                },
              },
              { role: 'user', content: prompt },
            ],
          }
        : { system: systemPrompt, prompt }),
      abortSignal: options.abortSignal,
    });

    if (options.persistPartial !== false) {
      for await (const partial of streamResult.partialObjectStream) {
        const now = Date.now();
        if (now - lastPartialAt < PARTIAL_THROTTLE_MS) continue;
        lastPartialAt = now;
        await updateJobProgress(input.jobId, {
          [module.name]: { status: 'streaming', partial },
        }).catch(() => undefined);
      }
    }

    const result = await streamResult.object;
    const usageInfo = await streamResult.usage;

    return {
      module: module.name,
      status: 'completed',
      result: result as T,
      usage: {
        inputTokens: usageInfo.inputTokens ?? 0,
        outputTokens: usageInfo.outputTokens ?? 0,
        totalTokens: usageInfo.totalTokens ?? 0,
        provider: providerConfig.provider,
        model: providerConfig.model,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[streaming-runner] ${module.name} 실패:`, msg);
    return {
      module: module.name,
      status: 'failed',
      errorMessage: msg,
    };
  }
}

/** streaming 모드가 활성화되어 있는지 */
export function isStreamingEnabled(): boolean {
  return process.env.AIS_STREAMING === 'on';
}
