// 271 회귀 가드 — 구독 단축 경로(useCollectorLoader=true)에서 다음을 보장:
//   1. collector RPC가 options.sources를 그대로 전달함 (5소스)
//   2. VALID_SOURCES 외 값은 자동 필터됨
//   3. options.sources 미설정 시 collector에 sources=undefined 전달
//   4. fullset comment가 parentSourceId → parentId 로 변환됨
//
// 본 테스트는 loadAnalysisInputViaCollector 단위 mock 기반.
// orchestrator의 persistFromCollectorPayload 호출은 analysis-runner.test.ts에서 별도 검증.
// 실제 DB 통합 검증은 Task 11(수동 검증).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAnalysisInputViaCollector } from '../src/analysis/data-loader';

// 1) collector client mock — fetchAnalysisPayload가 ragSample + fullset 반환
const mockFetchAnalysisPayload = vi.fn();
vi.mock('../src/collector-client', () => ({
  getCollectorClient: () => ({
    items: { fetchAnalysisPayload: { query: mockFetchAnalysisPayload } },
  }),
}));

// 2) DB mock — collection_jobs row 반환
const mockJobSelect = vi.fn();
vi.mock('../src/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockJobSelect(),
        }),
      }),
    }),
  }),
}));

const baseJob = {
  id: 271,
  keyword: '한동훈',
  startDate: new Date('2026-04-19T04:43:54Z'),
  endDate: new Date('2026-04-26T04:43:54Z'),
  domain: 'political',
  options: {
    subscriptionId: 37,
    skipItemAnalysis: true,
    useCollectorLoader: true,
    tokenOptimization: 'rag-standard',
    sources: ['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien'],
  },
};

const emptyPayload = {
  ragSample: [],
  fullset: [],
  collectionMeta: {
    sources: [],
    sourceCounts: {},
    window: {
      start: baseJob.startDate.toISOString(),
      end: baseJob.endDate.toISOString(),
    },
    truncated: false,
  },
};

describe('271 회귀 가드 — 구독 경로 데이터 정합성', () => {
  beforeEach(() => {
    mockFetchAnalysisPayload.mockReset();
    mockJobSelect.mockReset();
  });

  it('collector RPC 호출 시 sources가 전달된다 (5소스)', async () => {
    mockJobSelect.mockResolvedValue([baseJob]);
    mockFetchAnalysisPayload.mockResolvedValue(emptyPayload);

    await loadAnalysisInputViaCollector(271);

    expect(mockFetchAnalysisPayload).toHaveBeenCalledTimes(1);
    const callArg = mockFetchAnalysisPayload.mock.calls[0][0];
    expect(callArg.subscriptionId).toBe(37);
    expect(callArg.sources).toEqual(['naver-news', 'youtube', 'dcinside', 'fmkorea', 'clien']);
  });

  it('options.sources에 잘못된 값이 섞여도 VALID_SOURCES만 전달', async () => {
    mockJobSelect.mockResolvedValue([
      {
        ...baseJob,
        options: {
          ...baseJob.options,
          sources: ['naver-news', 'naver-comments', 'invalid', 'dcinside'],
        },
      },
    ]);
    mockFetchAnalysisPayload.mockResolvedValue(emptyPayload);

    await loadAnalysisInputViaCollector(271);

    const callArg = mockFetchAnalysisPayload.mock.calls[0][0];
    // naver-comments, invalid 제거됨
    expect(callArg.sources).toEqual(['naver-news', 'dcinside']);
  });

  it('options.sources 미설정 시 collector에 sources=undefined', async () => {
    mockJobSelect.mockResolvedValue([
      {
        ...baseJob,
        options: {
          subscriptionId: 37,
          skipItemAnalysis: true,
          useCollectorLoader: true,
          tokenOptimization: 'rag-standard',
        },
      },
    ]);
    mockFetchAnalysisPayload.mockResolvedValue(emptyPayload);

    await loadAnalysisInputViaCollector(271);

    const callArg = mockFetchAnalysisPayload.mock.calls[0][0];
    expect(callArg.sources).toBeUndefined();
  });

  it('fullset comment의 parentSourceId가 parentId로 변환된다', async () => {
    mockJobSelect.mockResolvedValue([baseJob]);
    mockFetchAnalysisPayload.mockResolvedValue({
      ragSample: [],
      fullset: [
        {
          source: 'naver-news',
          sourceId: 'a-1',
          itemType: 'article',
          url: 'https://example.com/a-1',
          title: '기사 1',
          content: '내용',
          author: null,
          publisher: 'pub',
          publishedAt: new Date('2026-04-20T00:00:00Z').toISOString(),
          parentSourceId: null,
          metrics: null,
          sentiment: null,
          sentimentScore: null,
          fetchedAt: new Date('2026-04-20T01:00:00Z'),
          transcript: null,
          transcriptLang: null,
          durationSec: null,
        },
        {
          source: 'naver-comments',
          sourceId: 'c-1',
          itemType: 'comment',
          url: 'https://example.com/c-1',
          title: null,
          content: '댓글 내용',
          author: 'user',
          publisher: null,
          publishedAt: new Date('2026-04-20T00:00:00Z').toISOString(),
          parentSourceId: 'a-1',
          metrics: { likeCount: 3 },
          sentiment: null,
          sentimentScore: null,
          fetchedAt: new Date('2026-04-20T01:00:00Z'),
          transcript: null,
          transcriptLang: null,
          durationSec: null,
        },
      ],
      collectionMeta: {
        sources: ['naver-news', 'naver-comments'],
        sourceCounts: {
          'naver-news': { articles: 1, comments: 0, videos: 0 },
          'naver-comments': { articles: 0, comments: 1, videos: 0 },
        },
        window: {
          start: baseJob.startDate.toISOString(),
          end: baseJob.endDate.toISOString(),
        },
        truncated: false,
      },
    });

    const result = await loadAnalysisInputViaCollector(271);

    expect(result.fullset.articles.length).toBe(1);
    expect(result.fullset.comments.length).toBe(1);
    expect(result.fullset.articles[0]).toMatchObject({
      source: 'naver-news',
      sourceId: 'a-1',
      url: 'https://example.com/a-1',
    });
    // parentSourceId → parentId 매핑 검증 (p4-collector-rag.test.ts에서 미검증)
    expect(result.fullset.comments[0]).toMatchObject({
      source: 'naver-comments',
      sourceId: 'c-1',
      content: '댓글 내용',
      parentId: 'a-1',
    });
  });
});
