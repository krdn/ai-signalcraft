import { describe, it, expect } from 'vitest';
import type {
  RefetchCommentSpec,
  RefetchCommentSpecVideo,
  ArticleReusePlan,
  VideoReusePlan,
} from '../reuse-planner';

describe('reuse-planner refetch spec 타입', () => {
  it('RefetchCommentSpec은 url/articleId/lastCommentsFetchedAt을 가진다', () => {
    const spec: RefetchCommentSpec = {
      url: 'https://example.com/a/1',
      articleId: 42,
      lastCommentsFetchedAt: new Date('2026-04-20T10:00:00Z'),
    };
    expect(spec.url).toBe('https://example.com/a/1');
    expect(spec.articleId).toBe(42);
    expect(spec.lastCommentsFetchedAt?.toISOString()).toBe('2026-04-20T10:00:00.000Z');
  });

  it('RefetchCommentSpec의 lastCommentsFetchedAt은 null을 허용한다', () => {
    const spec: RefetchCommentSpec = {
      url: 'https://example.com/a/1',
      articleId: 42,
      lastCommentsFetchedAt: null,
    };
    expect(spec.lastCommentsFetchedAt).toBeNull();
  });

  it('ArticleReusePlan.refetchCommentsFor는 RefetchCommentSpec 배열이다', () => {
    const plan: ArticleReusePlan = {
      reuseArticleIds: [1, 2],
      skipUrls: ['https://example.com/a/1'],
      refetchCommentsFor: [
        { url: 'https://example.com/a/2', articleId: 2, lastCommentsFetchedAt: null },
      ],
      evaluated: 2,
    };
    expect(plan.refetchCommentsFor[0].articleId).toBe(2);
  });

  it('VideoReusePlan.refetchCommentsFor는 RefetchCommentSpecVideo 배열이다', () => {
    const spec: RefetchCommentSpecVideo = {
      url: 'https://youtube.com/watch?v=abc',
      videoId: 7,
      lastCommentsFetchedAt: null,
    };
    const plan: VideoReusePlan = {
      reuseVideoIds: [7],
      skipVideoUrls: [],
      refetchCommentsFor: [spec],
      evaluated: 1,
    };
    expect(plan.refetchCommentsFor[0].videoId).toBe(7);
  });
});
