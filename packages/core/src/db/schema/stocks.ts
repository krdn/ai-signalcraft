import { pgTable, integer, text, timestamp, jsonb, numeric } from 'drizzle-orm/pg-core';

// D-XX: 주식 분석 이력 (tickerlens 위젯)
export const stockAnalyses = pgTable('stock_analyses', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  requestedBy: text('requested_by').notNull(), // 실행자 (표시용, 격리 아님)
  ticker: text('ticker').notNull(),
  depth: text('depth').notNull(), // 'full' | 'lite'
  asOf: timestamp('as_of').notNull(),
  result: jsonb('result').notNull(), // tickerlens AnalysisResult 전체
  costUsd: numeric('cost_usd'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
