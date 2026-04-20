import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core';

export type LayerAPayload = {
  runId: string;
  source: string;
  jobId: string;
  bullState: string;
  attemptsMade: number;
  attemptsMax: number;
  failedReason: string | null;
  jobTimestampMs: number | null;
  processedOnMs: number | null;
  finishedOnMs: number | null;
  partialRawItemsCount: number;
  partialRawItemsByType: { article: number; video: number; comment: number };
  fetchErrorsCount: number;
  lastFetchError: string | null;
  collectionRunsRow: {
    status: string;
    itemsCollected: number;
    durationMs: number | null;
    blocked: boolean;
  } | null;
  subscription: { id: number; keyword: string; status: string } | null;
};

export type LayerBPayload = {
  source: string;
  last24h: { total: number; completed: number; failed: number; blocked: number; failRate: number };
  consecutiveFailures: number;
  selectorChangeSuspected: boolean;
  rateLimitHits: number;
  lastSuccessAt: string | null;
};

export type LayerCPayload = {
  redis: { ping: 'ok' | 'fail'; latencyMs: number };
  db: { ping: 'ok' | 'fail'; latencyMs: number };
  queues: Record<
    string,
    {
      workerCount: number;
      workers: Array<{ id: string; addr: string; idleMs: number }>;
      counts: { waiting: number; active: number; delayed: number; failed: number; paused: number };
      isPaused: boolean;
    }
  >;
  processMemMB: number;
};

export const runDiagnostics = pgTable(
  'run_diagnostics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    runId: uuid('run_id').notNull(),
    source: text('source'), // null = run 전체 대상 (source 미지정)
    triggeredBy: text('triggered_by', {
      enum: ['user_cancel', 'auto_stall', 'manual', 'failure_hook'],
    }).notNull(),
    layerA: jsonb('layer_a').$type<LayerAPayload>().notNull(),
    layerB: jsonb('layer_b').$type<LayerBPayload>(), // 비동기 수집, 미완성 시 null
    layerC: jsonb('layer_c').$type<LayerCPayload>(), // 비동기 수집, 미완성 시 null
    layerAAt: timestamp('layer_a_at', { withTimezone: true }).defaultNow().notNull(),
    layerBAt: timestamp('layer_b_at', { withTimezone: true }),
    layerCAt: timestamp('layer_c_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('run_diagnostics_run_source_idx').on(table.runId, table.source),
    index('run_diagnostics_created_idx').on(table.createdAt),
  ],
);

export type RunDiagnostic = typeof runDiagnostics.$inferSelect;
export type NewRunDiagnostic = typeof runDiagnostics.$inferInsert;
