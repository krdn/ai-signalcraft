import { z } from 'zod';

export const CollectionTriggerSchema = z.object({
  keyword: z.string().min(1),
  startDate: z.string().datetime(), // ISO 8601
  endDate: z.string().datetime(),
  sources: z.array(z.enum(['naver', 'youtube', 'dcinside', 'fmkorea', 'clien'])).optional(),
  // 관리자 UI에서 등록한 동적 data_sources.id 목록 (RSS/HTML)
  customSourceIds: z.array(z.string().uuid()).optional(),
  limits: z
    .object({
      naverArticles: z.number().default(1000),
      youtubeVideos: z.number().default(50),
      communityPosts: z.number().default(50),
      commentsPerItem: z.number().default(500),
    })
    .optional(),
  // TTL 기반 재사용 계획을 무시하고 전량 재수집 (롤백 스위치)
  forceRefetch: z.boolean().optional(),
});
export type CollectionTrigger = z.infer<typeof CollectionTriggerSchema>;

/**
 * collector job data 에 실리는 수집 재사용 계획.
 * flows.ts 의 triggerCollection() 프리스텝에서 planReuse() 결과로 계산되어 주입.
 * 각 collector adapter 는 skipUrls 를 검색 결과에서 제외하고,
 * refetchCommentsFor 에 해당하는 URL 은 본문 fetch 없이 댓글만 수집한다.
 */
export interface ReusePlanPayload {
  skipUrls: string[]; // 본문+댓글 모두 스킵
  refetchCommentsFor: string[]; // 본문은 스킵, 댓글만 새로 수집
}

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
export * from './breakpoints';
