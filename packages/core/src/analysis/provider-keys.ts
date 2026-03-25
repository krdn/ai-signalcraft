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
      isActive: providerKeys.isActive,
      createdAt: providerKeys.createdAt,
      updatedAt: providerKeys.updatedAt,
    })
    .from(providerKeys)
    .orderBy(providerKeys.createdAt);

  return rows;
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
      isActive: providerKeys.isActive,
      createdAt: providerKeys.createdAt,
      updatedAt: providerKeys.updatedAt,
    });

  return row;
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
  },
): Promise<ProviderKeyInfo> {
  const db = getDb();

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
  if (data.selectedModel !== undefined) updateData.selectedModel = data.selectedModel;

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
      isActive: providerKeys.isActive,
      createdAt: providerKeys.createdAt,
      updatedAt: providerKeys.updatedAt,
    });

  if (!row) throw new Error(`프로바이더 키 ID ${id}를 찾을 수 없습니다`);
  return row;
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
        // Ollama: 여러 엔드포인트 시도
        const ollamaBase = baseUrl || 'http://localhost:11434';
        const endpoints = ['/api/tags', '/api/models', '/v1/models'];

        for (const ep of endpoints) {
          try {
            const res = await fetch(`${ollamaBase}${ep}`, {
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) continue;
            const data = (await res.json()) as {
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
