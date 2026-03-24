import { pgTable, text, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { collectionJobs } from './collections';

// D-06: 분석 결과 (모듈별)
export const analysisResults = pgTable('analysis_results', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id).notNull(),
  module: text('module').notNull(),  // 'macro-view', 'segmentation', 등
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed'],
  }).notNull().default('pending'),
  result: jsonb('result'),           // 모듈별 Zod 스키마로 타입 보장
  usage: jsonb('usage').$type<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    provider: string;
    model: string;
  }>(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('analysis_results_job_module_idx').on(table.jobId, table.module),
]);

// D-07: 종합 분석 리포트
export const analysisReports = pgTable('analysis_reports', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id).notNull(),
  title: text('title').notNull(),
  markdownContent: text('markdown_content').notNull(),
  oneLiner: text('one_liner'),       // REPT-02: 한 줄 요약
  metadata: jsonb('metadata').$type<{
    keyword: string;
    dateRange: { start: string; end: string };
    modulesCompleted: string[];
    modulesFailed: string[];
    totalTokens: number;
    generatedAt: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
