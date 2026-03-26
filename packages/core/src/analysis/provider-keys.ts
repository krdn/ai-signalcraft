// AI 프로바이더 API 키 관리 (CRUD + 연결 테스트)
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { providerKeys } from '../db/schema/settings';
import { encrypt, decrypt, maskKey } from '../utils/crypto';

// 외부에 노출되는 프로바이더 키 정보 (encryptedKey 제외)
export interface ProviderKeyInfo {
  id: number;
  providerName: string;
  providerType: string;
  name: string;
  maskedKey: string | null;
  baseUrl: string | null;
  selectedModel: string | null;
  availableModels: string[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Anthropic 모델 목록 (API로 조회 불가, 하드코딩)
const ANTHROPIC_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-35-20241022',
  'claude-opus-4-20250514',
];

/**
 * 전체 프로바이더 키 목록 조회
 * encryptedKey는 절대 반환하지 않음
 */
export async function getAllProviderKeys(): Promise<ProviderKeyInfo[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: providerKeys.id,
      providerName: providerKeys.providerName,
      providerType: providerKeys.providerType,
      name: providerKeys.name,
      maskedKey: providerKeys.maskedKey,
      baseUrl: providerKeys.baseUrl,
      selectedModel: providerKeys.selectedModel,
      availableModels: providerKeys.availableModels,
      isActive: providerKeys.isActive,
      createdAt: providerKeys.createdAt,
      updatedAt: providerKeys.updatedAt,
    })
    .from(providerKeys)
    .orderBy(providerKeys.createdAt);

  return rows as ProviderKeyInfo[];
}

/**
 * 프로바이더 키 추가
 */
export async function addProviderKey(data: {
  name: string;
  providerType: string;
  providerName: string;
  key?: string;
  baseUrl?: string;
}): Promise<ProviderKeyInfo> {
  const db = getDb();

  const encryptedKey = data.key ? encrypt(data.key) : null;
  const masked = data.key ? maskKey(data.key) : null;

  const [row] = await db
    .insert(providerKeys)
    .values({
      name: data.name,
      providerType: data.providerType,
      providerName: data.providerName,
      encryptedKey,
      maskedKey: masked,
      baseUrl: data.baseUrl ?? null,
    })
    .returning({
      id: providerKeys.id,
      providerName: providerKeys.providerName,
      providerType: providerKeys.providerType,
      name: providerKeys.name,
      maskedKey: providerKeys.maskedKey,
      baseUrl: providerKeys.baseUrl,
      selectedModel: providerKeys.selectedModel,
      availableModels: providerKeys.availableModels,
      isActive: providerKeys.isActive,
      createdAt: providerKeys.createdAt,
      updatedAt: providerKeys.updatedAt,
    });

  return row as ProviderKeyInfo;
}

/**
 * 프로바이더 키 수정
 * key가 전달되면 재암호화, 없으면 기존 유지
 */
export async function updateProviderKey(
  id: number,
  data: {
    name?: string;
    key?: string;
    baseUrl?: string;
    selectedModel?: string;
    availableModels?: string[];
  },
): Promise<ProviderKeyInfo> {
  const db = getDb();

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
  if (data.selectedModel !== undefined) updateData.selectedModel = data.selectedModel;
  if (data.availableModels !== undefined) updateData.availableModels = data.availableModels;

  if (data.key) {
    updateData.encryptedKey = encrypt(data.key);
    updateData.maskedKey = maskKey(data.key);
  }

  const [row] = await db
    .update(providerKeys)
    .set(updateData)
    .where(eq(providerKeys.id, id))
    .returning({
      id: providerKeys.id,
      providerName: providerKeys.providerName,
      providerType: providerKeys.providerType,
      name: providerKeys.name,
      maskedKey: providerKeys.maskedKey,
      baseUrl: providerKeys.baseUrl,
      selectedModel: providerKeys.selectedModel,
      availableModels: providerKeys.availableModels,
      isActive: providerKeys.isActive,
      createdAt: providerKeys.createdAt,
      updatedAt: providerKeys.updatedAt,
    });

  if (!row) throw new Error(`프로바이더 키 ID ${id}를 찾을 수 없습니다`);
  return row as ProviderKeyInfo;
}

/**
 * 프로바이더 키 삭제
 */
export async function deleteProviderKey(id: number): Promise<void> {
  const db = getDb();
  const result = await db.delete(providerKeys).where(eq(providerKeys.id, id)).returning({ id: providerKeys.id });
  if (result.length === 0) throw new Error(`프로바이더 키 ID ${id}를 찾을 수 없습니다`);
}

/**
 * 암호화된 키 복호화 (내부 분석 실행용)
 */
export async function getDecryptedKey(id: number): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ encryptedKey: providerKeys.encryptedKey })
    .from(providerKeys)
    .where(eq(providerKeys.id, id))
    .limit(1);

  if (!row?.encryptedKey) throw new Error(`프로바이더 키 ID ${id}의 암호화된 키가 없습니다`);
  return decrypt(row.encryptedKey);
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
      case 'anthropic':
        return { success: true, models: ANTHROPIC_MODELS };

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
        // origin 추출 (https://ollama.krdn.kr/api → https://ollama.krdn.kr)
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

/** 프로바이더별 기본 Base URL */
function getDefaultBaseUrl(providerType: string): string {
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
