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
  // 수집 한도 해석 방식. 'perDay' = 입력값을 날짜별 한도로 보고 수집기에는 (값 × 일수)를 전달.
  // 'total' = 기간 전체 총량으로 해석. 미지정 시 'total'로 폴백하여 기존 잡과 하위 호환.
  // commentsPerItem은 항목당 한도라 이 플래그의 영향을 받지 않음.
  limitMode: z.enum(['perDay', 'total']).optional(),
  // TTL 기반 재사용 계획을 무시하고 전량 재수집 (롤백 스위치)
  forceRefetch: z.boolean().optional(),
  // YouTube 영상 자막 수집 여부 (기본: false)
  collectTranscript: z.boolean().optional(),
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
