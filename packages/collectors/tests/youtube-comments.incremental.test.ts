import { describe, expect, it, vi, beforeEach } from 'vitest';
import { YoutubeCommentsCollector } from '../src/adapters/youtube-comments';

const listMock = vi.fn();

// vi.mock은 hoist되어 import보다 먼저 실행되므로 아래 선언 위치와 무관하게 동작한다.
vi.mock('../src/utils/youtube-client', () => ({
  getYoutubeClient: () => ({
    commentThreads: { list: listMock },
  }),
}));

function mkThread(id: string, publishedAt: string) {
  return {
    snippet: {
      topLevelComment: {
        id,
        snippet: {
          textDisplay: `c${id}`,
          authorDisplayName: 'u',
          likeCount: 0,
          publishedAt,
        },
      },
    },
    replies: null,
  };
}

beforeEach(() => {
  listMock.mockReset();
});

describe('YoutubeCommentsCollector 증분 수집', () => {
  it('since 이후의 댓글만 반환한다', async () => {
    listMock.mockResolvedValueOnce({
      data: {
        items: [
          mkThread('3', '2026-04-21T10:00:00Z'),
          mkThread('2', '2026-04-20T10:00:00Z'),
          mkThread('1', '2026-04-19T10:00:00Z'),
        ],
        nextPageToken: undefined,
      },
    });

    const collector = new YoutubeCommentsCollector();
    const collected: string[] = [];
    for await (const chunk of collector.collect({
      keyword: 'video-xyz',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-04-30T00:00:00Z',
      maxComments: 100,
      since: '2026-04-20T12:00:00Z',
      commentOrder: 'time',
    })) {
      for (const c of chunk) collected.push(c.sourceId);
    }

    expect(collected).toEqual(['3']);
    expect(listMock.mock.calls[0][0]).toMatchObject({ order: 'time', videoId: 'video-xyz' });
  });

  it('publishedAt<=since 발견 시 즉시 종료(후속 페이지 호출 없음)', async () => {
    listMock.mockResolvedValueOnce({
      data: {
        items: [mkThread('5', '2026-04-21T11:00:00Z'), mkThread('4', '2026-04-20T09:00:00Z')],
        nextPageToken: 'PAGE2',
      },
    });

    const collector = new YoutubeCommentsCollector();
    const collected: string[] = [];
    for await (const chunk of collector.collect({
      keyword: 'video-xyz',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-04-30T00:00:00Z',
      maxComments: 100,
      since: '2026-04-20T12:00:00Z',
      commentOrder: 'time',
    })) {
      for (const c of chunk) collected.push(c.sourceId);
    }
    expect(collected).toEqual(['5']);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('since 미지정 시 기존 order=relevance 동작 유지', async () => {
    listMock.mockResolvedValueOnce({
      data: { items: [mkThread('1', '2026-04-21T10:00:00Z')], nextPageToken: undefined },
    });
    const collector = new YoutubeCommentsCollector();
    for await (const _ of collector.collect({
      keyword: 'video-xyz',
      startDate: '2026-04-01T00:00:00Z',
      endDate: '2026-04-30T00:00:00Z',
      maxComments: 100,
    })) {
      // drain
    }
    expect(listMock.mock.calls[0][0]).toMatchObject({ order: 'relevance' });
  });
});
