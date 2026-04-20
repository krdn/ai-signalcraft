import { pgTable, text, integer, timestamp, jsonb, uuid, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { vector384 } from '../types/vector';

export type ItemMetrics = {
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
};

/**
 * raw_items — 원본 저장 하이퍼테이블 (시간축: time = publishedAt 또는 fetchedAt)
 * UNIQUE(source, source_id, item_type)로 중복 방지
 * compression 7일, retention 1년은 apply-hypertables.ts에서 정책 설정
 */
export const rawItems = pgTable(
  'raw_items',
  {
    time: timestamp('time', { withTimezone: true }).notNull(),
    subscriptionId: integer('subscription_id').notNull(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    itemType: text('item_type', { enum: ['article', 'video', 'comment'] }).notNull(),
    url: text('url'),
    title: text('title'),
    content: text('content'),
    author: text('author'),
    publisher: text('publisher'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    parentSourceId: text('parent_source_id'),
    metrics: jsonb('metrics').$type<ItemMetrics>(),
    rawPayload: jsonb('raw_payload').notNull(),
    embedding: vector384('embedding'),
    fetchedFromRun: uuid('fetched_from_run'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('raw_items_subscription_time_idx').on(table.subscriptionId, table.time),
    index('raw_items_source_source_id_idx').on(table.source, table.sourceId, table.itemType),
    index('raw_items_parent_idx').on(table.parentSourceId),
    // partial: fetched_from_run은 대부분 NULL. Layer A COUNT 쿼리를 index-only scan으로 처리 (Task 0 EXPLAIN 확인)
    index('raw_items_fetched_from_run_idx')
      .on(table.fetchedFromRun)
      .where(sql`${table.fetchedFromRun} IS NOT NULL`),
  ],
);

export type RawItem = typeof rawItems.$inferSelect;
export type NewRawItem = typeof rawItems.$inferInsert;
