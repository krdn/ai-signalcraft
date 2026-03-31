// AI 프로바이더 연결 테스트 + 채팅 테스트
// provider-keys.ts에서 분리된 테스트/유틸 함수
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { providerKeys } from '../db/schema/settings';
import { decrypt } from '../utils/crypto';

// Anthropic 모델 목록 (주요 모델 하드코딩 + API 조회 병행)
const ANTHROPIC_MODELS_FALLBACK = [
  'claude-sonnet-4-5-20250514',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-haiku-35-20241022',
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
        // Anthropic /v1/models API로 모델 목록 조회 시도
        try {
          const endpoint = baseUrl || 'https://api.anthropic.com';
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
        // Google Generative AI: models 목록
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
        try { origin = new URL(rawBase).origin; } catch { origin = rawBase; }

        // baseUrl 자체 + origin 기반으로 다양한 경로 시도
        const candidateUrls = [
          `${rawBase}/tags`,           // baseUrl이 이미 /api를 포함하는 경우
          `${rawBase}/models`,
          `${origin}/api/tags`,        // 직접 Ollama
          `${origin}/api/models`,
          `${origin}/v1/models`,       // OpenAI 호환
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
        const model = selectedModel || 'claude-sonnet-4-20250514';
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
        const data = (await res.json()) as { content?: Array<{ text: string }>; error?: { message: string } };
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
        const data = (await res.json()) as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } };
        if (!res.ok) throw new Error(data.error?.message || `API 오류: ${res.status}`);
        return { response: data.candidates?.[0]?.content?.parts?.[0]?.text || '', model };
      }

      case 'ollama': {
        const model = selectedModel || 'llama3';
        const rawChatBase = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
        let chatOrigin: string;
        try { chatOrigin = new URL(rawChatBase).origin; } catch { chatOrigin = rawChatBase; }
        const chatHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) chatHeaders['Authorization'] = `Bearer ${apiKey}`;

        // 여러 채팅 엔드포인트 시도
        const chatEndpoints = [...new Set([
          `${rawChatBase}/chat`,              // baseUrl이 /api를 포함하는 경우
          `${chatOrigin}/api/chat`,           // 직접 Ollama
          `${chatOrigin}/ollama/api/chat`,    // Open WebUI 프록시
          `${chatOrigin}/v1/chat/completions`, // OpenAI 호환
        ])];

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

      default: {
        // OpenAI 호환 (openai, deepseek, xai, openrouter, custom)
        const model = selectedModel || 'gpt-4o-mini';
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
        const data = (await res.json()) as { choices?: Array<{ message: { content: string } }>; error?: { message: string } };
        if (!res.ok) throw new Error(data.error?.message || `API 오류: ${res.status}`);
        return { response: data.choices?.[0]?.message?.content || '', model };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return { response: '', model: selectedModel || '', error: message };
  }
}
