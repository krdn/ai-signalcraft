// AI 프로바이더 연결 테스트 + 채팅 테스트
// provider-keys.ts에서 분리된 테스트/유틸 함수
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { providerKeys } from '../db/schema/settings';
import { decrypt } from '../utils/crypto';

// Gemini CLI에서 사용 가능한 모델 목록 폴백 — 2026-04 기준
// @google/gemini-cli-core의 VALID_GEMINI_MODELS + 최신 3.x 시리즈
const GEMINI_CLI_MODELS_FALLBACK = [
  // Gemini 3.1 시리즈 (2026-02~03 출시)
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-live-preview',
  // Gemini 3.0 시리즈
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  // Gemini 2.5 시리즈 (stable)
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  // Gemini 2.0 시리즈 (deprecated but still available)
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

// Anthropic 모델 목록 (주요 모델 하드코딩 + API 조회 병행) — 2026-04 최신
const ANTHROPIC_MODELS_FALLBACK = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
];

/** 프로바이더별 기본 Base URL */
export function getDefaultBaseUrl(providerType: string): string {
  switch (providerType) {
    case 'openai':
      return 'https://api.openai.com';
    case 'deepseek':
      return 'https://api.deepseek.com';
    case 'xai':
      return 'https://api.x.ai';
    case 'openrouter':
      return 'https://openrouter.ai/api';
    default:
      return '';
  }
}

/**
 * 프로바이더 연결 테스트 + 사용 가능 모델 목록 반환
 */
export async function testProviderConnection(
  id: number,
): Promise<{ success: boolean; models: string[]; error?: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      providerType: providerKeys.providerType,
      encryptedKey: providerKeys.encryptedKey,
      baseUrl: providerKeys.baseUrl,
    })
    .from(providerKeys)
    .where(eq(providerKeys.id, id))
    .limit(1);

  if (!row) return { success: false, models: [], error: '프로바이더 키를 찾을 수 없습니다' };

  const apiKey = row.encryptedKey ? decrypt(row.encryptedKey) : '';
  const { providerType, baseUrl } = row;

  try {
    switch (providerType) {
      case 'anthropic': {
        const endpoint = baseUrl || 'https://api.anthropic.com';
        // cli-proxy-api 등 OpenAI 호환 프록시: Bearer 토큰 + /v1/models (claude 모델만 필터)
        if (baseUrl) {
          try {
            const res = await fetch(`${endpoint}/v1/models`, {
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
              const data = (await res.json()) as { data?: Array<{ id: string }> };
              if (data.data && data.data.length > 0) {
                const models = data.data
                  .map((m) => m.id)
                  .filter((id) => id.startsWith('claude'))
                  .sort();
                return { success: true, models };
              }
            }
          } catch {
            // 프록시 조회 실패 시 폴백
          }
        }
        // 네이티브 Anthropic API
        try {
          const res = await fetch(`${endpoint}/v1/models?limit=100`, {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const data = (await res.json()) as { data?: Array<{ id: string }> };
            if (data.data && data.data.length > 0) {
              const models = data.data.map((m) => m.id).sort();
              return { success: true, models };
            }
          }
        } catch {
          // API 조회 실패 시 폴백
        }
        return { success: true, models: ANTHROPIC_MODELS_FALLBACK };
      }

      case 'openai':
      case 'deepseek':
      case 'xai':
      case 'openrouter':
      case 'custom': {
        // OpenAI 호환 API: /v1/models
        const endpoint = baseUrl || getDefaultBaseUrl(providerType);
        const res = await fetch(`${endpoint}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) throw new Error(`API 응답 오류: ${res.status} ${res.statusText}`);
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        const models = (data.data ?? []).map((m) => m.id).sort();
        return { success: true, models };
      }

      case 'gemini': {
        // cli-proxy-api 등 OpenAI 호환 프록시: Bearer 토큰 + /v1/models (gemini 모델만 필터)
        if (baseUrl) {
          try {
            const res = await fetch(`${baseUrl}/v1/models`, {
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
              const data = (await res.json()) as { data?: Array<{ id: string }> };
              if (data.data && data.data.length > 0) {
                const models = data.data
                  .map((m) => m.id)
                  .filter((id) => id.startsWith('gemini'))
                  .sort();
                return { success: true, models };
              }
            }
          } catch {
            // 프록시 조회 실패 시 네이티브 API로 폴백
          }
        }
        // 네이티브 Google Generative AI API
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        );
        if (!res.ok) throw new Error(`API 응답 오류: ${res.status} ${res.statusText}`);
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        const models = (data.models ?? [])
          .map((m) => m.name.replace('models/', ''))
          .filter((n) => n.startsWith('gemini'))
          .sort();
        return { success: true, models };
      }

      case 'ollama': {
        // Ollama: 여러 엔드포인트 시도 (직접/Open WebUI 프록시 포함)
        const rawBase = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        // origin 추출 (https://ollama.krdn.kr/api -> https://ollama.krdn.kr)
        let origin: string;
        try {
          origin = new URL(rawBase).origin;
        } catch {
          origin = rawBase;
        }

        // baseUrl 자체 + origin 기반으로 다양한 경로 시도
        const candidateUrls = [
          `${rawBase}/tags`, // baseUrl이 이미 /api를 포함하는 경우
          `${rawBase}/models`,
          `${origin}/api/tags`, // 직접 Ollama
          `${origin}/api/models`,
          `${origin}/v1/models`, // OpenAI 호환
          `${origin}/ollama/api/tags`, // Open WebUI 프록시
        ];
        // 중복 제거
        const endpoints = [...new Set(candidateUrls)];

        const headers: Record<string, string> = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        for (const ep of endpoints) {
          try {
            const res = await fetch(ep, {
              headers,
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) continue;
            // HTML 응답 건너뛰기 (Open WebUI가 200 OK + HTML을 반환하는 경우)
            const text = await res.text();
            if (text.trim().startsWith('<')) continue;
            const data = JSON.parse(text) as {
              models?: Array<{ name?: string; model?: string; id?: string }>;
              data?: Array<{ id: string }>;
            };

            // /api/tags, /api/models 응답 형식
            if (data.models) {
              const models = data.models.map((m) => m.name ?? m.model ?? '').filter(Boolean);
              return { success: true, models };
            }
            // /v1/models 응답 형식 (OpenAI 호환)
            if (data.data) {
              const models = data.data.map((m) => m.id);
              return { success: true, models };
            }
          } catch {
            continue;
          }
        }
        return { success: false, models: [], error: 'Ollama 서버에 연결할 수 없습니다' };
      }

      case 'claude-cli': {
        // Claude CLI Proxy — cli-proxy-api를 통해 claude 모델만 필터링
        if (!baseUrl)
          return {
            success: false,
            models: [],
            error: 'Base URL이 필요합니다 (cli-proxy-api 주소)',
          };
        try {
          const res = await fetch(`${baseUrl}/v1/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) throw new Error(`API 응답 오류: ${res.status} ${res.statusText}`);
          const data = (await res.json()) as { data?: Array<{ id: string }> };
          const models = (data.data ?? [])
            .map((m) => m.id)
            .filter((id) => id.startsWith('claude'))
            .sort();
          return { success: true, models };
        } catch {
          // 프록시 조회 실패 시 폴백
          return { success: true, models: ANTHROPIC_MODELS_FALLBACK };
        }
      }

      case 'gemini-cli': {
        // Gemini CLI Proxy — cli-proxy-api를 통해 gemini 모델만 필터링
        if (baseUrl) {
          try {
            const res = await fetch(`${baseUrl}/v1/models`, {
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
              const data = (await res.json()) as { data?: Array<{ id: string }> };
              if (data.data && data.data.length > 0) {
                const models = data.data
                  .map((m) => m.id)
                  .filter((id) => id.startsWith('gemini'))
                  .sort();
                if (models.length > 0) return { success: true, models };
              }
            }
          } catch {
            // 프록시 조회 실패 시 폴백
          }
        }
        // 폴백: Gemini CLI OAuth로 사용 가능한 모델 목록
        return { success: true, models: [...GEMINI_CLI_MODELS_FALLBACK] };
      }

      default:
        return { success: false, models: [], error: `지원하지 않는 프로바이더: ${providerType}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return { success: false, models: [], error: message };
  }
}

/**
 * LLM 채팅 테스트 (Playground)
 * 등록된 프로바이더 키로 프롬프트를 보내 응답을 확인
 */
export async function chatWithProvider(
  id: number,
  prompt: string,
): Promise<{ response: string; model: string; error?: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      providerType: providerKeys.providerType,
      encryptedKey: providerKeys.encryptedKey,
      baseUrl: providerKeys.baseUrl,
      selectedModel: providerKeys.selectedModel,
    })
    .from(providerKeys)
    .where(eq(providerKeys.id, id))
    .limit(1);

  if (!row) return { response: '', model: '', error: '프로바이더 키를 찾을 수 없습니다' };

  const apiKey = row.encryptedKey ? decrypt(row.encryptedKey) : '';
  const { providerType, baseUrl, selectedModel } = row;

  try {
    switch (providerType) {
      case 'anthropic': {
        const model = selectedModel || 'claude-sonnet-4-6';
        const endpoint = baseUrl || 'https://api.anthropic.com/v1';
        const res = await fetch(`${endpoint}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = (await res.json()) as {
          content?: Array<{ text: string }>;
          error?: { message: string };
        };
        if (!res.ok) throw new Error(data.error?.message || `API 오류: ${res.status}`);
        return { response: data.content?.[0]?.text || '', model };
      }

      case 'gemini': {
        const model = selectedModel || 'gemini-1.5-pro';
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          },
        );
        const data = (await res.json()) as {
          candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
          error?: { message: string };
        };
        if (!res.ok) throw new Error(data.error?.message || `API 오류: ${res.status}`);
        return { response: data.candidates?.[0]?.content?.parts?.[0]?.text || '', model };
      }

      case 'ollama': {
        const model = selectedModel || 'llama3';
        const rawChatBase = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        let chatOrigin: string;
        try {
          chatOrigin = new URL(rawChatBase).origin;
        } catch {
          chatOrigin = rawChatBase;
        }
        const chatHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) chatHeaders['Authorization'] = `Bearer ${apiKey}`;

        // 여러 채팅 엔드포인트 시도
        const chatEndpoints = [
          ...new Set([
            `${rawChatBase}/chat`, // baseUrl이 /api를 포함하는 경우
            `${chatOrigin}/api/chat`, // 직접 Ollama
            `${chatOrigin}/ollama/api/chat`, // Open WebUI 프록시
            `${chatOrigin}/v1/chat/completions`, // OpenAI 호환
          ]),
        ];

        for (const ep of chatEndpoints) {
          try {
            const isOpenAICompat = ep.includes('/v1/chat/completions');
            const body = isOpenAICompat
              ? { model, messages: [{ role: 'user', content: prompt }] }
              : { model, messages: [{ role: 'user', content: prompt }], stream: false };

            const res = await fetch(ep, {
              method: 'POST',
              headers: chatHeaders,
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(30000),
            });
            if (!res.ok) continue;

            const data = (await res.json()) as {
              message?: { content: string };
              choices?: Array<{ message: { content: string } }>;
              error?: string;
            };
            const text = isOpenAICompat
              ? data.choices?.[0]?.message?.content || ''
              : data.message?.content || '';
            if (text) return { response: text, model };
          } catch {
            continue;
          }
        }
        throw new Error('Ollama 서버에 연결할 수 없습니다. URL을 확인해주세요.');
      }

      case 'claude-cli': {
        // Claude CLI Proxy — OpenAI Chat Completions API (/v1/chat/completions)
        // gateway.ts와 동일한 엔드포인트 사용 (cli-proxy-api는 /v1/messages 미지원)
        const model = selectedModel || 'claude-sonnet-4-6';
        const proxyBase = (baseUrl || 'http://localhost:8317').replace(/\/+$/, '');
        const resolvedUrl = proxyBase.endsWith('/v1') ? proxyBase : `${proxyBase}/v1`;
        const res = await fetch(`${resolvedUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey || 'cli-proxy'}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(30000),
        });
        const data = (await res.json()) as {
          choices?: Array<{ message: { content: string } }>;
          error?: { message: string };
        };
        if (!res.ok) throw new Error(data.error?.message || `API 오류: ${res.status}`);
        return { response: data.choices?.[0]?.message?.content || '', model };
      }

      case 'gemini-cli': {
        // Gemini CLI — AI SDK 경유 (OAuth 인증, Chat Completions API 없음)
        // gateway.ts의 getModel → generateText와 동일한 경로 사용
        const { analyzeText } = await import('@ai-signalcraft/insight-gateway');
        const model = selectedModel || 'gemini-2.5-flash';
        const result = await analyzeText(prompt, {
          provider: 'gemini-cli',
          model,
          timeoutMs: 30000,
        });
        return { response: result.text, model };
      }

      default: {
        // OpenAI 호환 (openai, deepseek, xai, openrouter, custom)
        const model = selectedModel || 'gpt-4.1-nano';
        const endpoint = baseUrl || getDefaultBaseUrl(providerType);
        const res = await fetch(`${endpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = (await res.json()) as {
          choices?: Array<{ message: { content: string } }>;
          error?: { message: string };
        };
        if (!res.ok) throw new Error(data.error?.message || `API 오류: ${res.status}`);
        return { response: data.choices?.[0]?.message?.content || '', model };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return { response: '', model: selectedModel || '', error: message };
  }
}
