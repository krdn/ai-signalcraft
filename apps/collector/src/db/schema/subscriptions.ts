import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export type SubscriptionLimits = {
  maxPerRun: number;
  maxPerDay?: number;
  commentsPerItem?: number;
};

export type SubscriptionOptions = {
  collectTranscript?: boolean;
  includeComments?: boolean;
  enableManipulation?: boolean;
};

export const keywordSubscriptions = pgTable(
  'keyword_subscriptions',
  {
    id: serial('id').primaryKey(),
    keyword: text('keyword').notNull(),
    sources: text('sources').array().notNull(),
    intervalHours: integer('interval_hours').notNull().default(6),
    status: text('status', { enum: ['active', 'paused', 'error'] })
      .notNull()
      .default('active'),
    limits: jsonb('limits').$type<SubscriptionLimits>().notNull(),
    options: jsonb('options').$type<SubscriptionOptions>(),
    domain: text('domain'),
    ownerId: text('owner_id'),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('keyword_subscriptions_keyword_owner_uniq').on(table.keyword, table.ownerId),
    index('keyword_subscriptions_status_next_run_idx').on(table.status, table.nextRunAt),
  ],
);

export type KeywordSubscription = typeof keywordSubscriptions.$inferSelect;
export type NewKeywordSubscription = typeof keywordSubscriptions.$inferInsert;
