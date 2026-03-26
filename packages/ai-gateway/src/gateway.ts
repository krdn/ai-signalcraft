import { generateText, generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export type AIProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'deepseek' | 'xai' | 'openrouter' | 'custom';

export interface AIGatewayOptions {
  provider?: AIProvider;
  model?: string;
  maxOutputTokens?: number;
  systemPrompt?: string;  // 분석 모듈별 시스템 프롬프트
}

const DEFAULT_MODELS: Partial<Record<AIProvider, string>> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
};

function getModel(provider: AIProvider, model?: string) {
  const modelName = model ?? DEFAULT_MODELS[provider] ?? 'gpt-4o-mini';
  switch (provider) {
    case 'anthropic':
      return anthropic(modelName);
    case 'openai':
      // OpenAI 호환 프로바이더 (deepseek, xai, openrouter, custom 등)는
      // provider-keys에서 설정된 baseUrl과 API 키로 실제 연결됨
      // 여기서는 AI SDK의 openai 프로바이더를 사용
    default:
      return openai(modelName);
  }
}

// 텍스트 분석 -- systemPrompt + usage 반환 지원
export async function analyzeText(
  prompt: string,
  options: AIGatewayOptions = {},
) {
  const provider = options.provider ?? 'anthropic';
  const result = await generateText({
    model: getModel(provider, options.model),
    ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
    prompt,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
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
    model: getModel(provider, options.model),
    ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
    prompt,
    schema,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
  });
  return {
    object: result.object,
    usage: result.usage,
    finishReason: result.finishReason,
  };
}
