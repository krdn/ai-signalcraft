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

    it('"2026-04-18 14:19:29"(clien timestamp 형식)이 해당 일시 Date를 반환한다', () => {
      // clien 검색결과의 <span class="timestamp">는 하이픈+초 단위로 옴
      const result = parseDateText('2026-04-18 14:19:29');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(3); // 0-indexed → 4월
      expect(result.getDate()).toBe(18);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(19);
      expect(result.getSeconds()).toBe(29);
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

    it('DC갤러리 URL은 sort/latest(시간순) 정렬을 사용한다', () => {
      // 기본 sort/accuracy(정확도순)는 최근 일자에 글이 쏠려 과거 일자가 묻힘 →
      // sort/latest로 시간순 정렬해 페이지 깊이로 과거까지 도달하도록 한다.
      const url = buildSearchUrl('dcinside', '이재명', 1);
      expect(url).toContain('/sort/latest/');
      expect(url).not.toContain('/sort/accuracy/');
    });

    it('에펨코리아 검색 URL을 생성한다', () => {
      const url = buildSearchUrl('fmkorea', '테스트', 2);
      expect(url).toContain('fmkorea.com');
    });

    it('에펨코리아 URL은 등록일 최신순 정렬을 사용한다', () => {
      // 기본 관련도순(IS 모듈)은 04-16~04-18에 글이 쏠리는 문제(Job #201) →
      // order_type=desc&sort_index=regdate로 등록일 최신순을 강제.
      const url = buildSearchUrl('fmkorea', '이재명', 1);
      expect(url).toContain('order_type=desc');
      expect(url).toContain('sort_index=regdate');
    });

    it('클리앙 검색 URL을 생성한다', () => {
      const url = buildSearchUrl('clien', '테스트', 1);
      expect(url).toContain('clien.net');
    });

    it('클리앙 URL은 sort=recency(시간순) 정렬을 사용한다', () => {
      const url = buildSearchUrl('clien', '이재명', 1);
      expect(url).toContain('sort=recency');
    });
  });

  describe('KST 자정 헬퍼', () => {
    it('kstDayStartMs: KST 04-17 02:00 글은 KST 04-17 자정 ms로 normalize된다', async () => {
      const { kstDayStartMs } = await import('../src/utils/community-parser');
      // KST 2026-04-17 02:00 = UTC 2026-04-16 17:00
      const d = new Date('2026-04-16T17:00:00Z');
      const ms = kstDayStartMs(d);
      const expected = new Date('2026-04-16T15:00:00Z').getTime(); // KST 04-17 00:00
      expect(ms).toBe(expected);
    });

    it('kstDayStartMs: KST 04-17 23:59 글도 KST 04-17 자정으로 normalize된다', async () => {
      const { kstDayStartMs } = await import('../src/utils/community-parser');
      // KST 2026-04-17 23:59 = UTC 2026-04-17 14:59
      const d = new Date('2026-04-17T14:59:00Z');
      const ms = kstDayStartMs(d);
      const expected = new Date('2026-04-16T15:00:00Z').getTime(); // KST 04-17 00:00
      expect(ms).toBe(expected);
    });

    it('splitIntoDaysKst: 8일 기간이면 정확히 8개의 KST 자정 Date를 반환한다', async () => {
      const { splitIntoDaysKst } = await import('../src/utils/community-parser');
      const days = splitIntoDaysKst('2026-04-11T05:33:29Z', '2026-04-18T05:33:29Z');
      expect(days).toHaveLength(8);
      // 첫 일자는 KST 04-11 자정 = UTC 04-10 15:00
      expect(days[0].toISOString()).toBe('2026-04-10T15:00:00.000Z');
      // 마지막 일자는 KST 04-18 자정
      expect(days[7].toISOString()).toBe('2026-04-17T15:00:00.000Z');
    });

    it('getKstYmd: UTC 시각도 KST 기준 연·월·일을 반환한다', async () => {
      const { getKstYmd } = await import('../src/utils/community-parser');
      // UTC 2026-04-16 17:00 = KST 2026-04-17 02:00
      const ymd = getKstYmd(new Date('2026-04-16T17:00:00Z'));
      expect(ymd).toEqual({ year: 2026, month: 4, day: 17 });
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
