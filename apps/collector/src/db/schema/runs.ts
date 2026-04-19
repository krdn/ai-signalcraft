import { pgTable, text, integer, timestamp, uuid, boolean, index } from 'drizzle-orm/pg-core';
import { keywordSubscriptions } from './subscriptions';

/**
 * collection_runs — 시간축 하이퍼테이블 (apply-hypertables.ts에서 create_hypertable 호출)
 * 복합 PK 없이 시간 컬럼 기준 청크 분할. run_id는 UUID로 논리적 식별.
 */
export const collectionRuns = pgTable(
  'collection_runs',
  {
    time: timestamp('time', { withTimezone: true }).notNull(),
    runId: uuid('run_id').notNull(),
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => keywordSubscriptions.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    status: text('status', { enum: ['running', 'completed', 'blocked', 'failed'] }).notNull(),
    itemsCollected: integer('items_collected').default(0).notNull(),
    itemsNew: integer('items_new').default(0).notNull(),
    blocked: boolean('blocked').default(false).notNull(),
    errorReason: text('error_reason'),
    durationMs: integer('duration_ms'),
    triggerType: text('trigger_type', { enum: ['schedule', 'manual'] }).notNull(),
  },
  (table) => [
    index('collection_runs_subscription_time_idx').on(table.subscriptionId, table.time),
    index('collection_runs_run_id_idx').on(table.runId),
  ],
);

export type CollectionRun = typeof collectionRuns.$inferSelect;
export type NewCollectionRun = typeof collectionRuns.$inferInsert;
