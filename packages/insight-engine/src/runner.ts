/**
 * 단일 분석 모듈 실행 러너 (DB 의존 없음)
 * 모든 상태 변경/저장은 콜백으로 위임
 */
import {
  analyzeStructured,
  normalizeUsage,
  type AIGatewayOptions,
  type NormalizedUsage,
} from '@ai-signalcraft/insight-gateway';
import type { AnalysisModule, AnalysisInput, AnalysisModuleResult, ModuleConfig } from './types';
import {
  isRateLimitError,
  isServerOverloadError,
  parseRetryAfter,
  sleep,
  MAX_RATE_LIMIT_RETRIES,
} from './retry-utils';

export interface RunModuleParams<T> {
  module: AnalysisModule<T>;
  input: AnalysisInput;
  config: ModuleConfig;
  priorResults?: Record<string, unknown>;
  signal?: AbortSignal;
  onUsage?: (usage: NormalizedUsage & { provider: string; model: string }) => void;
  onEvent?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

/**
 * 단일 분석 모듈 실행
 * - 수집 데이터가 0건이면 skipped 반환
 * - Rate limit / 서버 과부하 발생 시 exponential backoff 재시도
 * - 파싱 실패 등은 즉시 failed 반환 (throw하지 않음 — 부분 실패 허용)
 */
export async function runModule<T>(params: RunModuleParams<T>): Promise<AnalysisModuleResult<T>> {
  const { module, input, config, priorResults, signal, onUsage, onEvent } = params;

  const totalItems = input.articles.length + input.videos.length + input.comments.length;
  if (totalItems === 0) {
    onEvent?.('info', `${module.name}: 수집 데이터 0건 — 분석 스킵`);
    return {
      module: module.name,
      status: 'skipped',
      errorMessage: '수집 데이터 없음',
    };
  }

  try {
    onEvent?.(
      'info',
      `${module.name}: 분석 시작 (provider=${config.provider}, model=${config.model})`,
    );

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
      maxOutputTokens: config.maxOutputTokens ?? 8192,
      timeoutMs: config.timeoutMs,
      abortSignal: signal,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      if (signal?.aborted) {
        return {
          module: module.name,
          status: 'failed',
          errorMessage: '외부 취소 신호 수신',
        };
      }

      try {
        const result = await analyzeStructured(prompt, module.schema, gatewayOptions);
        const normalized = normalizeUsage(result.usage as Record<string, unknown>);
        const usage = {
          ...normalized,
          provider: config.provider,
          model: config.model,
        };
        onUsage?.(usage);

        return {
          module: module.name,
          status: 'completed',
          result: result.object,
          usage,
        };
      } catch (error) {
        lastError = error;

        if (isRateLimitError(error) && attempt < MAX_RATE_LIMIT_RETRIES) {
          const retryAfterSec = parseRetryAfter(error);
          const backoffMs = Math.max(retryAfterSec * 1000, (attempt + 1) * 3000);
          onEvent?.(
            'warn',
            `${module.name}: Rate limit 도달, ${Math.round(backoffMs / 1000)}초 후 재시도 (${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`,
          );
          await sleep(backoffMs);
          continue;
        }

        if (isServerOverloadError(error) && attempt < 1) {
          onEvent?.('warn', `${module.name}: 서버 과부하, 15초 후 재시도`);
          await sleep(15_000);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    onEvent?.('error', `${module.name}: 분석 실패 — ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      console.error(`[engine/runner] ${module.name} 스택:\n${error.stack}`);
    }
    return {
      module: module.name,
      status: 'failed',
      errorMessage,
    };
  }
}
