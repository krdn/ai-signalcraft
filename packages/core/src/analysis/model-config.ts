// 모듈별 AI 모델 설정 조회/저장 (DB 기반 동적 설정)
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { modelSettings } from '../db/schema/settings';
import type { AIProvider } from './types';
import { MODULE_MODEL_MAP } from './types';

/**
 * 단일 모듈의 AI 모델 설정 조회
 * DB에 설정이 있으면 DB 값, 없으면 MODULE_MODEL_MAP 기본값 반환
 */
export async function getModuleModelConfig(
  moduleName: string,
): Promise<{ provider: AIProvider; model: string }> {
  const db = getDb();
  const [dbSetting] = await db
    .select({
      provider: modelSettings.provider,
      model: modelSettings.model,
    })
    .from(modelSettings)
    .where(eq(modelSettings.moduleName, moduleName))
    .limit(1);

  if (dbSetting) {
    return {
      provider: dbSetting.provider as AIProvider,
      model: dbSetting.model,
    };
  }

  // DB에 없으면 기본값 반환
  const defaultConfig = MODULE_MODEL_MAP[moduleName];
  if (!defaultConfig) {
    throw new Error(`알 수 없는 모듈: ${moduleName}`);
  }
  return defaultConfig;
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
