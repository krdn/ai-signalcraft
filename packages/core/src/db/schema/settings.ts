import { pgTable, text, timestamp, integer, uniqueIndex, boolean, jsonb } from 'drizzle-orm/pg-core';

// 모듈별 AI 모델 설정 (DB 기반 동적 설정)
export const modelSettings = pgTable('model_settings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  moduleName: text('module_name').notNull(),
  provider: text('provider').notNull(),  // 'anthropic' | 'openai'
  model: text('model').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('model_settings_module_name_idx').on(table.moduleName),
]);

// 병렬처리 동시성 설정 (singleton row)
export const concurrencySettings = pgTable('concurrency_settings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  // 프로바이더별 동시성 한도 (예: {"openai":3,"anthropic":2,"gemini":1})
  providerConcurrency: jsonb('provider_concurrency').$type<Record<string, number>>().notNull(),
  // 개별 항목 분석 동시 API 호출 수
  apiConcurrency: integer('api_concurrency').notNull().default(5),
  // 기사 배치 크기
  articleBatchSize: integer('article_batch_size').notNull().default(10),
  // 댓글 배치 크기
  commentBatchSize: integer('comment_batch_size').notNull().default(50),
  // 현재 적용된 프리셋 ID (커스텀이면 null)
  activePreset: text('active_preset'),
  // 수집 한도 기본값 (트리거 폼 초기값)
  collectionLimits: jsonb('collection_limits').$type<CollectionLimits>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 수집 한도 타입
export type CollectionLimits = {
  naverArticles: number;
  youtubeVideos: number;
  communityPosts: number;
  commentsPerItem: number;
};

// AI 프로바이더 API 키 관리
export const providerKeys = pgTable('provider_keys', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  providerName: text('provider_name').notNull(),   // 'OpenAI (ChatGPT)', 'Anthropic (Claude)' 등
  providerType: text('provider_type').notNull(),    // 'openai', 'anthropic', 'gemini', 'ollama', 'deepseek', 'xai', 'openrouter', 'custom'
  name: text('name').notNull(),                     // 사용자 지정 이름
  encryptedKey: text('encrypted_key'),              // AES-256-GCM 암호화된 API 키 (Ollama는 null 가능)
  maskedKey: text('masked_key'),                    // 'sk-...xxx' 형태
  baseUrl: text('base_url'),                        // 커스텀 엔드포인트
  selectedModel: text('selected_model'),            // Test & Select로 선택한 기본 모델
  availableModels: jsonb('available_models').$type<string[]>(), // Test 시 조회된 전체 모델 목록
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
