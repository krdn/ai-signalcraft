import { generateText, generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'deepseek' | 'xai' | 'openrouter' | 'custom';

export interface AIGatewayOptions {
  provider?: AIProvider;
  model?: string;
  maxOutputTokens?: number;
  systemPrompt?: string;
  baseUrl?: string;
  apiKey?: string;
  /** API 호출 타임아웃 (ms). 기본값 300,000 (5분) */
  timeoutMs?: number;
  /** 외부에서 전달하는 AbortSignal (타임아웃과 병합됨) */
  abortSignal?: AbortSignal;
}

const DEFAULT_MODELS: Partial<Record<AIProvider, string>> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
};

/** 프로바이더별 기본 Base URL */
const DEFAULT_BASE_URLS: Partial<Record<AIProvider, string>> = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  xai: 'https://api.x.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://localhost:11434/v1',
};

export function getModel(provider: AIProvider, model?: string, baseUrl?: string, apiKey?: string) {
  const modelName = model ?? DEFAULT_MODELS[provider] ?? 'gpt-4o-mini';
  console.log(`[ai-gateway] getModel: provider=${provider}, model=${modelName}, baseUrl=${baseUrl ?? 'none'}, hasApiKey=${!!apiKey}`);
  switch (provider) {
    case 'anthropic': {
      const client = createAnthropic({
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { baseURL: baseUrl } : {}),
      });
      return client(modelName);
    }
    case 'gemini': {
      const client = createGoogleGenerativeAI({
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { baseURL: baseUrl } : {}),
      });
      return client(modelName);
    }
    case 'ollama':
    case 'deepseek':
    case 'xai':
    case 'openrouter':
    case 'custom': {
      // OpenAI 호환 프로바이더 — Chat Completions API 사용 (/v1/chat/completions)
      // 중요: client(modelName)은 Responses API(/v1/responses)를 사용하므로 Ollama에서 405 발생
      // client.chat(modelName)을 사용해야 Chat Completions API로 요청됨
      let resolvedBaseUrl: string;
      if (baseUrl) {
        const cleaned = baseUrl.replace(/\/+$/, '');
        resolvedBaseUrl = cleaned.endsWith('/v1') ? cleaned : `${cleaned}/v1`;
      } else {
        resolvedBaseUrl = DEFAULT_BASE_URLS[provider] ?? 'http://localhost:11434/v1';
      }
      const client = createOpenAI({
        baseURL: resolvedBaseUrl,
        apiKey: apiKey || 'ollama',
      });
      return client.chat(modelName);
    }
    case 'openai':
    default: {
      const client = createOpenAI({
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { baseURL: baseUrl } : {}),
      });
      return client(modelName);
    }
  }
}

// 텍스트 분석 -- systemPrompt + usage 반환 지원
export async function analyzeText(
  prompt: string,
  options: AIGatewayOptions = {},
) {
  const provider = options.provider ?? 'anthropic';
  const result = await generateText({
    model: getModel(provider, options.model, options.baseUrl, options.apiKey),
    ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
    prompt,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
    abortSignal: options.abortSignal ?? AbortSignal.timeout(options.timeoutMs ?? 300_000),
  });
  return {
    text: result.text,
    usage: result.usage,
    finishReason: result.finishReason,
  };
}

// 구조화 분석 -- systemPrompt + usage 반환 지원
export async function analyzeStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: AIGatewayOptions = {},
) {
  const provider = options.provider ?? 'anthropic';
  const result = await generateObject({
    model: getModel(provider, options.model, options.baseUrl, options.apiKey),
    ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
    prompt,
    schema,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
    abortSignal: options.abortSignal ?? AbortSignal.timeout(options.timeoutMs ?? 300_000),
  });
  return {
    object: result.object,
    usage: result.usage,
    finishReason: result.finishReason,
  };
}
