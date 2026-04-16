import { pgTable, text, timestamp, integer, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { teams, users } from './auth';
import { collectionJobs } from './collections';

export const analysisSeries = pgTable(
  'analysis_series',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer('team_id').references(() => teams.id),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    keyword: text('keyword').notNull(),
    domain: text('domain').notNull().default('political'),
    title: text('title'),
    status: text('status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    metadata: jsonb('metadata').$type<{
      totalJobs: number;
      lastJobId: number | null;
      lastAnalyzedAt: string | null;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('analysis_series_team_keyword_idx').on(table.teamId, table.keyword),
    index('analysis_series_user_id_idx').on(table.userId),
  ],
);

export const seriesDeltaResults = pgTable(
  'series_delta_results',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    seriesId: integer('series_id')
      .references(() => analysisSeries.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: integer('job_id')
      .references(() => collectionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    previousJobId: integer('previous_job_id').references(() => collectionJobs.id, {
      onDelete: 'set null',
    }),
    quantitativeDelta: jsonb('quantitative_delta'),
    qualitativeInterpretation: jsonb('qualitative_interpretation'),
    usage: jsonb('usage').$type<{
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      provider: string;
      model: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('series_delta_job_idx').on(table.seriesId, table.jobId),
    index('series_delta_series_idx').on(table.seriesId),
  ],
);
