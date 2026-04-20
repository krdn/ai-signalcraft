import { pgTable, text, timestamp, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';

/**
 * run_retry_links — 재시도 체인 추적. (originalRunId, source) → newRunId.
 * 체인 깊이는 newRunId로 역추적(같은 source의 originalRunId를 따라감).
 */
export const runRetryLinks = pgTable(
  'run_retry_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    originalRunId: uuid('original_run_id').notNull(),
    newRunId: uuid('new_run_id').notNull(),
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('run_retry_links_original_source_uniq').on(table.originalRunId, table.source),
    index('run_retry_links_new_run_idx').on(table.newRunId, table.source),
  ],
);

export type RunRetryLink = typeof runRetryLinks.$inferSelect;
