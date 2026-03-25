import { pgTable, text, timestamp, integer, uniqueIndex, boolean } from 'drizzle-orm/pg-core';

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
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
