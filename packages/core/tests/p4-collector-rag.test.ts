// P2+P4 패치 검증: collector mode='rag' 호출 + 보충 동작 확인
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAnalysisInputViaCollector } from '../src/analysis/data-loader';

const queryMock = vi.fn();
vi.mock('../src/collector-client', () => ({
  getCollectorClient: () => ({
    items: { query: { query: queryMock } },
  }),
}));

vi.mock('../src/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: 1,
                keyword: '오세훈',
                startDate: new Date('2026-04-16T00:00:00Z'),
                endDate: new Date('2026-04-23T23:59:59Z'),
                domain: 'political',
                options: { subscriptionId: 440, tokenOptimization: 'rag-standard' },
              },
            ]),
        }),
      }),
    }),
  }),
}));

describe('P2+P4 collector RAG 통합', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  function makeItems(itemType: 'article' | 'comment' | 'video', count: number, dayOffset = 0) {
    return Array.from({ length: count }).map((_, i) => ({
      source:
        itemType === 'video' ? 'youtube' : itemType === 'comment' ? 'naver-comments' : 'naver-news',
      sourceId: `${itemType}-${dayOffset}-${i}`,
      itemType,
      title: itemType !== 'comment' ? `${itemType} title ${i}` : null,
      content: `내용 ${i}`,
      publisher: itemType !== 'comment' ? 'pub' : null,
      publishedAt: new Date(Date.UTC(2026, 3, 16 + dayOffset, 12)).toISOString(),
      author: itemType === 'comment' ? `user${i}` : null,
      metrics: itemType === 'comment' ? { likeCount: i } : null,
    }));
  }

  it('rag-standard 프리셋 시 collector mode="rag"로 topK*3 호출한다 (500 cap 적용)', async () => {
    // 두 호출 모두 충분히 채워 fill 발동 안 하도록 (article 390 / comment 500 cap)
    queryMock.mockImplementation((args: any) => {
      const isComment = args.itemTypes?.includes('comment');
      const itemType = isComment ? 'comment' : 'article';
      const n = isComment ? 500 : 390;
      return Promise.resolve({
        items: makeItems(itemType, n),
        total: n,
        mode: args.mode,
        nextCursor: null,
      });
    });

    await loadAnalysisInputViaCollector(1);

    // RAG 호출만 (보충 없음): article+video 1, comment 1 = 2회
    expect(queryMock).toHaveBeenCalledTimes(2);
    const calls = queryMock.mock.calls.map((c) => c[0]);
    const articleVideoCall = calls.find((c: any) => c.itemTypes?.includes('article'));
    const commentCall = calls.find((c: any) => c.itemTypes?.includes('comment'));

    // rag-standard: articleTopK 100 + clusterReps 30 = 130 → ×3 = 390 (cap 미적용)
    expect(articleVideoCall.mode).toBe('rag');
    expect(articleVideoCall.ragOptions?.topK).toBe(390);
    expect(articleVideoCall.ragOptions?.semanticQuery).toBe('오세훈');

    // commentTopK 200 → ×3 = 600 → cap 500
    expect(commentCall.mode).toBe('rag');
    expect(commentCall.ragOptions?.topK).toBe(500);
  });

  it('RAG 응답이 topK 80% 미만이면 mode="all"로 보충 호출한다', async () => {
    let callIdx = 0;
    queryMock.mockImplementation((args: any) => {
      callIdx++;
      // 1,2번째: RAG 응답 (부족)
      if (args.mode === 'rag') {
        return Promise.resolve({
          items: makeItems(args.itemTypes[0], 50), // 80% 미만
          total: 50,
          mode: 'rag',
          nextCursor: null,
        });
      }
      // 3,4번째: mode='all' 보충
      return Promise.resolve({
        items: makeItems(args.itemTypes[0], 100, 1),
        total: 100,
        mode: 'all',
        nextCursor: null,
      });
    });

    const result = await loadAnalysisInputViaCollector(1);

    // rag(2) + fill(2) = 4번
    expect(queryMock).toHaveBeenCalledTimes(4);
    const fillCalls = queryMock.mock.calls.filter((c) => c[0].mode === 'all');
    expect(fillCalls.length).toBe(2);

    // 보충된 결과가 input에 반영됨
    expect(result.input.articles.length).toBeGreaterThan(0);
    void callIdx;
  });

  it('source+sourceId+itemType 중복은 dedup된다', async () => {
    let call = 0;
    queryMock.mockImplementation((args: any) => {
      call++;
      if (args.mode === 'rag' && args.itemTypes.includes('article')) {
        // 동일 sourceId 5개 + 다른 5개 (총 10개 중 5개는 fill에서 중복)
        return Promise.resolve({
          items: [
            ...makeItems('article', 5).map((it) => ({ ...it, sourceId: `dup-${it.sourceId}` })),
            ...makeItems('article', 5),
          ],
          total: 10,
          mode: 'rag',
          nextCursor: null,
        });
      }
      if (args.mode === 'all' && args.itemTypes.includes('article')) {
        // fill: 위 dup-* 5개 + 새 5개
        return Promise.resolve({
          items: [
            ...makeItems('article', 5).map((it) => ({ ...it, sourceId: `dup-${it.sourceId}` })),
            ...makeItems('article', 5).map((it) => ({ ...it, sourceId: `new-${it.sourceId}` })),
          ],
          total: 10,
          mode: 'all',
          nextCursor: null,
        });
      }
      return Promise.resolve({ items: [], total: 0, mode: args.mode, nextCursor: null });
    });

    const result = await loadAnalysisInputViaCollector(1);
    // RAG 10 + fill 10 - 중복 5 = 15개
    // article만 검증 (comment는 빈 응답이라 0)
    void call;
    expect(result.input.articles.length).toBeLessThanOrEqual(15);
    expect(result.input.articles.length).toBeGreaterThanOrEqual(10);
  });
});
