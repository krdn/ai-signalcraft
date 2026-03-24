import { z } from 'zod';

export const CollectionTriggerSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(),  // ISO 8601
  endDate: z.string().datetime(),
  limits: z.object({
    naverArticles: z.number().default(100),
    youtubeVideos: z.number().default(50),
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

export type JobProgress = {
  naver: SourceStatus;
  youtube: SourceStatus;
};
