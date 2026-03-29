import { z } from 'zod';

export const CollectionTriggerSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(),  // ISO 8601
  endDate: z.string().datetime(),
  sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).optional(),
  limits: z.object({
    naverArticles: z.number().default(500),
    youtubeVideos: z.number().default(50),
    communityPosts: z.number().default(50),
    commentsPerItem: z.number().default(500),
  }).optional(),
});
export type CollectionTrigger = z.infer<typeof CollectionTriggerSchema>;

export type SourceStatus = {
  status: 'pending' | 'running' | 'completed' | 'failed';
  articles?: number;
  comments?: number;
  videos?: number;
  error?: string;
};

export type JobProgress = Record<string, SourceStatus>;

export * from './analysis';
export * from './report';
export * from './pipeline';
