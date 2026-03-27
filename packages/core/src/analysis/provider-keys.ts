// AI 프로바이더 API 키 관리 (CRUD)
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { providerKeys } from '../db/schema/settings';
import { encrypt, decrypt, maskKey } from '../utils/crypto';
import type { ProviderKeyInfo } from '../types/analysis';

export type { ProviderKeyInfo } from '../types/analysis';

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
