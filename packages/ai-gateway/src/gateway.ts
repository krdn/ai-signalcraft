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

/**
 * 텍스트 응답에서 JSON 블록 추출
 * Gemini가 markdown 코드블록이나 설명 텍스트를 섞어 반환할 때 대응
 */
function extractJsonFromText(text: string): string {
  // 1) ```json ... ``` 코드블록에서 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // 2) 첫 번째 { ... 마지막 } 사이 추출
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  // 3) 그대로 반환 (JSON.parse가 실패하면 상위에서 에러 처리)
  return text.trim();
}

/**
 * generateObject 파싱 실패 감지
 */
function isObjectParseError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('could not parse') || msg.includes('No object generated')
    || msg.includes('Failed to parse') || msg.includes('did not match schema');
}

// 구조화 분석 -- systemPrompt + usage 반환 지원
// generateObject 실패 시 generateText + 수동 JSON 파싱으로 폴백
export async function analyzeStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options: AIGatewayOptions = {},
) {
  const provider = options.provider ?? 'anthropic';
  const model = getModel(provider, options.model, options.baseUrl, options.apiKey);
  const abortSignal = options.abortSignal ?? AbortSignal.timeout(options.timeoutMs ?? 300_000);

  try {
    const result = await generateObject({
      model,
      ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
      prompt,
      schema,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
      abortSignal,
    });
    return {
      object: result.object,
      usage: result.usage,
      finishReason: result.finishReason,
    };
  } catch (error) {
    // generateObject 파싱 실패 시에만 텍스트 폴백 시도
    if (!isObjectParseError(error)) {
      throw error;
    }

    console.log(`[ai-gateway] generateObject 파싱 실패, generateText 폴백 시도 (provider=${provider})`);

    // generateText로 폴백: JSON 형식 명시 요청
    const fallbackPrompt = `${prompt}\n\n중요: 반드시 유효한 JSON 형식으로만 응답하세요. 설명이나 마크다운 없이 JSON 객체만 반환하세요.`;
    const textResult = await generateText({
      model,
      ...(options.systemPrompt
        ? { system: `${options.systemPrompt}\n\n응답 형식: 반드시 순수 JSON 객체로만 응답하세요. 코드블록, 설명 텍스트, 마크다운 없이 JSON만 반환합니다.` }
        : { system: '응답 형식: 반드시 순수 JSON 객체로만 응답하세요. 코드블록, 설명 텍스트, 마크다운 없이 JSON만 반환합니다.' }),
      prompt: fallbackPrompt,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
      abortSignal,
    });

    // 텍스트에서 JSON 추출 후 Zod 파싱
    const jsonText = extractJsonFromText(textResult.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error(`[ai-gateway] 텍스트 폴백 JSON 파싱 실패: ${jsonText.substring(0, 200)}...`);
      // 원래 generateObject 에러를 re-throw (폴백도 실패했으므로)
      throw error;
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      console.error(`[ai-gateway] 텍스트 폴백 스키마 검증 실패:`, validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
      // 원래 generateObject 에러를 re-throw
      throw error;
    }

    console.log(`[ai-gateway] generateText 폴백 성공 (provider=${provider})`);
    return {
      object: validated.data,
      usage: textResult.usage,
      finishReason: textResult.finishReason,
    };
  }
}
