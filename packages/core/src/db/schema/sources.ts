import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

// 동적 데이터 소스 (v1: rss, html / v2: youtube-channel, community-instance 확장 예정)
export const dataSources = pgTable(
  'data_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(), // 표시명 ("한겨레 RSS")
    // enum 제한은 현재 v1 범위. v2에서 youtube-channel, community 추가 예정
    adapterType: text('adapter_type', {
      enum: ['rss', 'html'],
    }).notNull(),
    url: text('url').notNull(),
    // 어댑터별 자유 스키마. HTML: { selectors: { item, title, link, body?, date? } }, RSS: {}
    config: jsonb('config').$type<Record<string, unknown>>(),
    enabled: boolean('enabled').notNull().default(true),
    defaultLimit: integer('default_limit').notNull().default(50),
    lastCollectedAt: timestamp('last_collected_at'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('data_sources_enabled_idx').on(table.enabled),
    index('data_sources_adapter_type_idx').on(table.adapterType),
  ],
);

export type DataSource = typeof dataSources.$inferSelect;
export type NewDataSource = typeof dataSources.$inferInsert;
