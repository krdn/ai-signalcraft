import { describe, it, expect, vi } from 'vitest';
import { createCollectorManipulationLoader } from '../collector-loader';

function makeMockClient() {
  const queryFn = vi.fn();
  const baselinesFn = vi.fn();
  return {
    client: {
      items: {
        query: { query: queryFn },
        fetchManipulationBaselines: { query: baselinesFn },
      },
    } as unknown as Parameters<typeof createCollectorManipulationLoader>[0]['client'],
    queryFn,
    baselinesFn,
  };
}

const baseCtx = {
  jobId: 1,
  subscriptionId: 42,
  domain: 'political',
  config: {} as never,
  dateRange: { start: new Date('2026-04-21T00:00:00Z'), end: new Date('2026-04-28T00:00:00Z') },
};

describe('CollectorManipulationLoader', () => {
  it('comments / votes / trendSeries / embeddedComments는 단일 query 호출을 공유 (memoize)', async () => {
    const { client, queryFn } = makeMockClient();
    queryFn.mockResolvedValue({
      items: [
        {
          itemType: 'comment',
          source: 'naver-comments',
          itemId: 'c1',
          parentSourceId: 'p1',
          time: '2026-04-22T10:00:00Z',
          content: 'hello',
          author: 'a',
          metrics: { likeCount: 5 },
          embedding: [0.1, 0.2],
        },
      ],
      nextCursor: null,
    });

    const loader = createCollectorManipulationLoader({
      client,
      subscriptionId: 42,
      sources: ['naver-news', 'naver-comments'],
      dateRange: baseCtx.dateRange,
      baselineDays: 30,
    });

    await loader.loadComments(baseCtx);
    await loader.loadVotes(baseCtx);
    await loader.loadEmbeddedComments(baseCtx);
    await loader.loadTrendSeries(baseCtx);

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('embeddedArticles는 별도 query 호출', async () => {
    const { client, queryFn } = makeMockClient();
    queryFn.mockResolvedValue({ items: [], nextCursor: null });

    const loader = createCollectorManipulationLoader({
      client,
      subscriptionId: 42,
      sources: [],
      dateRange: baseCtx.dateRange,
      baselineDays: 30,
    });

    await loader.loadComments(baseCtx);
    await loader.loadEmbeddedArticles(baseCtx);

    expect(queryFn).toHaveBeenCalledTimes(2);
    const secondCall = queryFn.mock.calls[1][0];
    expect(secondCall.itemTypes).toEqual(['article', 'video']);
  });

  it('baselines는 fetchManipulationBaselines를 호출', async () => {
    const { client, queryFn, baselinesFn } = makeMockClient();
    queryFn.mockResolvedValue({ items: [], nextCursor: null });
    baselinesFn.mockResolvedValue({ byHour: { '9': [10, 12], '14': [50, 51] } });

    const loader = createCollectorManipulationLoader({
      client,
      subscriptionId: 42,
      sources: [],
      dateRange: baseCtx.dateRange,
      baselineDays: 30,
    });

    const result = await loader.loadTemporalBaselines(baseCtx);
    expect(result).toEqual({ '9': [10, 12], '14': [50, 51] });
    expect(baselinesFn).toHaveBeenCalledWith({
      subscriptionId: 42,
      referenceEnd: baseCtx.dateRange.end.toISOString(),
      days: 30,
    });
  });
});
