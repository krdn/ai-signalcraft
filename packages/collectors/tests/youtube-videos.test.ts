import { describe, it, expect } from 'vitest';
import { YoutubeVideosCollector } from '../src/adapters/youtube-videos';

describe('YoutubeVideosCollector', () => {
  it('should have source "youtube-videos"', () => {
    const collector = new YoutubeVideosCollector();
    expect(collector.source).toBe('youtube-videos');
  });

  it('should implement Collector interface with collect method', () => {
    const collector = new YoutubeVideosCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('should return an AsyncGenerator from collect', () => {
    const collector = new YoutubeVideosCollector();
    // YOUTUBE_API_KEY 미설정 시 getYoutubeClient()에서 에러 발생하므로
    // generator 생성 자체는 가능하지만 next() 시 에러 -- 인터페이스 확인만
    const generator = collector.collect({
      keyword: '테스트',
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-03-24T00:00:00Z',
    });
    // AsyncGenerator인지 확인
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });
});
