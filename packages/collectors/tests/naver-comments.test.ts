import { describe, it, expect } from 'vitest';
import { NaverCommentsCollector } from '../src/adapters/naver-comments';

describe('NaverCommentsCollector', () => {
  it('source가 "naver-comments"', () => {
    const collector = new NaverCommentsCollector();
    expect(collector.source).toBe('naver-comments');
  });

  it('Collector 인터페이스의 collect 메서드 구현', () => {
    const collector = new NaverCommentsCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('collectForArticle 메서드 존재', () => {
    const collector = new NaverCommentsCollector();
    expect(typeof collector.collectForArticle).toBe('function');
  });

  it('collect가 AsyncGenerator를 반환', () => {
    const collector = new NaverCommentsCollector();
    const generator = collector.collect({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    // AsyncGenerator 확인
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });

  it('collectForArticle이 AsyncGenerator를 반환', () => {
    const collector = new NaverCommentsCollector();
    const generator = collector.collectForArticle(
      'https://n.news.naver.com/article/016/0002042395',
    );
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });

  it('잘못된 URL로 collectForArticle 호출 시 에러', async () => {
    const collector = new NaverCommentsCollector();
    const generator = collector.collectForArticle('https://example.com/invalid');
    await expect(generator.next()).rejects.toThrow('네이버 뉴스 URL을 파싱할 수 없습니다');
  });

  // 실제 API 호출 테스트는 integration test로 분리 (외부 의존)
});
