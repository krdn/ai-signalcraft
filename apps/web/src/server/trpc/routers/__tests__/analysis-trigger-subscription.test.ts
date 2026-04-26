/**
 * buildSubscriptionAnalysisMeta 단위 테스트
 *
 * triggerSubscription mutation은 router import 시 Redis/DB 연결 부작용이 발생하므로
 * 메타 합성 로직을 순수 헬퍼(buildSubscriptionAnalysisMeta)로 분리하여 직접 검증합니다.
 */
import { describe, it, expect } from 'vitest';
import { buildSubscriptionAnalysisMeta } from '../subscription-analysis-meta';

describe('buildSubscriptionAnalysisMeta', () => {
  it('appliedPreset/limits/options.sources를 spec 대로 합성', () => {
    const result = buildSubscriptionAnalysisMeta(
      {
        keyword: '한동훈',
        sources: ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'],
        limits: { maxPerRun: 500, commentsPerItem: 200 },
      },
      { subscriptionId: 37 },
    );

    // appliedPreset
    expect(result.appliedPreset.slug).toBe('__subscription__');
    expect(result.appliedPreset.title).toContain('한동훈');
    expect(result.appliedPreset.sources).toEqual({
      'naver-news': true,
      youtube: true,
      dcinside: true,
      fmkorea: true,
      clien: true,
    });
    expect(result.appliedPreset.optimization).toBe('rag-standard');
    expect(result.appliedPreset.customized).toBe(true);
    expect(result.appliedPreset.enableItemAnalysis).toBe(false);

    // limits: maxPerRun(500) 폴백 → naverArticles/youtubeVideos/communityPosts 모두 500
    expect(result.limits).toEqual({
      naverArticles: 500,
      youtubeVideos: 500,
      communityPosts: 500,
      commentsPerItem: 200,
    });

    // options
    expect(result.options).toEqual({
      subscriptionId: 37,
      skipItemAnalysis: true,
      useCollectorLoader: true,
      tokenOptimization: 'rag-standard',
      sources: ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'],
    });
  });

  it('소스별 전용 limits가 있으면 maxPerRun보다 우선', () => {
    const result = buildSubscriptionAnalysisMeta(
      {
        keyword: 'test',
        sources: ['naver-news'],
        limits: {
          maxPerRun: 100,
          naverArticles: 300,
          youtubeVideos: 25,
          communityPosts: 80,
          commentsPerItem: 50,
        },
      },
      { subscriptionId: 1 },
    );

    expect(result.limits).toEqual({
      naverArticles: 300,
      youtubeVideos: 25,
      communityPosts: 80,
      commentsPerItem: 50,
    });
  });

  it('limits/sources 없을 때 기본값 적용', () => {
    const result = buildSubscriptionAnalysisMeta(
      { keyword: 'empty', sources: null, limits: null },
      { subscriptionId: 99 },
    );

    expect(result.appliedPreset.sources).toEqual({});
    expect(result.limits).toEqual({
      naverArticles: 500,
      youtubeVideos: 50,
      communityPosts: 100,
      commentsPerItem: 200,
    });
    expect(result.options.sources).toEqual([]);
  });

  it('optimizationPreset 지정 시 반영', () => {
    const result = buildSubscriptionAnalysisMeta(
      { keyword: 'test', sources: [], limits: {} },
      { subscriptionId: 1, optimizationPreset: 'aggressive' },
    );

    expect(result.appliedPreset.optimization).toBe('aggressive');
    expect(result.options.tokenOptimization).toBe('aggressive');
  });
});
