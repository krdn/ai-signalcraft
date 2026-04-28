import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  real,
  uuid,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { collectionJobs } from './collections';

export const SIGNAL_TYPES = [
  'burst',
  'similarity',
  'vote',
  'media-sync',
  'trend-shape',
  'cross-platform',
  'temporal',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SEVERITY = ['low', 'medium', 'high'] as const;
export type Severity = (typeof SEVERITY)[number];

export const manipulationRuns = pgTable(
  'manipulation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: integer('job_id')
      .references(() => collectionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    subscriptionId: integer('subscription_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status', { enum: ['running', 'completed', 'failed'] })
      .notNull()
      .default('running'),
    manipulationScore: real('manipulation_score'),
    confidenceFactor: real('confidence_factor'),
    weightsVersion: text('weights_version').notNull().default('v1-political'),
    signalScores: jsonb('signal_scores').$type<Partial<Record<SignalType, number>>>(),
    narrativeMd: text('narrative_md'),
    errorDetails: jsonb('error_details').$type<{ message?: string; stack?: string }>(),
  },
  (table) => [
    index('manipulation_runs_subscription_idx').on(table.subscriptionId, table.startedAt),
    index('manipulation_runs_job_idx').on(table.jobId),
  ],
);

export const manipulationSignals = pgTable(
  'manipulation_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .references(() => manipulationRuns.id, { onDelete: 'cascade' })
      .notNull(),
    signal: text('signal', { enum: SIGNAL_TYPES }).notNull(),
    score: real('score').notNull(),
    confidence: real('confidence').notNull(),
    metrics: jsonb('metrics').$type<Record<string, number>>().notNull(),
    computeMs: integer('compute_ms').notNull(),
  },
  (table) => [uniqueIndex('manipulation_signals_run_signal_idx').on(table.runId, table.signal)],
);

export const manipulationEvidence = pgTable(
  'manipulation_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .references(() => manipulationRuns.id, { onDelete: 'cascade' })
      .notNull(),
    signal: text('signal', { enum: SIGNAL_TYPES }).notNull(),
    severity: text('severity', { enum: SEVERITY }).notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    visualization: jsonb('visualization').$type<Record<string, unknown>>().notNull(),
    rawRefs: jsonb('raw_refs')
      .$type<{ itemId: string; source: string; time: string; excerpt: string }[]>()
      .notNull(),
    rank: integer('rank').notNull(),
  },
  (table) => [
    index('manipulation_evidence_run_rank_idx').on(table.runId, table.severity, table.rank),
    index('manipulation_evidence_raw_refs_gin').using('gin', table.rawRefs),
  ],
);

export const manipulationDomainConfigs = pgTable('manipulation_domain_configs', {
  domain: text('domain').primaryKey(),
  weights: jsonb('weights').$type<Record<SignalType, number>>().notNull(),
  thresholds: jsonb('thresholds')
    .$type<Record<SignalType, { medium: number; high: number }>>()
    .notNull(),
  baselineDays: integer('baseline_days').notNull().default(30),
  narrativeContext: text('narrative_context').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ManipulationRun = typeof manipulationRuns.$inferSelect;
export type NewManipulationRun = typeof manipulationRuns.$inferInsert;
export type ManipulationSignal = typeof manipulationSignals.$inferSelect;
export type NewManipulationSignal = typeof manipulationSignals.$inferInsert;
export type ManipulationEvidence = typeof manipulationEvidence.$inferSelect;
export type NewManipulationEvidence = typeof manipulationEvidence.$inferInsert;
export type ManipulationDomainConfig = typeof manipulationDomainConfigs.$inferSelect;
export type NewManipulationDomainConfig = typeof manipulationDomainConfigs.$inferInsert;

// manipulation 알림 규칙 — 구독 단위, score 임계값 + cooldown + Slack/webhook 채널
// 주의: keyword_subscriptions(collector DB)는 별도 schema라 FK 불가.
// manipulation_runs.subscription_id와 동일하게 단순 integer로 보관.
export const manipulationAlertRules = pgTable(
  'manipulation_alert_rules',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    subscriptionId: integer('subscription_id').notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),

    scoreThreshold: real('score_threshold').notNull(),
    cooldownMinutes: integer('cooldown_minutes').notNull().default(360),

    channel: jsonb('channel')
      .$type<
        | { type: 'slack'; webhookUrl: string }
        | { type: 'webhook'; url: string; headers?: Record<string, string> }
      >()
      .notNull(),

    lastTriggeredAt: timestamp('last_triggered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('manipulation_alert_rules_subscription_idx').on(table.subscriptionId),
    index('manipulation_alert_rules_enabled_idx').on(table.enabled),
  ],
);

export type ManipulationAlertRule = typeof manipulationAlertRules.$inferSelect;
export type NewManipulationAlertRule = typeof manipulationAlertRules.$inferInsert;
