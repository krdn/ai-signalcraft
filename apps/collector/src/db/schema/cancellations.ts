import { pgTable, text, timestamp, uuid, index, primaryKey } from 'drizzle-orm/pg-core';

/**
 * run_cancellations — per-(runId, source) 중지 요청 상태.
 * collection_runs(하이퍼테이블) UPDATE 비용을 피하기 위한 보완 테이블.
 * worker 체크포인트는 이 테이블의 status를 읽어 진행을 중단한다.
 */
export const runCancellations = pgTable(
  'run_cancellations',
  {
    runId: uuid('run_id').notNull(),
    source: text('source').notNull(),
    status: text('status', { enum: ['cancelling', 'cancelled'] }).notNull(),
    mode: text('mode', { enum: ['graceful', 'force'] }).notNull(),
    triggeredBy: text('triggered_by').notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.source] }),
    index('run_cancellations_status_idx').on(table.status),
  ],
);

export type RunCancellation = typeof runCancellations.$inferSelect;
export type NewRunCancellation = typeof runCancellations.$inferInsert;
