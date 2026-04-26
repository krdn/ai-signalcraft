import { describe, it, expect, beforeEach, vi } from 'vitest';
import { persistFromCollectorPayload } from '../src/pipeline/persist-from-collector';

vi.mock('../src/pipeline/persist', () => ({
  persistArticles: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
  persistVideos: vi.fn().mockResolvedValue([{ id: 10 }]),
  persistComments: vi.fn().mockResolvedValue([{ id: 100 }, { id: 101 }, { id: 102 }]),
}));

describe('persistFromCollectorPayload', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns counts for each table', async () => {
    const result = await persistFromCollectorPayload(42, {
      articles: [{ source: 'naver-news', sourceId: 'a1', url: 'u', title: 't' } as never],
      videos: [{ source: 'youtube', sourceId: 'v1', url: 'u', title: 't' } as never],
      comments: [{ source: 'naver-comments', sourceId: 'c1', content: 'x' } as never],
    });
    expect(result).toEqual({ articles: 2, videos: 1, comments: 3 });
  });

  it('handles empty payload', async () => {
    const persist = await import('../src/pipeline/persist');
    (persist.persistArticles as never as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (persist.persistVideos as never as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (persist.persistComments as never as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const result = await persistFromCollectorPayload(42, {
      articles: [],
      videos: [],
      comments: [],
    });
    expect(result).toEqual({ articles: 0, videos: 0, comments: 0 });
  });

  it('passes jobId to all three persist functions', async () => {
    const persist = await import('../src/pipeline/persist');
    await persistFromCollectorPayload(99, { articles: [], videos: [], comments: [] });
    expect(persist.persistArticles).toHaveBeenCalledWith(99, []);
    expect(persist.persistVideos).toHaveBeenCalledWith(99, []);
    expect(persist.persistComments).toHaveBeenCalledWith(99, []);
  });
});
