import { describe, it, expect } from 'vitest';
import {
  parseNaverArticleUrl,
  buildObjectId,
  buildNaverSearchUrl,
  buildCommentApiUrl,
} from '../src/utils/naver-parser';
import { NaverNewsCollector } from '../src/adapters/naver-news';

describe('Naver Parser Utils', () => {
  it('n.news.naver.com 기사 URL에서 oid/aid 추출', () => {
    const result = parseNaverArticleUrl('https://n.news.naver.com/article/016/0002042395');
    expect(result).toEqual({ oid: '016', aid: '0002042395' });
  });

  it('레거시 read.nhn URL에서 oid/aid 추출', () => {
    const result = parseNaverArticleUrl(
      'https://news.naver.com/main/read.nhn?oid=016&aid=0002042395',
    );
    expect(result).toEqual({ oid: '016', aid: '0002042395' });
  });

  it('네이버 외 URL에 대해 null 반환', () => {
    const result = parseNaverArticleUrl('https://example.com/article');
    expect(result).toBeNull();
  });

  it('빈 문자열에 대해 null 반환', () => {
    const result = parseNaverArticleUrl('');
    expect(result).toBeNull();
  });

  it('올바른 objectId 생성', () => {
    expect(buildObjectId('016', '0002042395')).toBe('news016,0002042395');
  });

  it('키워드와 날짜로 검색 URL 생성', () => {
    const url = buildNaverSearchUrl({
      keyword: '윤석열',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
      page: 1,
    });
    expect(url).toContain('query=%EC%9C%A4%EC%84%9D%EC%97%B4');
    expect(url).toContain('where=news');
    expect(url).toContain('sort=1'); // 기본 최신순
    expect(url).toContain('start=1');
  });

  it('2페이지 검색 URL의 start 파라미터가 11', () => {
    const url = buildNaverSearchUrl({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
      page: 2,
    });
    expect(url).toContain('start=11');
  });

  it('sort 파라미터 커스텀 설정', () => {
    const url = buildNaverSearchUrl({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
      page: 1,
      sort: 0, // 관련도순
    });
    expect(url).toContain('sort=0');
  });

  it('댓글 API URL 생성', () => {
    const url = buildCommentApiUrl({
      objectId: 'news016,0002042395',
      page: 1,
    });
    expect(url).toContain('apis.naver.com/commentBox/cbox/web_naver_list_jsonp.json');
    expect(url).toContain('objectId=news016%2C0002042395');
    expect(url).toContain('pageSize=100');
    expect(url).toContain('sort=FAVORITE');
  });
});

describe('NaverNewsCollector', () => {
  it('source가 "naver-news"', () => {
    const collector = new NaverNewsCollector();
    expect(collector.source).toBe('naver-news');
  });

  it('Collector 인터페이스의 collect 메서드 구현', () => {
    const collector = new NaverNewsCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('collect가 AsyncGenerator를 반환', () => {
    const collector = new NaverNewsCollector();
    const generator = collector.collect({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    // AsyncGenerator 확인 (Symbol.asyncIterator 존재)
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });
});
