import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';

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
