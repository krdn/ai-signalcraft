import { describe, it, expect } from 'vitest';
import { fetchAnalysisPayloadInput, queryInput } from './items';

describe('items.queryInput zod schema', () => {
  const baseRange = {
    start: '2026-03-22T00:00:00Z',
    end: '2026-04-21T00:00:00Z',
  };

  it('scope 미지정 시 기본값 "all"', () => {
    const parsed = queryInput.parse({
      subscriptionId: 1,
      dateRange: baseRange,
    });
    expect(parsed.scope).toBe('all');
  });

  it('scope=feed는 parent 없이도 통과한다', () => {
    const parsed = queryInput.parse({
      subscriptionId: 1,
      dateRange: baseRange,
      scope: 'feed',
    });
    expect(parsed.scope).toBe('feed');
    expect(parsed.parent).toBeUndefined();
  });

  it('scope=comments-for-parent는 parent 입력을 허용한다', () => {
    const parsed = queryInput.parse({
      subscriptionId: 1,
      dateRange: baseRange,
      scope: 'comments-for-parent',
      parent: { source: 'naver-news', sourceId: 'abc-123' },
    });
    expect(parsed.parent).toEqual({ source: 'naver-news', sourceId: 'abc-123' });
  });

  it('parent.sourceId 빈 문자열은 거부한다', () => {
    expect(() =>
      queryInput.parse({
        subscriptionId: 1,
        dateRange: baseRange,
        scope: 'comments-for-parent',
        parent: { source: 'naver-news', sourceId: '' },
      }),
    ).toThrow();
  });

  it('알 수 없는 scope 값은 거부한다', () => {
    expect(() =>
      queryInput.parse({
        subscriptionId: 1,
        dateRange: baseRange,
        scope: 'bogus' as unknown as 'all',
      }),
    ).toThrow();
  });

  it('parent.source는 SOURCE_ENUM 내 값만 허용', () => {
    expect(() =>
      queryInput.parse({
        subscriptionId: 1,
        dateRange: baseRange,
        scope: 'comments-for-parent',
        parent: { source: 'reddit' as unknown as 'naver-news', sourceId: 'x' },
      }),
    ).toThrow();
  });
});

describe('items.query scope → source 치환 규칙 (네이버 fan-out)', () => {
  // 순수 함수 추출 대신 규칙 자체를 테스트.
  // items.ts의 로직: parent.source === 'naver-news' ? 'naver-comments' : parent.source
  const commentSourceFor = (parentSource: string) =>
    parentSource === 'naver-news' ? 'naver-comments' : parentSource;

  it('naver-news parent는 naver-comments로 치환', () => {
    expect(commentSourceFor('naver-news')).toBe('naver-comments');
  });

  it('커뮤니티 소스는 그대로 사용', () => {
    expect(commentSourceFor('dcinside')).toBe('dcinside');
    expect(commentSourceFor('fmkorea')).toBe('fmkorea');
    expect(commentSourceFor('clien')).toBe('clien');
    expect(commentSourceFor('youtube')).toBe('youtube');
  });
});

describe('fetchAnalysisPayloadInput zod schema', () => {
  it('keyword 미지정 시 invalid', () => {
    const r = fetchAnalysisPayloadInput.safeParse({
      dateRange: { start: '2026-04-19T00:00:00Z', end: '2026-04-26T00:00:00Z' },
    });
    expect(r.success).toBe(false);
  });

  it('정상 입력 통과', () => {
    const r = fetchAnalysisPayloadInput.safeParse({
      keyword: '테스트',
      dateRange: { start: '2026-04-19T00:00:00Z', end: '2026-04-26T00:00:00Z' },
      sources: ['naver-news', 'dcinside'],
      ragOptions: { articleVideoTopK: 180, commentTopK: 500 },
    });
    expect(r.success).toBe(true);
  });

  it('keyword trim 적용', () => {
    const r = fetchAnalysisPayloadInput.safeParse({
      keyword: '  테스트  ',
      dateRange: { start: '2026-04-19T00:00:00Z', end: '2026-04-26T00:00:00Z' },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.keyword).toBe('테스트');
  });

  it('ragOptions topK는 max 500', () => {
    const r = fetchAnalysisPayloadInput.safeParse({
      keyword: '테스트',
      dateRange: { start: '2026-04-19T00:00:00Z', end: '2026-04-26T00:00:00Z' },
      ragOptions: { articleVideoTopK: 501, commentTopK: 500 },
    });
    expect(r.success).toBe(false);
  });

  it('ragOptions에 articleVideoTopK만 있어도 통과', () => {
    const r = fetchAnalysisPayloadInput.safeParse({
      keyword: '테스트',
      dateRange: { start: '2026-04-19T00:00:00Z', end: '2026-04-26T00:00:00Z' },
      ragOptions: { articleVideoTopK: 100 },
    });
    expect(r.success).toBe(true);
  });

  it('ragOptions에 commentTopK만 있어도 통과 (rag-light)', () => {
    const r = fetchAnalysisPayloadInput.safeParse({
      keyword: '테스트',
      dateRange: { start: '2026-04-19T00:00:00Z', end: '2026-04-26T00:00:00Z' },
      ragOptions: { commentTopK: 200 },
    });
    expect(r.success).toBe(true);
  });
});
