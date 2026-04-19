import { pgTable, text, integer, timestamp, boolean, index } from 'drizzle-orm/pg-core';

/**
 * fetch_errors — 차단·파싱·타임아웃 등 수집 오류 시계열 로그
 */
export const fetchErrors = pgTable(
  'fetch_errors',
  {
    time: timestamp('time', { withTimezone: true }).notNull(),
    subscriptionId: integer('subscription_id'),
    source: text('source').notNull(),
    errorType: text('error_type', {
      enum: ['blocked', 'rate_limit', 'parse', 'timeout', 'other'],
    }).notNull(),
    errorMessage: text('error_message'),
    httpStatus: integer('http_status'),
    url: text('url'),
    recovered: boolean('recovered').default(false).notNull(),
  },
  (table) => [
    index('fetch_errors_source_time_idx').on(table.source, table.time),
    index('fetch_errors_type_time_idx').on(table.errorType, table.time),
  ],
);

export type FetchError = typeof fetchErrors.$inferSelect;
export type NewFetchError = typeof fetchErrors.$inferInsert;
