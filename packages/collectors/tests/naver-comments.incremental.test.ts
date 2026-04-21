import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NaverCommentsCollector } from '../src/adapters/naver-comments';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonpReply(
  comments: Array<{ commentNo: string; regTime: string; contents: string }>,
  totalPages = 1,
): Response {
  const payload = {
    result: {
      commentList: comments.map((c) => ({
        commentNo: c.commentNo,
        regTime: c.regTime,
        modTime: c.regTime,
        contents: c.contents,
        sympathyCount: 0,
        antipathyCount: 0,
        maskedUserId: 'x',
      })),
      pageModel: { totalPages },
    },
  };
  const body = `_callback(${JSON.stringify(payload)});`;
  return { ok: true, status: 200, text: async () => body } as Response;
}

describe('NaverCommentsCollector 증분 수집', () => {
  it('since 이후의 댓글만 반환한다', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonpReply([
        { commentNo: '3', regTime: '2026-04-21T10:00:00Z', contents: 'new' },
        { commentNo: '2', regTime: '2026-04-20T10:00:00Z', contents: 'old1' },
        { commentNo: '1', regTime: '2026-04-19T10:00:00Z', contents: 'old2' },
      ]),
    );

    const collector = new NaverCommentsCollector();
    const url = 'https://n.news.naver.com/article/001/0000000001';
    const since = new Date('2026-04-20T12:00:00Z');

    const collected: string[] = [];
    for await (const chunk of collector.collectForArticle(url, { maxComments: 100, since })) {
      for (const c of chunk) collected.push(c.sourceId);
    }

    expect(collected).toEqual(['3']);
  });

  it('since 이전 댓글이 연속 20개 나오면 조기 종료한다', async () => {
    // 100개 중 앞 5개만 since 이후, 나머지 95개는 since 이전 → 연속 20개 충족 시 break
    const items = Array.from({ length: 100 }, (_, i) => ({
      commentNo: String(1000 - i),
      regTime:
        i < 5
          ? `2026-04-21T${String(10 - i).padStart(2, '0')}:00:00Z`
          : `2026-04-19T${String(10 - (i % 10)).padStart(2, '0')}:00:00Z`,
      contents: `c${i}`,
    }));
    // totalPages=5로 설정하되 실제로는 연속 20개 cutoff로 페이지 1에서 종료될 것
    mockFetch.mockResolvedValue(jsonpReply(items, 5));

    const collector = new NaverCommentsCollector();
    const url = 'https://n.news.naver.com/article/001/0000000001';
    const since = new Date('2026-04-20T12:00:00Z');

    const collected: string[] = [];
    for await (const chunk of collector.collectForArticle(url, { maxComments: 500, since })) {
      for (const c of chunk) collected.push(c.sourceId);
    }

    // 페이지 1에서 연속 20개 cutoff 감지 → 페이지 2 이후 호출 없음
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(collected.length).toBe(5);
  });

  it('since 미지정 시 기존 동작(전량 수집, FAVORITE 정렬) 유지', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonpReply(
        [
          { commentNo: '2', regTime: '2026-04-19T10:00:00Z', contents: 'a' },
          { commentNo: '1', regTime: '2026-04-18T10:00:00Z', contents: 'b' },
        ],
        1,
      ),
    );

    const collector = new NaverCommentsCollector();
    const url = 'https://n.news.naver.com/article/001/0000000001';
    const collected: string[] = [];
    for await (const chunk of collector.collectForArticle(url, { maxComments: 100 })) {
      for (const c of chunk) collected.push(c.sourceId);
    }
    expect(collected).toEqual(['2', '1']);
    const firstCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstCallUrl).toMatch(/sort=FAVORITE/);
  });

  it('since 지정 시 호출 URL에 sort=NEW가 포함된다', async () => {
    mockFetch.mockResolvedValueOnce(jsonpReply([], 0));
    const collector = new NaverCommentsCollector();
    const url = 'https://n.news.naver.com/article/001/0000000001';
    for await (const _ of collector.collectForArticle(url, {
      maxComments: 10,
      since: new Date('2026-04-20T00:00:00Z'),
    })) {
      // drain
    }
    const firstCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstCallUrl).toMatch(/sort=NEW/);
  });
});
