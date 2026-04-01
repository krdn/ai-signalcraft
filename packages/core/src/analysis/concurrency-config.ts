// 병렬처리 동시성 설정 — 프리셋 + DB 기반 CRUD
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { concurrencySettings } from '../db/schema/settings';

// --- 타입 ---

export type ConcurrencyPreset = {
  id: string;
  name: string;
  description: string;
  providerConcurrency: Record<string, number>;
  apiConcurrency: number;
  articleBatchSize: number;
  commentBatchSize: number;
};

export type ConcurrencyConfig = {
  providerConcurrency: Record<string, number>;
  apiConcurrency: number;
  articleBatchSize: number;
  commentBatchSize: number;
  activePreset: string | null;
};

// --- 기본값 (폴백, 기존 하드코딩 값과 동일) ---

export const DEFAULT_PROVIDER_CONCURRENCY: Record<string, number> = {
  gemini: 1,
  ollama: 1,
  anthropic: 2,
  openai: 3,
  deepseek: 2,
  xai: 2,
  openrouter: 2,
  custom: 1,
};

const DEFAULT_CONFIG: ConcurrencyConfig = {
  providerConcurrency: DEFAULT_PROVIDER_CONCURRENCY,
  apiConcurrency: 5,
  articleBatchSize: 10,
  commentBatchSize: 50,
  activePreset: 'paid-basic',
};

// --- 프리셋 3종 ---

export const CONCURRENCY_PRESETS: ConcurrencyPreset[] = [
  {
    id: 'free-safe',
    name: '무료 (안전)',
    description: '무료 API 티어에 맞춘 보수적 설정. Rate limit 오류를 최소화합니다.',
    providerConcurrency: {
      gemini: 1,
      ollama: 1,
      anthropic: 1,
      openai: 1,
      deepseek: 1,
      xai: 1,
      openrouter: 1,
      custom: 1,
    },
    apiConcurrency: 2,
    articleBatchSize: 5,
    commentBatchSize: 20,
  },
  {
    id: 'paid-basic',
    name: '유료 기본',
    description: '유료 API Tier 1~2 기준 안정적인 병렬처리. 대부분의 환경에 적합합니다.',
    providerConcurrency: { ...DEFAULT_PROVIDER_CONCURRENCY },
    apiConcurrency: 10,
    articleBatchSize: 20,
    commentBatchSize: 100,
  },
  {
    id: 'paid-max',
    name: '유료 고급',
    description: '유료 API Tier 3+ 환경에서 최대 속도. Rate limit 여유가 충분할 때 사용합니다.',
    providerConcurrency: {
      gemini: 5,
      ollama: 2,
      anthropic: 5,
      openai: 8,
      deepseek: 4,
      xai: 3,
      openrouter: 4,
      custom: 2,
    },
    apiConcurrency: 10,
    articleBatchSize: 20,
    commentBatchSize: 100,
  },
];

// --- CRUD ---

/** DB에서 병렬처리 설정 조회 (없으면 기본값 반환) */
export async function getConcurrencyConfig(): Promise<ConcurrencyConfig> {
  const db = getDb();
  const rows = await db.select().from(concurrencySettings).limit(1);
  if (rows.length === 0) return { ...DEFAULT_CONFIG };

  const row = rows[0];
  return {
    providerConcurrency: row.providerConcurrency,
    apiConcurrency: row.apiConcurrency,
    articleBatchSize: row.articleBatchSize,
    commentBatchSize: row.commentBatchSize,
    activePreset: row.activePreset,
  };
}

/** 병렬처리 설정 저장 (upsert) */
export async function upsertConcurrencyConfig(
  partial: Partial<Omit<ConcurrencyConfig, 'activePreset'>> & { activePreset?: string | null },
): Promise<ConcurrencyConfig> {
  const db = getDb();
  const current = await getConcurrencyConfig();
  const merged: ConcurrencyConfig = {
    providerConcurrency: partial.providerConcurrency ?? current.providerConcurrency,
    apiConcurrency: partial.apiConcurrency ?? current.apiConcurrency,
    articleBatchSize: partial.articleBatchSize ?? current.articleBatchSize,
    commentBatchSize: partial.commentBatchSize ?? current.commentBatchSize,
    activePreset: partial.activePreset !== undefined ? partial.activePreset : null,
  };

  const rows = await db.select({ id: concurrencySettings.id }).from(concurrencySettings).limit(1);

  if (rows.length === 0) {
    await db.insert(concurrencySettings).values({
      providerConcurrency: merged.providerConcurrency,
      apiConcurrency: merged.apiConcurrency,
      articleBatchSize: merged.articleBatchSize,
      commentBatchSize: merged.commentBatchSize,
      activePreset: merged.activePreset,
    });
  } else {
    await db
      .update(concurrencySettings)
      .set({
        providerConcurrency: merged.providerConcurrency,
        apiConcurrency: merged.apiConcurrency,
        articleBatchSize: merged.articleBatchSize,
        commentBatchSize: merged.commentBatchSize,
        activePreset: merged.activePreset,
        updatedAt: new Date(),
      })
      .where(eq(concurrencySettings.id, rows[0].id));
  }

  return merged;
}

/** 프리셋 적용 */
export async function applyConcurrencyPreset(presetId: string): Promise<ConcurrencyConfig> {
  const preset = CONCURRENCY_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`프리셋을 찾을 수 없습니다: ${presetId}`);

  return upsertConcurrencyConfig({
    providerConcurrency: preset.providerConcurrency,
    apiConcurrency: preset.apiConcurrency,
    articleBatchSize: preset.articleBatchSize,
    commentBatchSize: preset.commentBatchSize,
    activePreset: preset.id,
  });
}
