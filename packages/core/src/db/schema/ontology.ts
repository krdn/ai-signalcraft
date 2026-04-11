// 온톨로지 — 분석 결과에서 추출한 엔티티/관계 저장
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { collectionJobs } from './collections';

// 추출된 엔티티 (인물/조직/이슈/키워드/프레임/주장)
export const entities = pgTable(
  'entities',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    jobId: integer('job_id')
      .references(() => collectionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['person', 'organization', 'issue', 'keyword', 'frame', 'claim'],
    }).notNull(),
    normalizedName: text('normalized_name').notNull(),
    metadata: jsonb('metadata').$type<{
      sentiment?: string;
      strength?: number;
      source?: string;
      description?: string;
    }>(),
    mentionCount: integer('mention_count').default(1).notNull(),
    firstSeen: timestamp('first_seen'),
    lastSeen: timestamp('last_seen'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('entities_job_name_type_idx').on(table.jobId, table.normalizedName, table.type),
    index('entities_job_id_idx').on(table.jobId),
    index('entities_type_idx').on(table.type),
  ],
);

// 엔티티 간 관계
export const relations = pgTable(
  'relations',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    jobId: integer('job_id')
      .references(() => collectionJobs.id, { onDelete: 'cascade' })
      .notNull(),
    sourceId: integer('source_id')
      .references(() => entities.id, { onDelete: 'cascade' })
      .notNull(),
    targetId: integer('target_id')
      .references(() => entities.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type', {
      enum: ['supports', 'opposes', 'related', 'causes', 'cooccurs', 'threatens'],
    }).notNull(),
    weight: real('weight').default(0.5).notNull(),
    evidence: jsonb('evidence').$type<{
      excerpt?: string;
      moduleSource?: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('relations_source_target_type_idx').on(table.sourceId, table.targetId, table.type),
    index('relations_job_id_idx').on(table.jobId),
    index('relations_source_id_idx').on(table.sourceId),
    index('relations_target_id_idx').on(table.targetId),
  ],
);
