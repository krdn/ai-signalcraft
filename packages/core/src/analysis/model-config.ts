// 모듈별 AI 모델 설정 조회/저장 (DB 기반 동적 설정)
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { modelSettings, providerKeys } from '../db/schema/settings';
import { decrypt } from '../utils/crypto';
import type { ModuleModelConfig } from '../types/analysis';
import type { AIProvider } from './types';
import { MODULE_MODEL_MAP } from './types';

export type { ModuleModelConfig } from '../types/analysis';

// --- 시나리오 프리셋 ---

export type ModelScenarioPreset = {
  id: string;
  name: string;
  description: string;
  estimatedCost: string;
  modules: Record<string, { provider: AIProvider; model: string }>;
};

export const MODEL_SCENARIO_PRESETS: ModelScenarioPreset[] = [
  {
    id: 'scenario-a',
    name: 'A: 최고 품질',
    description:
      'Stage 1은 Gemini 2.5 Pro, 핵심 전략/시뮬레이션은 Opus 4.6, 나머지 Sonnet 4.6. 분석 품질 최대화.',
    estimatedCost: '~$0.80/실행',
    modules: {
      'macro-view': { provider: 'gemini', model: 'gemini-2.5-pro' },
      segmentation: { provider: 'gemini', model: 'gemini-2.5-pro' },
      'sentiment-framing': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'message-impact': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      'risk-map': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      opportunity: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      strategy: { provider: 'anthropic', model: 'claude-opus-4-6' },
      'final-summary': { provider: 'anthropic', model: 'claude-opus-4-6' },
      'approval-rating': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'frame-war': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'crisis-scenario': { provider: 'anthropic', model: 'claude-opus-4-6' },
      'win-simulation': { provider: 'anthropic', model: 'claude-opus-4-6' },
    },
  },
  {
    id: 'scenario-b',
    name: 'B: 가성비 최적',
    description:
      'Stage 1은 Flash Lite, 심화는 Haiku 4.5, 핵심 전략만 Sonnet 4.6. 기존 대비 43% 추가 절감.',
    estimatedCost: '~$0.20/실행',
    modules: {
      'macro-view': { provider: 'gemini', model: 'gemini-2.5-flash' },
      segmentation: { provider: 'gemini', model: 'gemini-2.5-flash' },
      'sentiment-framing': { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
      'message-impact': { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
      'risk-map': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      opportunity: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      strategy: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'final-summary': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'approval-rating': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      'frame-war': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      'crisis-scenario': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      'win-simulation': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    },
  },
  {
    id: 'scenario-c',
    name: 'C: 초저가 API',
    description: 'Stage 1은 GPT-4.1 Nano($0.05/MTok), Stage 2는 Flash, 최종 요약만 Sonnet 4.6.',
    estimatedCost: '~$0.05/실행',
    modules: {
      'macro-view': { provider: 'openai', model: 'gpt-4.1-nano' },
      segmentation: { provider: 'openai', model: 'gpt-4.1-nano' },
      'sentiment-framing': { provider: 'openai', model: 'gpt-4.1-nano' },
      'message-impact': { provider: 'openai', model: 'gpt-4.1-nano' },
      'risk-map': { provider: 'gemini', model: 'gemini-2.5-flash' },
      opportunity: { provider: 'gemini', model: 'gemini-2.5-flash' },
      strategy: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
      'final-summary': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'approval-rating': { provider: 'gemini', model: 'gemini-2.5-flash' },
      'frame-war': { provider: 'gemini', model: 'gemini-2.5-flash' },
      'crisis-scenario': { provider: 'gemini', model: 'gemini-2.5-flash' },
      'win-simulation': { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    },
  },
  {
    id: 'scenario-d',
    name: 'D: Gemini CLI 무료',
    description:
      'Gemini CLI OAuth로 Stage 1~2 무료 처리, 핵심 전략만 Sonnet 4.6. API 비용 ~80% 절감.',
    estimatedCost: '~$0.12/실행',
    modules: {
      'macro-view': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      segmentation: { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'sentiment-framing': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'message-impact': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'risk-map': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      opportunity: { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      strategy: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'final-summary': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'approval-rating': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      'frame-war': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      'crisis-scenario': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'win-simulation': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    },
  },
  {
    id: 'scenario-e',
    name: 'E: 완전 무료 (Gemini CLI Only)',
    description: 'Gemini CLI로 전체 모듈 처리. API 비용 $0. 일일 쿼터 제한 주의.',
    estimatedCost: '$0.00/실행',
    modules: {
      'macro-view': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      segmentation: { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'sentiment-framing': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'message-impact': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'risk-map': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      opportunity: { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      strategy: { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      'final-summary': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      'approval-rating': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      'frame-war': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      'crisis-scenario': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'win-simulation': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
    },
  },
  {
    id: 'scenario-f',
    name: 'F: Claude CLI + Gemini CLI 혼합',
    description:
      'Claude CLI로 핵심 전략, Gemini CLI로 분류/탐색. 두 CLI 계정 모두 필요. API 비용 $0.',
    estimatedCost: '$0.00/실행',
    modules: {
      'macro-view': { provider: 'gemini-cli', model: 'gemini-2.5-pro' },
      segmentation: { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'sentiment-framing': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'message-impact': { provider: 'gemini-cli', model: 'gemini-2.5-flash' },
      'risk-map': { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
      opportunity: { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
      strategy: { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
      'final-summary': { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
      'approval-rating': { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
      'frame-war': { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
      'crisis-scenario': { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
      'win-simulation': { provider: 'claude-cli', model: 'claude-sonnet-4-6' },
    },
  },
  {
    id: 'scenario-g',
    name: 'G: DeepSeek 혼합',
    description:
      'Stage 1은 DeepSeek Chat(Cache Hit $0.028/MTok), 추론은 Reasoner, 핵심만 Sonnet 4.6.',
    estimatedCost: '~$0.03/실행',
    modules: {
      'macro-view': { provider: 'deepseek', model: 'deepseek-chat' },
      segmentation: { provider: 'deepseek', model: 'deepseek-chat' },
      'sentiment-framing': { provider: 'deepseek', model: 'deepseek-chat' },
      'message-impact': { provider: 'deepseek', model: 'deepseek-chat' },
      'risk-map': { provider: 'deepseek', model: 'deepseek-reasoner' },
      opportunity: { provider: 'deepseek', model: 'deepseek-reasoner' },
      strategy: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'final-summary': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      'approval-rating': { provider: 'deepseek', model: 'deepseek-reasoner' },
      'frame-war': { provider: 'deepseek', model: 'deepseek-reasoner' },
      'crisis-scenario': { provider: 'deepseek', model: 'deepseek-reasoner' },
      'win-simulation': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    },
  },
];

/**
 * 시나리오 프리셋을 적용하여 전체 모듈의 모델 설정을 일괄 변경
 */
export async function applyModelScenario(
  presetId: string,
): Promise<{ updated: number; presetName: string }> {
  const preset = MODEL_SCENARIO_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`알 수 없는 시나리오 프리셋: ${presetId}`);
  }

  const entries = Object.entries(preset.modules);
  await Promise.all(
    entries.map(([moduleName, config]) =>
      upsertModelSetting(moduleName, config.provider, config.model),
    ),
  );

  return { updated: entries.length, presetName: preset.name };
}

/**
 * 프로바이더 타입에 해당하는 활성 프로바이더 키에서 연결 정보를 가져옴
 */
async function getProviderKeyInfo(
  providerType: string,
  targetModel?: string,
): Promise<{ selectedModel: string | null; baseUrl: string | null; apiKey: string | null } | null> {
  const db = getDb();
  const rows = await db
    .select({
      selectedModel: providerKeys.selectedModel,
      baseUrl: providerKeys.baseUrl,
      encryptedKey: providerKeys.encryptedKey,
      availableModels: providerKeys.availableModels,
    })
    .from(providerKeys)
    .where(and(eq(providerKeys.providerType, providerType), eq(providerKeys.isActive, true)));

  if (rows.length === 0) return null;

  // 같은 providerType의 키가 여러 개일 때, targetModel을 제공할 수 있는 키를 우선 선택
  let bestRow = rows[0];
  if (targetModel && rows.length > 1) {
    const match = rows.find((r) => {
      if (r.selectedModel === targetModel) return true;
      const models = r.availableModels as string[] | null;
      return models?.includes(targetModel) ?? false;
    });
    if (match) bestRow = match;
  }

  return {
    selectedModel: bestRow.selectedModel,
    baseUrl: bestRow.baseUrl,
    apiKey: bestRow.encryptedKey ? decrypt(bestRow.encryptedKey) : null,
  };
}

/**
 * 단일 모듈의 AI 모델 설정 조회
 * 우선순위: 1) modelSettings DB → 2) providerKeys.selectedModel → 3) MODULE_MODEL_MAP 기본값
 * 프로바이더 키의 baseUrl/apiKey도 함께 반환하여 gateway에서 올바른 연결 설정 가능
 */
export async function getModuleModelConfig(moduleName: string): Promise<ModuleModelConfig> {
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
    const keyInfo = await getProviderKeyInfo(dbSetting.provider, dbSetting.model);
    const config = {
      provider: dbSetting.provider as AIProvider,
      model: dbSetting.model,
      baseUrl: keyInfo?.baseUrl ?? undefined,
      apiKey: keyInfo?.apiKey ? '***' : undefined,
    };
    console.log(
      `[model-config] ${moduleName}: DB설정 사용 → provider=${config.provider}, model=${config.model}, baseUrl=${config.baseUrl}, hasApiKey=${!!keyInfo?.apiKey}`,
    );
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
