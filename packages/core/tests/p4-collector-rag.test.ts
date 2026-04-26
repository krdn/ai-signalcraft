// fetchAnalysisPayload 단일 RPC 기반 data-loader 검증
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAnalysisInputViaCollector } from '../src/analysis/data-loader';

const fetchAnalysisPayloadMock = vi.fn();
vi.mock('../src/collector-client', () => ({
  getCollectorClient: () => ({
    items: { fetchAnalysisPayload: { query: fetchAnalysisPayloadMock } },
  }),
}));

const dbMock = vi.fn();
vi.mock('../src/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => dbMock(),
        }),
      }),
    }),
  }),
}));

function makeRow(
  itemType: 'article' | 'video' | 'comment',
  idx: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    time: new Date('2026-04-20T12:00:00Z'),
    subscriptionId: 440,
    source:
      itemType === 'video' ? 'youtube' : itemType === 'comment' ? 'naver-comments' : 'naver-news',
    sourceId: `${itemType}-${idx}`,
    itemType,
    url: `https://example.com/${itemType}/${idx}`,
    title: itemType !== 'comment' ? `${itemType} title ${idx}` : null,
    content: `내용 ${idx}`,
    author: itemType === 'comment' ? `user${idx}` : null,
    publisher: itemType !== 'comment' ? 'pub' : null,
    publishedAt: new Date('2026-04-20T12:00:00Z').toISOString(),
    parentSourceId: itemType === 'comment' ? `article-0` : null,
    metrics: itemType === 'comment' ? { likeCount: idx } : null,
    sentiment: null,
    sentimentScore: null,
    fetchedAt: new Date('2026-04-20T13:00:00Z'),
    transcript: null,
    transcriptLang: null,
    durationSec: null,
    ...overrides,
  };
}

const baseJob = {
  id: 1,
  keyword: '오세훈',
  startDate: new Date('2026-04-16T00:00:00Z'),
  endDate: new Date('2026-04-23T23:59:59Z'),
  domain: 'political',
  options: { subscriptionId: 440, tokenOptimization: 'rag-standard' },
};

describe('fetchAnalysisPayload 단일 RPC 기반 data-loader', () => {
  beforeEach(() => {
    fetchAnalysisPayloadMock.mockReset();
    dbMock.mockReset();
  });

  it('ragConfig 있을 때(rag-standard): ragSample에서 input 구성, fullset/collectionMeta도 반환', async () => {
    dbMock.mockResolvedValue([baseJob]);

    const ragSample = [
      ...Array.from({ length: 3 }, (_, i) => makeRow('article', i)),
      ...Array.from({ length: 2 }, (_, i) => makeRow('comment', i)),
    ];
    const fullset = [
      ...Array.from({ length: 10 }, (_, i) => makeRow('article', i)),
      ...Array.from({ length: 5 }, (_, i) => makeRow('comment', i)),
    ];
    const collectionMeta = {
      sources: ['naver-news', 'naver-comments'],
      sourceCounts: {
        'naver-news': { articles: 10, comments: 0, videos: 0 },
        'naver-comments': { articles: 0, comments: 5, videos: 0 },
      },
      window: { start: '2026-04-16T00:00:00.000Z', end: '2026-04-23T23:59:59.000Z' },
      truncated: false,
    };

    fetchAnalysisPayloadMock.mockResolvedValue({ ragSample, fullset, collectionMeta });

    const result = await loadAnalysisInputViaCollector(1);

    // 단일 RPC 호출 확인
    expect(fetchAnalysisPayloadMock).toHaveBeenCalledTimes(1);

    // ragOptions가 rag-standard 프리셋 기준으로 설정되었는지 확인
    // rag-standard: articleTopK=100, clusterReps=30 → (100+30)*3=390 (cap 미적용)
    // commentTopK=200 → 200*3=600 → cap 500
    const call = fetchAnalysisPayloadMock.mock.calls[0][0];
    expect(call.ragOptions).toBeDefined();
    expect(call.ragOptions.articleVideoTopK).toBe(390);
    expect(call.ragOptions.commentTopK).toBe(500);

    // input은 ragSample(3개 article, 2개 comment)에서 구성
    expect(result.input.articles.length).toBe(3);
    expect(result.input.comments.length).toBe(2);

    // fullset은 Drizzle insert 형태로 변환
    expect(result.fullset.articles.length).toBe(10);
    expect(result.fullset.comments.length).toBe(5);
    expect(result.fullset.articles[0]).toHaveProperty('source', 'naver-news');
    expect(result.fullset.articles[0]).toHaveProperty('sourceId');
    expect(result.fullset.articles[0]).toHaveProperty('url');

    // collectionMeta 전달
    expect(result.collectionMeta.truncated).toBe(false);
    expect(result.collectionMeta.sources).toContain('naver-news');
  });

  it('rag-light 프리셋: 기사는 fullset 전체 유지, 댓글만 RAG 필터', async () => {
    dbMock.mockResolvedValue([
      {
        ...baseJob,
        options: { subscriptionId: 440, tokenOptimization: 'rag-light' },
      },
    ]);

    // ragSample: 댓글만 5건 (RAG 결과 — 기사는 articleTopK=0이므로 collector가 보내지 않음)
    const ragSample = Array.from({ length: 5 }, (_, i) => makeRow('comment', i));
    // fullset: 기사 5건 + 댓글 10건
    const fullset = [
      ...Array.from({ length: 5 }, (_, i) => makeRow('article', i)),
      ...Array.from({ length: 10 }, (_, i) => makeRow('comment', i)),
    ];
    const collectionMeta = {
      sources: ['naver-news', 'naver-comments'],
      sourceCounts: {
        'naver-news': { articles: 5, comments: 0, videos: 0 },
        'naver-comments': { articles: 0, comments: 10, videos: 0 },
      },
      window: { start: '2026-04-16T00:00:00.000Z', end: '2026-04-23T23:59:59.000Z' },
      truncated: false,
    };

    fetchAnalysisPayloadMock.mockResolvedValue({ ragSample, fullset, collectionMeta });

    const result = await loadAnalysisInputViaCollector(1);

    expect(fetchAnalysisPayloadMock).toHaveBeenCalledTimes(1);

    // rag-light: articleTopK=0 → articleVideoTopK 키 없음, commentTopK=200*3=600→cap 500
    const call = fetchAnalysisPayloadMock.mock.calls[0][0];
    expect(call.ragOptions).toBeDefined();
    expect(call.ragOptions).not.toHaveProperty('articleVideoTopK');
    expect(call.ragOptions.commentTopK).toBe(500);

    // 기사는 ragSample에 없으므로 fullset(5건)에서 폴백
    expect(result.input.articles.length).toBe(5);
    // 댓글은 ragSample(5건)에서
    expect(result.input.comments.length).toBe(5);

    // fullset 변환도 정상
    expect(result.fullset.articles.length).toBe(5);
    expect(result.fullset.comments.length).toBe(10);
  });

  it('ragConfig 없을 때(tokenOptimization 미설정): ragOptions 미전달, fullset에서 input 구성', async () => {
    dbMock.mockResolvedValue([
      {
        ...baseJob,
        options: { subscriptionId: 440 }, // tokenOptimization 없음
      },
    ]);

    const fullset = [
      ...Array.from({ length: 5 }, (_, i) => makeRow('article', i)),
      ...Array.from({ length: 3 }, (_, i) => makeRow('comment', i)),
    ];
    const collectionMeta = {
      sources: ['naver-news', 'naver-comments'],
      sourceCounts: {
        'naver-news': { articles: 5, comments: 0, videos: 0 },
        'naver-comments': { articles: 0, comments: 3, videos: 0 },
      },
      window: { start: '2026-04-16T00:00:00.000Z', end: '2026-04-23T23:59:59.000Z' },
      truncated: false,
    };

    // ragConfig 없음 → ragSample=[]
    fetchAnalysisPayloadMock.mockResolvedValue({ ragSample: [], fullset, collectionMeta });

    const result = await loadAnalysisInputViaCollector(1);

    expect(fetchAnalysisPayloadMock).toHaveBeenCalledTimes(1);

    // ragOptions가 undefined여야 함
    const call = fetchAnalysisPayloadMock.mock.calls[0][0];
    expect(call.ragOptions).toBeUndefined();

    // ragSample이 비어 있으므로 fullset에서 input 구성
    expect(result.input.articles.length).toBe(5);
    expect(result.input.comments.length).toBe(3);

    // fullset도 정상 변환
    expect(result.fullset.articles.length).toBe(5);
    expect(result.fullset.comments.length).toBe(3);
    expect(result.collectionMeta.truncated).toBe(false);
  });
});
