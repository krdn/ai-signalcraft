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

export const analysisPresets = pgTable(
  'analysis_presets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').unique().notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    icon: text('icon').notNull(),
    highlight: text('highlight'),
    sortOrder: integer('sort_order').notNull().default(0),
    sources: jsonb('sources').notNull().$type<Record<string, boolean>>(),
    customSourceIds: jsonb('custom_source_ids').notNull().$type<string[]>().default([]),
    limits: jsonb('limits').notNull().$type<{
      naverArticles: number;
      youtubeVideos: number;
      communityPosts: number;
      commentsPerItem: number;
    }>(),
    optimization: text('optimization', {
      enum: ['none', 'light', 'standard', 'aggressive'],
    })
      .notNull()
      .default('standard'),
    skippedModules: jsonb('skipped_modules').notNull().$type<string[]>().default([]),
    enableItemAnalysis: boolean('enable_item_analysis').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('analysis_presets_enabled_idx').on(table.enabled),
    index('analysis_presets_category_idx').on(table.category),
  ],
);

export type AnalysisPreset = typeof analysisPresets.$inferSelect;
export type NewAnalysisPreset = typeof analysisPresets.$inferInsert;
