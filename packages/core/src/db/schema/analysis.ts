import { pgTable, text, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { collectionJobs } from './collections';

// D-06: 분석 결과 (모듈별)
export const analysisResults = pgTable(
  'analysis_results',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    jobId: integer('job_id')
      .references(() => collectionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    module: text('module').notNull(), // 'macro-view', 'segmentation', 등
    status: text('status', {
      enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
    })
      .notNull()
      .default('pending'),
    result: jsonb('result'), // 모듈별 Zod 스키마로 타입 보장
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
  },
  (table) => [uniqueIndex('analysis_results_job_module_idx').on(table.jobId, table.module)],
);

// D-07: 종합 분석 리포트
export const analysisReports = pgTable(
  'analysis_reports',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    jobId: integer('job_id')
      .references(() => collectionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    markdownContent: text('markdown_content').notNull(),
    oneLiner: text('one_liner'), // REPT-02: 한 줄 요약
    metadata: jsonb('metadata').$type<{
      keyword: string;
      dateRange: { start: string; end: string };
      modulesCompleted: string[];
      modulesFailed: string[];
      totalTokens: number;
      reportModel?: { provider: string; model: string };
      generatedAt: string;
      // Phase 3 신규 필드 — quality-metadata 빌더가 채움 (선택적: fallback 리포트에는 없을 수 있음)
      modulesPartial?: Array<{
        module: string;
        reason: 'rate-limit' | 'parse-error' | 'unknown';
        chunksTotal: number | null;
        chunksFailed: number | null;
      }>;
      warnings?: Array<{
        ts: string;
        phase: string | null;
        module: string | null;
        level: 'warn';
        msg: string;
      }>;
      qualityFlags?: {
        hasRateLimitFailures: boolean;
        hasPartialModules: boolean;
        samplingShallow: boolean;
      };
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('analysis_reports_job_id_idx').on(table.jobId)],
);
