import { describe, it, expect } from 'vitest';
import { YoutubeCommentsCollector } from '../src/adapters/youtube-comments';

describe('YoutubeCommentsCollector', () => {
  it('should have source "youtube-comments"', () => {
    const collector = new YoutubeCommentsCollector();
    expect(collector.source).toBe('youtube-comments');
  });

  it('should implement Collector interface with collect method', () => {
    const collector = new YoutubeCommentsCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('should return an AsyncGenerator from collect', () => {
    const collector = new YoutubeCommentsCollector();
    const generator = collector.collect({
      keyword: 'dQw4w9WgXcQ', // videoId를 keyword로 전달
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-03-24T00:00:00Z',
    });
    // AsyncGenerator인지 확인
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });
});
