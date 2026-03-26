// 모듈별 AI 모델 설정 조회/저장 (DB 기반 동적 설정)
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { modelSettings, providerKeys } from '../db/schema/settings';
import { decrypt } from '../utils/crypto';
import type { AIProvider } from './types';
import { MODULE_MODEL_MAP } from './types';

export interface ModuleModelConfig {
  provider: AIProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

/**
 * 프로바이더 타입에 해당하는 활성 프로바이더 키에서 연결 정보를 가져옴
 */
async function getProviderKeyInfo(
  providerType: string,
): Promise<{ selectedModel: string | null; baseUrl: string | null; apiKey: string | null } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      selectedModel: providerKeys.selectedModel,
      baseUrl: providerKeys.baseUrl,
      encryptedKey: providerKeys.encryptedKey,
    })
    .from(providerKeys)
    .where(
      and(
        eq(providerKeys.providerType, providerType),
        eq(providerKeys.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    selectedModel: row.selectedModel,
    baseUrl: row.baseUrl,
    apiKey: row.encryptedKey ? decrypt(row.encryptedKey) : null,
  };
}

/**
 * 단일 모듈의 AI 모델 설정 조회
 * 우선순위: 1) modelSettings DB → 2) providerKeys.selectedModel → 3) MODULE_MODEL_MAP 기본값
 * 프로바이더 키의 baseUrl/apiKey도 함께 반환하여 gateway에서 올바른 연결 설정 가능
 */
export async function getModuleModelConfig(
  moduleName: string,
): Promise<ModuleModelConfig> {
  const db = getDb();

  // 1) modelSettings 테이블에서 모듈별 설정 조회
  const [dbSetting] = await db
    .select({
      provider: modelSettings.provider,
      model: modelSettings.model,
    })
    .from(modelSettings)
    .where(eq(modelSettings.moduleName, moduleName))
    .limit(1);

  if (dbSetting) {
    const keyInfo = await getProviderKeyInfo(dbSetting.provider);
    const config = {
      provider: dbSetting.provider as AIProvider,
      model: dbSetting.model,
      baseUrl: keyInfo?.baseUrl ?? undefined,
      apiKey: keyInfo?.apiKey ? '***' : undefined,
    };
    console.log(`[model-config] ${moduleName}: DB설정 사용 → provider=${config.provider}, model=${config.model}, baseUrl=${config.baseUrl}, hasApiKey=${!!keyInfo?.apiKey}`);
    return {
      provider: dbSetting.provider as AIProvider,
      model: dbSetting.model,
      baseUrl: keyInfo?.baseUrl ?? undefined,
      apiKey: keyInfo?.apiKey ?? undefined,
    };
  }

  // 2) 기본값에서 프로바이더 타입 확인 후 providerKeys.selectedModel 폴백
  const defaultConfig = MODULE_MODEL_MAP[moduleName];
  if (!defaultConfig) {
    throw new Error(`알 수 없는 모듈: ${moduleName}`);
  }

  const keyInfo = await getProviderKeyInfo(defaultConfig.provider);

  if (keyInfo?.selectedModel) {
    return {
      provider: defaultConfig.provider,
      model: keyInfo.selectedModel,
      baseUrl: keyInfo.baseUrl ?? undefined,
      apiKey: keyInfo.apiKey ?? undefined,
    };
  }

  // 3) 기본값 반환 (프로바이더 키 연결 정보 포함)
  return {
    ...defaultConfig,
    baseUrl: keyInfo?.baseUrl ?? undefined,
    apiKey: keyInfo?.apiKey ?? undefined,
  };
}

/**
 * 전체 12개 모듈의 AI 모델 설정 반환
 * DB 설정을 MODULE_MODEL_MAP에 머지하여 반환
 */
export async function getAllModelSettings(): Promise<
  Array<{ moduleName: string; provider: AIProvider; model: string; isCustom: boolean }>
> {
  const db = getDb();
  const dbSettings = await db.select().from(modelSettings);

  // DB 설정을 맵으로 변환
  const dbMap = new Map(
    dbSettings.map((s) => [s.moduleName, { provider: s.provider as AIProvider, model: s.model }]),
  );

  // MODULE_MODEL_MAP의 모든 모듈에 대해 설정 반환
  return Object.entries(MODULE_MODEL_MAP).map(([moduleName, defaultConfig]) => {
    const custom = dbMap.get(moduleName);
    if (custom) {
      return { moduleName, provider: custom.provider, model: custom.model, isCustom: true };
    }
    return { moduleName, ...defaultConfig, isCustom: false };
  });
}

/**
 * 모듈의 AI 모델 설정 저장 (upsert)
 */
export async function upsertModelSetting(
  moduleName: string,
  provider: AIProvider,
  model: string,
): Promise<{ moduleName: string; provider: AIProvider; model: string }> {
  const db = getDb();
  const [result] = await db
    .insert(modelSettings)
    .values({ moduleName, provider, model, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: modelSettings.moduleName,
      set: { provider, model, updatedAt: new Date() },
    })
    .returning({
      moduleName: modelSettings.moduleName,
      provider: modelSettings.provider,
      model: modelSettings.model,
    });

  return {
    moduleName: result.moduleName,
    provider: result.provider as AIProvider,
    model: result.model,
  };
}
