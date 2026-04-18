import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { FMKoreaCollector } from '../src/adapters/fmkorea';

class TestFMKoreaCollector extends FMKoreaCollector {
  public testParseComments($: cheerio.CheerioAPI, postSourceId: string, maxComments: number) {
    return (this as any).parseComments($, postSourceId, maxComments);
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
