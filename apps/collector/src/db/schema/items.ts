import { pgTable, text, integer, timestamp, jsonb, uuid, index, real } from 'drizzle-orm/pg-core';
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
 *
 * 하이퍼테이블은 UNIQUE 제약에 시간 컬럼을 반드시 포함해야 하므로,
 * 논리적 중복 방지용 UNIQUE INDEX (source, source_id, item_type, time)는
 * apply-hypertables.ts의 `raw_items_dedup_uniq`가 관리한다 (Drizzle 스키마로는 표현 불가).
 * 아래 index()들은 조회 성능용이며, 반드시 `db:migrate-timescale`을 실행해야
 * executor의 `onConflictDoNothing(target: [source, source_id, item_type, time])`가 동작한다.
 * compression 7일, retention 1년도 동일 스크립트에서 정책 설정.
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
    sentiment: text('sentiment'), // 'positive' | 'negative' | 'neutral' | NULL
    sentimentScore: real('sentiment_score'), // 0~1 확신도, NULL
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
