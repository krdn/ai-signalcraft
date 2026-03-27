import { pgTable, text, timestamp, integer, jsonb, uniqueIndex, real, index } from 'drizzle-orm/pg-core';
import { teams } from './auth';

// 수집 작업 (D-06: 소스별 상세 추적)
export const collectionJobs = pgTable('collection_jobs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer('team_id').references(() => teams.id),
  keyword: text('keyword').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'partial_failure', 'failed', 'cancelled', 'paused'],
  }).notNull().default('pending'),
  progress: jsonb('progress').$type<
    Record<string, { status: string; posts?: number; articles?: number; videos?: number; comments: number }>
  >(),
  limits: jsonb('limits').$type<{
    naverArticles: number;
    youtubeVideos: number;
    communityPosts?: number;
    commentsPerItem: number;
  }>(),
  errorDetails: jsonb('error_details').$type<Record<string, string>>(),
  costLimitUsd: real('cost_limit_usd'),  // 비용 한도 (USD) — 초과 시 자동 중지
  skippedModules: jsonb('skipped_modules').$type<string[]>(),  // 스킵할 분석 모듈 목록
  options: jsonb('options').$type<{
    enableItemAnalysis?: boolean;  // 개별 기사/댓글 감정 분석 활성화
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 뉴스 기사 (D-07: URL 기반 중복 제거)
export const articles = pgTable('articles', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  author: text('author'),
  publisher: text('publisher'),
  publishedAt: timestamp('published_at'),
  sentiment: text('sentiment'),  // 개별 감정 분석 결과: positive | negative | neutral
  sentimentScore: real('sentiment_score'),  // 감정 확신도 (0~1)
  summary: text('summary'),  // AI 한 줄 요약
  rawData: jsonb('raw_data'),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('articles_source_id_idx').on(table.source, table.sourceId),
]);

// 영상 (유튜브)
export const videos = pgTable('videos', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  channelId: text('channel_id'),
  channelTitle: text('channel_title'),
  viewCount: integer('view_count'),
  likeCount: integer('like_count'),
  commentCount: integer('comment_count'),
  publishedAt: timestamp('published_at'),
  rawData: jsonb('raw_data'),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('videos_source_id_idx').on(table.source, table.sourceId),
]);

// 댓글 (네이버 + 유튜브 통합, D-07)
export const comments = pgTable('comments', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer('job_id').references(() => collectionJobs.id),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  parentId: text('parent_id'),
  articleId: integer('article_id').references(() => articles.id),
  videoId: integer('video_id').references(() => videos.id),
  content: text('content').notNull(),
  author: text('author'),
  likeCount: integer('like_count').default(0),
  dislikeCount: integer('dislike_count').default(0),
  publishedAt: timestamp('published_at'),
  sentiment: text('sentiment'),  // 개별 감정 분석 결과: positive | negative | neutral
  sentimentScore: real('sentiment_score'),  // 감정 확신도 (0~1)
  rawData: jsonb('raw_data'),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('comments_source_id_idx').on(table.source, table.sourceId),
]);

// N:M 조인 테이블 — 기사/영상/댓글이 여러 수집 작업에서 참조 가능
export const articleJobs = pgTable('article_jobs', {
  articleId: integer('article_id').references(() => articles.id, { onDelete: 'cascade' }).notNull(),
  jobId: integer('job_id').references(() => collectionJobs.id, { onDelete: 'cascade' }).notNull(),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('article_jobs_pk').on(table.articleId, table.jobId),
  index('article_jobs_job_id_idx').on(table.jobId),
]);

export const videoJobs = pgTable('video_jobs', {
  videoId: integer('video_id').references(() => videos.id, { onDelete: 'cascade' }).notNull(),
  jobId: integer('job_id').references(() => collectionJobs.id, { onDelete: 'cascade' }).notNull(),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('video_jobs_pk').on(table.videoId, table.jobId),
  index('video_jobs_job_id_idx').on(table.jobId),
]);

export const commentJobs = pgTable('comment_jobs', {
  commentId: integer('comment_id').references(() => comments.id, { onDelete: 'cascade' }).notNull(),
  jobId: integer('job_id').references(() => collectionJobs.id, { onDelete: 'cascade' }).notNull(),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('comment_jobs_pk').on(table.commentId, table.jobId),
  index('comment_jobs_job_id_idx').on(table.jobId),
]);
