import { describe, it, expect } from 'vitest';
import { DCInsideCollector } from '../src/adapters/dcinside';
import type { CommunityPost, CommunityComment } from '../src/types/community';
import {
  parseDateText,
  randomDelay,
  sanitizeContent,
  buildSearchUrl,
} from '../src/utils/community-parser';

describe('CommunityPost 타입', () => {
  it('필수 필드를 포함한다', () => {
    const post: CommunityPost = {
      sourceId: 'dc_123456',
      url: 'https://gall.dcinside.com/board/view/?id=politics&no=123456',
      title: '테스트 게시글',
      content: '본문 내용',
      author: '닉네임',
      boardName: '정치갤러리',
      publishedAt: new Date(),
      viewCount: 100,
      commentCount: 5,
      likeCount: 10,
      rawData: {},
      comments: [],
    };
    expect(post.sourceId).toBe('dc_123456');
    expect(post.url).toBeTruthy();
    expect(post.title).toBeTruthy();
    expect(post.content).toBeTruthy();
    expect(post.author).toBeTruthy();
    expect(post.boardName).toBeTruthy();
    expect(post.publishedAt).toBeInstanceOf(Date);
    expect(post.rawData).toBeDefined();
  });
});

describe('CommunityComment 타입', () => {
  it('필수 필드를 포함한다', () => {
    const comment: CommunityComment = {
      sourceId: 'dc_comment_789',
      parentId: null,
      content: '댓글 내용',
      author: '댓글 작성자',
      likeCount: 3,
      dislikeCount: 1,
      publishedAt: new Date(),
      rawData: {},
    };
    expect(comment.sourceId).toBeTruthy();
    expect(comment.parentId).toBeNull();
    expect(comment.content).toBeTruthy();
    expect(comment.author).toBeTruthy();
    expect(comment.likeCount).toBe(3);
    expect(comment.dislikeCount).toBe(1);
    expect(comment.publishedAt).toBeInstanceOf(Date);
    expect(comment.rawData).toBeDefined();
  });
});

describe('Community Parser Utils', () => {
  describe('parseDateText', () => {
    it('"2시간 전"이 현재 시간 -2시간의 Date를 반환한다', () => {
      const before = Date.now();
      const result = parseDateText('2시간 전');
      const after = Date.now();
      const expected = before - 2 * 60 * 60 * 1000;
      // 1초 오차 허용
      expect(result.getTime()).toBeGreaterThanOrEqual(expected - 1000);
      expect(result.getTime()).toBeLessThanOrEqual(after - 2 * 60 * 60 * 1000 + 1000);
    });

    it('"30분 전"이 현재 시간 -30분의 Date를 반환한다', () => {
      const result = parseDateText('30분 전');
      const expected = Date.now() - 30 * 60 * 1000;
      expect(Math.abs(result.getTime() - expected)).toBeLessThan(2000);
    });

    it('"3일 전"이 현재 시간 -3일의 Date를 반환한다', () => {
      const result = parseDateText('3일 전');
      const expected = Date.now() - 3 * 24 * 60 * 60 * 1000;
      expect(Math.abs(result.getTime() - expected)).toBeLessThan(2000);
    });

    it('"2026.03.24"이 해당 날짜 Date를 반환한다', () => {
      const result = parseDateText('2026.03.24');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2); // 0-indexed
      expect(result.getDate()).toBe(24);
    });

    it('"03.24 15:30"이 올해 해당 일시 Date를 반환한다', () => {
      const result = parseDateText('03.24 15:30');
      const now = new Date();
      expect(result.getFullYear()).toBe(now.getFullYear());
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(24);
      expect(result.getHours()).toBe(15);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe('randomDelay', () => {
    it('2000~4000ms 범위 숫자를 반환한다', () => {
      for (let i = 0; i < 20; i++) {
        const value = randomDelay(2000, 4000);
        expect(value).toBeGreaterThanOrEqual(2000);
        expect(value).toBeLessThanOrEqual(4000);
      }
    });
  });

  describe('sanitizeContent', () => {
    it('HTML 태그를 제거하고 텍스트만 추출한다', () => {
      const result = sanitizeContent('<p>안녕하세요 <b>테스트</b></p>');
      expect(result).toBe('안녕하세요 테스트');
    });

    it('빈 문자열에 대해 빈 문자열을 반환한다', () => {
      expect(sanitizeContent('')).toBe('');
    });
  });

  describe('buildSearchUrl', () => {
    it('DC갤러리 검색 URL을 생성한다', () => {
      const url = buildSearchUrl('dcinside', '윤석열', 1);
      expect(url).toContain('dcinside.com');
      expect(url).toContain(encodeURIComponent('윤석열'));
    });

    it('에펨코리아 검색 URL을 생성한다', () => {
      const url = buildSearchUrl('fmkorea', '테스트', 2);
      expect(url).toContain('fmkorea.com');
    });

    it('클리앙 검색 URL을 생성한다', () => {
      const url = buildSearchUrl('clien', '테스트', 1);
      expect(url).toContain('clien.net');
    });
  });
});

describe('DCInsideCollector', () => {
  it('source가 "dcinside"', () => {
    const collector = new DCInsideCollector();
    expect(collector.source).toBe('dcinside');
  });

  it('Collector 인터페이스의 collect 메서드 구현', () => {
    const collector = new DCInsideCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('collect가 AsyncGenerator를 반환', () => {
    const collector = new DCInsideCollector();
    const generator = collector.collect({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    // AsyncGenerator 확인 (Symbol.asyncIterator 존재)
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });
});
