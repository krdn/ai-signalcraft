import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { FMKoreaCollector } from '../src/adapters/fmkorea';

class TestFMKoreaCollector extends FMKoreaCollector {
  public testParseComments($: cheerio.CheerioAPI, postSourceId: string, maxComments: number) {
    return (this as any).parseComments($, postSourceId, maxComments);
  }

  public testParseCpageMax($: cheerio.CheerioAPI): number {
    return (this as any).parseCpageMax($);
  }

  public testParseSearchResults(html: string) {
    return (this as any).parseSearchResults(html);
  }

  public testExtractContent($: cheerio.CheerioAPI): string {
    return (this as any).extractContent($);
  }
}

describe('FMKoreaCollector', () => {
  it('source가 "fmkorea"', () => {
    const collector = new FMKoreaCollector();
    expect(collector.source).toBe('fmkorea');
  });

  it('Collector 인터페이스의 collect 메서드 구현', () => {
    const collector = new FMKoreaCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('collect가 AsyncGenerator를 반환', () => {
    const collector = new FMKoreaCollector();
    const generator = collector.collect({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });
});

describe('FMKoreaCollector parseComments', () => {
  const html = readFileSync(resolve(__dirname, 'fixtures/fmkorea-comments.html'), 'utf-8');
  const $ = cheerio.load(html);
  const collector = new TestFMKoreaCollector();

  it('일반 댓글과 대댓글을 모두 수집', () => {
    const comments = collector.testParseComments($, 'fm_test', 100);
    expect(comments.length).toBe(5);
  });

  it('대댓글(re 클래스)의 parentId가 설정됨', () => {
    const comments = collector.testParseComments($, 'fm_test', 100);
    expect(comments[0].parentId).toBeNull();
    expect(comments[1].parentId).toBe('fm_comment_103');
    expect(comments[2].parentId).toBe('fm_comment_106');
    expect(comments[3].parentId).toBe('fm_comment_109');
    expect(comments[4].parentId).toBeNull();
  });

  it('대댓글의 작성자/내용/추천수가 올바르게 추출됨', () => {
    const comments = collector.testParseComments($, 'fm_test', 100);
    expect(comments[1].author).toBe('유저B');
    expect(comments[1].content).toContain('대댓글 depth 1');
    expect(comments[1].likeCount).toBe(2);
  });

  it('maxComments 제한이 동작', () => {
    const comments = collector.testParseComments($, 'fm_test', 3);
    expect(comments.length).toBe(3);
  });
});

describe('FMKoreaCollector parseSearchResults', () => {
  const collector = new TestFMKoreaCollector();

  it('작성자, 추천수, 댓글수를 추출', () => {
    const html = readFileSync(resolve(__dirname, 'fixtures/fmkorea-search.html'), 'utf-8');
    const results = collector.testParseSearchResults(html);
    expect(results.length).toBe(2);

    expect(results[0].author).toBe('작성자A');
    expect(results[0].recomCount).toBe(52);
    expect(results[0].commentCount).toBe(20);
    expect(results[0].publishedAt).toBeInstanceOf(Date);

    expect(results[1].author).toBe('작성자B');
    expect(results[1].recomCount).toBe(3);
    expect(results[1].commentCount).toBe(3);
  });
});

describe('FMKoreaCollector cpage 파싱', () => {
  it('cpage 링크에서 최대 페이지 번호를 추출', () => {
    const html = readFileSync(resolve(__dirname, 'fixtures/fmkorea-post.html'), 'utf-8');
    const $ = cheerio.load(html);
    const collector = new TestFMKoreaCollector();
    const maxCpage = collector.testParseCpageMax($);
    expect(maxCpage).toBe(3);
  });

  it('cpage 링크가 없으면 1 반환', () => {
    const $ = cheerio.load('<html><body><div class="fdb_lst_ul"></div></body></html>');
    const collector = new TestFMKoreaCollector();
    expect(collector.testParseCpageMax($)).toBe(1);
  });
});

describe('FMKoreaCollector 본문 추출', () => {
  const collector = new TestFMKoreaCollector();

  it('이미지만 있는 게시글에서 img alt/src 텍스트 추출', () => {
    const html =
      '<div class="xe_content"><img src="https://img.fmkorea.com/test.jpg" alt="테스트 이미지 설명"><img src="https://img.fmkorea.com/test2.jpg"></div>';
    const $ = cheerio.load(html);
    const content = collector.testExtractContent($);
    expect(content.length).toBeGreaterThan(20);
    expect(content).toContain('테스트 이미지 설명');
  });

  it('동영상 URL이 있는 게시글에서 URL 추출', () => {
    const html =
      '<div class="xe_content"><iframe src="https://www.youtube.com/embed/abc123"></iframe></div>';
    const $ = cheerio.load(html);
    const content = collector.testExtractContent($);
    expect(content).toContain('youtube.com');
  });

  it('텍스트가 충분한 게시글은 기존대로 텍스트만 반환', () => {
    const html =
      '<div class="xe_content"><p>이것은 충분히 긴 본문 내용입니다. 여러 문장이 포함되어 있어 본문으로 적합합니다.</p></div>';
    const $ = cheerio.load(html);
    const content = collector.testExtractContent($);
    expect(content).toContain('충분히 긴 본문');
    expect(content).not.toContain('[이미지');
  });
});
