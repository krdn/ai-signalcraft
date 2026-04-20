import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { mapToRawItem, type MapItemContext } from './item-mapper';

function startOfUtcDayForTest(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const ctx: MapItemContext = {
  subscriptionId: 42,
  source: 'naver-news',
  itemType: 'article',
  runId: '00000000-0000-0000-0000-000000000001',
};

describe('mapToRawItem', () => {
  it('네이버 뉴스 구조를 raw_items로 매핑한다', () => {
    const raw = {
      sourceId: 'nid-12345',
      url: 'https://n.news.naver.com/article/001/0001',
      title: '기사 제목',
      content: '본문 내용',
      publishedAt: '2026-03-01T10:00:00+09:00',
      rawData: { orig: 1 },
    };
    const row = mapToRawItem(raw, ctx);
    expect(row.subscriptionId).toBe(42);
    expect(row.source).toBe('naver-news');
    expect(row.sourceId).toBe('nid-12345');
    expect(row.itemType).toBe('article');
    expect(row.url).toBe(raw.url);
    expect(row.title).toBe('기사 제목');
    expect(row.content).toBe('본문 내용');
    expect(row.publishedAt).toBeInstanceOf(Date);
    expect(row.time).toEqual(row.publishedAt);
    expect(row.rawPayload).toBe(raw);
    expect(row.fetchedFromRun).toBe(ctx.runId);
  });

  it('유튜브 구조(description, channelTitle, viewCount)를 매핑한다', () => {
    const raw = {
      videoId: 'abc123',
      title: '영상 제목',
      description: '설명',
      channelTitle: '채널명',
      viewCount: 12345,
      likeCount: '678', // 문자열 숫자도 허용
      publishedAt: '2026-03-02T00:00:00Z',
    };
    const row = mapToRawItem(raw, { ...ctx, source: 'youtube', itemType: 'video' });
    expect(row.sourceId).toBe('abc123');
    expect(row.content).toBe('설명');
    expect(row.author).toBe('채널명');
    expect(row.publisher).toBe('채널명');
    expect(row.metrics?.viewCount).toBe(12345);
    expect(row.metrics?.likeCount).toBe(678);
    expect(row.itemType).toBe('video');
  });

  it('커뮤니티(CommunityPost) 구조를 매핑한다', () => {
    const raw = {
      id: 'post-7',
      url: 'https://gall.dcinside.com/board/view/?no=7',
      title: '게시글',
      content: '내용',
      author: 'user1',
      createdAt: '2026-02-28T12:00:00Z',
    };
    const row = mapToRawItem(raw, { ...ctx, source: 'dcinside' });
    expect(row.sourceId).toBe('post-7');
    expect(row.author).toBe('user1');
    expect(row.publishedAt).toBeInstanceOf(Date);
  });

  it('sourceId가 없을 때 URL 해시로 대체한다', () => {
    const raw = {
      url: 'https://example.com/a',
      title: 't',
    };
    const row = mapToRawItem(raw, { ...ctx, source: 'clien' });
    const expected = createHash('sha1')
      .update('clien:https://example.com/a')
      .digest('hex')
      .slice(0, 40);
    expect(row.sourceId).toBe(expected);
  });

  it('sourceId와 URL 모두 없을 때 title+content 해시로 대체한다', () => {
    const raw = { title: 'T', description: 'C' };
    const row = mapToRawItem(raw, { ...ctx, source: 'fmkorea' });
    expect(row.sourceId).toMatch(/^[0-9a-f]{40}$/);
    expect(row.sourceId.length).toBe(40);
  });

  it('publishedAt이 없으면 createdAt → publishDate → timestamp 순으로 폴백한다', () => {
    const rawA = { sourceId: 'a', createdAt: '2026-01-01T00:00:00Z' };
    const rawB = { sourceId: 'b', timestamp: 1704067200000 };

    const a = mapToRawItem(rawA, ctx);
    const b = mapToRawItem(rawB, ctx);

    expect(a.publishedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(b.publishedAt?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('publishedAt이 모두 null이면 time은 현재 UTC 자정이다', () => {
    const raw = { sourceId: 'no-date' };
    const before = startOfUtcDayForTest(new Date());
    const row = mapToRawItem(raw, ctx);
    const after = startOfUtcDayForTest(new Date());

    expect(row.publishedAt).toBeNull();
    expect(row.time).toBeInstanceOf(Date);
    expect(row.time.getTime()).toBe(before.getTime());
    expect(row.time.getTime()).toBe(after.getTime());
    expect(row.time.getUTCHours()).toBe(0);
    expect(row.time.getUTCMinutes()).toBe(0);
    expect(row.time.getUTCSeconds()).toBe(0);
    expect(row.time.getUTCMilliseconds()).toBe(0);
  });

  it('publishedAt null 아이템을 연속 호출해도 동일한 UTC day에서는 같은 time을 돌려준다', () => {
    const raw = { sourceId: 'same-id' };
    const row1 = mapToRawItem(raw, ctx);
    const row2 = mapToRawItem(raw, ctx);
    expect(row1.time.getTime()).toBe(row2.time.getTime());
  });

  it('publishedAt이 유효하면 time은 publishedAt과 같다 (회귀 방지)', () => {
    const raw = {
      sourceId: 'pub',
      publishedAt: '2026-03-15T12:34:56Z',
    };
    const row = mapToRawItem(raw, ctx);
    expect(row.publishedAt?.toISOString()).toBe('2026-03-15T12:34:56.000Z');
    expect(row.time.getTime()).toBe(row.publishedAt?.getTime());
  });

  it('잘못된 날짜 문자열은 null로 처리한다', () => {
    const raw = { sourceId: 'x', publishedAt: 'not-a-date' };
    const row = mapToRawItem(raw, ctx);
    expect(row.publishedAt).toBeNull();
  });

  it('metrics는 유효한 필드만 포함한다', () => {
    const raw = {
      sourceId: 'z',
      viewCount: 100,
      likes: 5, // alias
      shareCount: null, // 무시
    };
    const row = mapToRawItem(raw, ctx);
    expect(row.metrics?.viewCount).toBe(100);
    expect(row.metrics?.likeCount).toBe(5);
    expect(row.metrics?.shareCount).toBeUndefined();
  });

  it('빈 문자열은 null로 처리한다', () => {
    const raw = {
      sourceId: 'q',
      title: '',
      content: '',
      url: '',
    };
    const row = mapToRawItem(raw, ctx);
    expect(row.title).toBeNull();
    expect(row.content).toBeNull();
    expect(row.url).toBeNull();
  });
});
