import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './auth';

// 배포 단위 (GitHub Actions 1회 = 1 release)
export const releases = pgTable(
  'releases',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    version: text('version').notNull().unique(), // YYYY.MM.DD-N (예: 2026.04.09-1)
    deployedAt: timestamp('deployed_at').defaultNow().notNull(),
    gitShaFrom: text('git_sha_from').notNull(), // 이전 release의 gitShaTo
    gitShaTo: text('git_sha_to').notNull().unique(), // github.sha
    summary: text('summary'), // AI 생성 한 줄 요약
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('draft'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    publishedAt: timestamp('published_at'),
  },
  (table) => [
    index('releases_status_idx').on(table.status),
    index('releases_deployed_at_idx').on(table.deployedAt),
  ],
);

// Release 내 개별 변경 항목 (커밋 단위 또는 AI 재구성 단위)
export const releaseEntries = pgTable(
  'release_entries',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    releaseId: integer('release_id')
      .references(() => releases.id, { onDelete: 'cascade' })
      .notNull(),
    category: text('category', {
      enum: ['feature', 'fix', 'pipeline', 'chore', 'breaking'],
    }).notNull(),
    scope: text('scope', { enum: ['user', 'internal'] }).notNull(),
    title: text('title').notNull(), // AI 생성 사용자 친화 제목
    description: text('description'), // AI 생성 상세
    originalMessage: text('original_message').notNull(), // 원본 커밋 메시지
    commitSha: text('commit_sha').notNull(),
    authorName: text('author_name'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('release_entries_release_id_idx').on(table.releaseId)],
);

// 비개발자 기능 제안
export const featureRequests = pgTable(
  'feature_requests',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category', {
      enum: ['feature', 'improvement', 'bug', 'other'],
    }).notNull(),
    status: text('status', {
      enum: ['pending', 'reviewing', 'accepted', 'rejected', 'shipped'],
    })
      .notNull()
      .default('pending'),
    submittedBy: text('submitted_by')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    adminNote: text('admin_note'),
    linkedReleaseEntryId: integer('linked_release_entry_id').references(() => releaseEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('feature_requests_status_idx').on(table.status),
    index('feature_requests_submitted_by_idx').on(table.submittedBy),
  ],
);

// 사용자별 Release 읽음 추적 (배지용)
export const userReleaseViews = pgTable('user_release_views', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastViewedReleaseId: integer('last_viewed_release_id').references(() => releases.id, {
    onDelete: 'set null',
  }),
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
});

export type Release = typeof releases.$inferSelect;
export type NewRelease = typeof releases.$inferInsert;
export type ReleaseEntry = typeof releaseEntries.$inferSelect;
export type NewReleaseEntry = typeof releaseEntries.$inferInsert;
export type FeatureRequest = typeof featureRequests.$inferSelect;
export type NewFeatureRequest = typeof featureRequests.$inferInsert;
export type UserReleaseView = typeof userReleaseViews.$inferSelect;
export type NewUserReleaseView = typeof userReleaseViews.$inferInsert;
