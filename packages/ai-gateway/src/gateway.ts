import { generateText, generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export type AIProvider = 'anthropic' | 'openai';

export interface AIGatewayOptions {
  provider?: AIProvider;
  model?: string;
  maxOutputTokens?: number;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o-mini',
};

function getModel(provider: AIProvider, model?: string) {
  const modelName = model ?? DEFAULT_MODELS[provider];
  switch (provider) {
    case 'anthropic':
      return anthropic(modelName);
    case 'openai':
      return openai(modelName);
  }
}

// 텍스트 분석 (Phase 2에서 프롬프트와 연결)
export async function analyzeText(
  prompt: string,
  options: AIGatewayOptions = {},
) {
  const provider = options.provider ?? 'anthropic';
  return generateText({
    model: getModel(provider, options.model),
    prompt,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
  });
}

// 구조화 분석 (Phase 2에서 Zod 스키마와 연결)
export async function analyzeStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: AIGatewayOptions = {},
) {
  const provider = options.provider ?? 'anthropic';
  return generateObject({
    model: getModel(provider, options.model),
    prompt,
    schema,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
  });
}
