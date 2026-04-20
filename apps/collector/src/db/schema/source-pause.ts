import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * source_pause_state — 시스템 전역 소스 일시정지. subscriptions.pause와 별개.
 * row 존재 AND resumedAt IS NULL이면 paused 상태. 재개 후에도 row 유지(이력).
 */
export const sourcePauseState = pgTable('source_pause_state', {
  source: text('source').primaryKey(),
  pausedAt: timestamp('paused_at', { withTimezone: true }).notNull(),
  pausedBy: text('paused_by').notNull(),
  reason: text('reason'),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
});

export type SourcePauseRow = typeof sourcePauseState.$inferSelect;
