import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { ClienCollector } from '../src/adapters/clien';

class TestClienCollector extends ClienCollector {
  public testParseComments($: cheerio.CheerioAPI, postSourceId: string, maxComments: number) {
    return (this as any).parseComments($, postSourceId, maxComments);
  }

  public testParsePostHtml(html: string, url: string, title: string, maxComments: number) {
    return (this as any).parsePostHtml(html, url, title, maxComments);
  }

  public testParseSearchResults(html: string) {
    return (this as any).parseSearchResults(html);
  }

  public testDetectBlocked(html: string) {
    return (this as any).detectBlocked(html);
  }
}

describe('ClienCollector', () => {
  it('source가 "clien"', () => {
    const collector = new ClienCollector();
    expect(collector.source).toBe('clien');
  });

  it('Collector 인터페이스의 collect 메서드 구현', () => {
    const collector = new ClienCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('collect가 AsyncGenerator를 반환', () => {
    const collector = new ClienCollector();
    const generator = collector.collect({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });
});

describe('ClienCollector parseComments', () => {
  const html = readFileSync(resolve(__dirname, 'fixtures/clien-post.html'), 'utf-8');
  const $ = cheerio.load(html);
  const collector = new TestClienCollector();

  it('일반 댓글과 대댓글을 모두 수집', () => {
    const comments = collector.testParseComments($, 'cl_test', 100);
    expect(comments.length).toBe(5);
  });

  it('대댓글(re 클래스)의 parentId가 직전 비-re 댓글로 설정됨', () => {
    const comments = collector.testParseComments($, 'cl_test', 100);
    // 1번: 일반 댓글 (151464454) → parentId 없음
    expect(comments[0].parentId).toBeNull();
    expect(comments[0].sourceId).toBe('cl_comment_151464454');
    // 2번: 대댓글 (re) → 부모는 1번
    expect(comments[1].parentId).toBe('cl_comment_151464454');
    // 3번: 대댓글 (re) → 부모는 여전히 1번 (마지막 비-re)
    expect(comments[2].parentId).toBe('cl_comment_151464454');
    // 4번: 일반 댓글 (151464489) → parentId 없음
    expect(comments[3].parentId).toBeNull();
    // 5번: 대댓글 (re) → 부모는 4번
    expect(comments[4].parentId).toBe('cl_comment_151464489');
  });

  it('댓글 작성자가 올바르게 추출됨', () => {
    const comments = collector.testParseComments($, 'cl_test', 100);
    expect(comments[0].author).toBe('언어분석');
    expect(comments[1].author).toBe('온도계');
    expect(comments[3].author).toBe('리눅스99');
  });

  it('댓글 내용이 올바르게 추출됨', () => {
    const comments = collector.testParseComments($, 'cl_test', 100);
    expect(comments[0].content).toContain('옛날 학교는');
    expect(comments[1].content).toContain('@언어분석님');
  });

  it('추천수가 strong[id^="setLikeCount_"]에서 정확히 추출됨', () => {
    const comments = collector.testParseComments($, 'cl_test', 100);
    expect(comments[0].likeCount).toBe(0);
    expect(comments[1].likeCount).toBe(1);
    expect(comments[3].likeCount).toBe(9);
    expect(comments[4].likeCount).toBe(3);
  });

  it('dislikeCount는 항상 0 (클리앙은 싫어요 없음)', () => {
    const comments = collector.testParseComments($, 'cl_test', 100);
    for (const c of comments) {
      expect(c.dislikeCount).toBe(0);
    }
  });

  it('수정일 포함 timestamp에서 원본 작성시각만 추출', () => {
    const comments = collector.testParseComments($, 'cl_test', 100);
    // 4번 댓글: "2026-04-18 17:12:23  / 수정일: 2026-04-18 17:13:43"
    const c = comments[3];
    expect(c.publishedAt).toBeInstanceOf(Date);
    expect(c.publishedAt.getFullYear()).toBe(2026);
    expect(c.publishedAt.getMonth()).toBe(3); // 0-indexed: April = 3
    expect(c.publishedAt.getDate()).toBe(18);
  });

  it('maxComments 제한이 동작', () => {
    const comments = collector.testParseComments($, 'cl_test', 2);
    expect(comments.length).toBe(2);
  });
});

describe('ClienCollector parsePostHtml', () => {
  const html = readFileSync(resolve(__dirname, 'fixtures/clien-post.html'), 'utf-8');
  const collector = new TestClienCollector();

  it('본문 timestamp를 .view_count.date에서 올바르게 추출', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post).not.toBeNull();
    expect(post!.publishedAt).toBeInstanceOf(Date);
    expect(post!.publishedAt.getFullYear()).toBe(2026);
  });

  it('수정일(.lastdate)이 제거되고 원본 작성시각만 사용', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    // rawData.dateText에 수정일이 포함되지 않아야 함
    expect(post!.rawData.dateText).not.toContain('수정일');
  });

  it('작성자가 올바르게 추출됨', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post!.author).toBe('온도계');
  });

  it('게시판 이름이 추출됨', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post!.boardName).toBe('모두의공원');
  });

  it('본문 내용이 추출됨', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post!.content).toContain('공교육은 왜 필요하다고');
  });

  it('추천수가 추출됨', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post!.likeCount).toBe(7);
  });

  it('조회수가 .view_count.date가 아닌 곳에서 추출됨', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post!.viewCount).toBe(1200);
  });

  it('댓글이 올바르게 수집됨', () => {
    const post = collector.testParsePostHtml(
      html,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post!.commentCount).toBe(5);
    expect(post!.comments.length).toBe(5);
  });

  it('timestamp가 없는 HTML이면 null 반환', () => {
    const noDateHtml = '<html><body><div class="post_article">내용</div></body></html>';
    const post = collector.testParsePostHtml(
      noDateHtml,
      'https://www.clien.net/service/board/park/123',
      '테스트',
      100,
    );
    expect(post).toBeNull();
  });
});

describe('ClienCollector detectBlocked', () => {
  const collector = new TestClienCollector();

  it('정상 검색 HTML (list_item 포함) → false', () => {
    const normalHtml =
      '<html><body>' + 'x'.repeat(3000) + '<div class="list_item"></div></body></html>';
    expect(collector.testDetectBlocked(normalHtml)).toBe(false);
  });

  it('정상 본문 HTML (post_article 포함) → false', () => {
    const html =
      '<html><body>' + 'x'.repeat(3000) + '<div class="post_article">내용</div></body></html>';
    expect(collector.testDetectBlocked(html)).toBe(false);
  });

  it('본문에 "차단" 텍스트가 서비스 공지로 포함되어도 post_article 있으면 false', () => {
    const html =
      '<html><body>' +
      'x'.repeat(3000) +
      '<span>접속이 차단됩니다 (점검 공지)</span><div class="post_article">내용</div></body></html>';
    expect(collector.testDetectBlocked(html)).toBe(false);
  });

  it('접근 제한 문자열 (콘텐츠 마커 없음) → true', () => {
    expect(
      collector.testDetectBlocked(
        '<html><body>' + 'x'.repeat(3000) + '접근이 제한되었습니다</body></html>',
      ),
    ).toBe(true);
  });

  it('429 Too Many Requests → true', () => {
    expect(
      collector.testDetectBlocked(
        '<html><body>' + 'x'.repeat(3000) + 'Too Many Requests</body></html>',
      ),
    ).toBe(true);
  });

  it('403 Forbidden → true', () => {
    expect(
      collector.testDetectBlocked(
        '<html><body>' + 'x'.repeat(3000) + '403 Forbidden</body></html>',
      ),
    ).toBe(true);
  });

  it('빈 HTML (2000자 미만) → true', () => {
    expect(collector.testDetectBlocked('<html>short</html>')).toBe(true);
  });

  it('빈 문자열 → true', () => {
    expect(collector.testDetectBlocked('')).toBe(true);
  });

  it('콘텐츠 마커 없는 긴 HTML → true', () => {
    const html =
      '<html><body>' + 'x'.repeat(3000) + '<div class="something_else"></div></body></html>';
    expect(collector.testDetectBlocked(html)).toBe(true);
  });
});
