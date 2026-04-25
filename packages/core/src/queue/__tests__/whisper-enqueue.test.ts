import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const addBulkMock = vi.fn();

vi.mock('../whisper-queue', async () => {
  const actual = await vi.importActual<typeof import('../whisper-queue')>('../whisper-queue');
  return {
    ...actual,
    getWhisperQueue: () => ({
      addBulk: addBulkMock,
    }),
  };
});

// drizzle/db는 enqueueWhisperForRawItems가 import만 하고 사용하지 않음.
// 그래도 모듈 로드 시 부수효과를 차단하기 위해 stub.
vi.mock('../../db', () => ({
  getDb: () => {
    throw new Error('getDb should not be called by enqueueWhisperForRawItems');
  },
  db: null,
}));

beforeEach(() => {
  addBulkMock.mockReset();
  addBulkMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('enqueueWhisperForRawItems', () => {
  it('빈 후보면 enqueue 0건 반환하고 큐 호출 없음', async () => {
    const { enqueueWhisperForRawItems } = await import('../whisper-enqueue');
    const result = await enqueueWhisperForRawItems({
      runId: 'run-1',
      subscriptionId: 1,
      candidates: [],
    });
    expect(result.enqueued).toBe(0);
    expect(addBulkMock).not.toHaveBeenCalled();
  });

  it('viewCount 내림차순 정렬 후 topN cap을 적용한다', async () => {
    const { enqueueWhisperForRawItems } = await import('../whisper-enqueue');
    const candidates = [
      { sourceId: 'a', viewCount: 100 },
      { sourceId: 'b', viewCount: 500 },
      { sourceId: 'c', viewCount: 50 },
      { sourceId: 'd', viewCount: 1000 },
    ];
    const result = await enqueueWhisperForRawItems({
      runId: 'run-1',
      subscriptionId: 1,
      candidates,
      topN: 2,
    });
    expect(result.enqueued).toBe(2);
    expect(addBulkMock).toHaveBeenCalledTimes(1);
    const jobs = addBulkMock.mock.calls[0][0] as Array<{
      data: { sourceId: string };
      opts: { jobId: string };
    }>;
    expect(jobs.map((j) => j.data.sourceId)).toEqual(['d', 'b']);
  });

  it('jobId는 yt-{sourceId}로 멱등 설정된다', async () => {
    const { enqueueWhisperForRawItems } = await import('../whisper-enqueue');
    await enqueueWhisperForRawItems({
      runId: 'run-1',
      subscriptionId: 1,
      candidates: [{ sourceId: 'VmA0qFZ13cE', viewCount: 100 }],
    });
    const jobs = addBulkMock.mock.calls[0][0] as Array<{ opts: { jobId: string } }>;
    expect(jobs[0].opts.jobId).toBe('yt-VmA0qFZ13cE');
  });

  it('target 필드에 raw_items 식별자가 들어간다', async () => {
    const { enqueueWhisperForRawItems } = await import('../whisper-enqueue');
    await enqueueWhisperForRawItems({
      runId: 'run-1',
      subscriptionId: 42,
      candidates: [{ sourceId: 'abc', viewCount: 10 }],
    });
    const jobs = addBulkMock.mock.calls[0][0] as Array<{
      data: {
        sourceId: string;
        subscriptionId?: number;
        target?: { kind: string; source: string; rawSourceId: string; itemType: string };
      };
    }>;
    expect(jobs[0].data.target).toEqual({
      kind: 'raw_items',
      source: 'youtube',
      rawSourceId: 'abc',
      itemType: 'video',
    });
    expect(jobs[0].data.subscriptionId).toBe(42);
  });

  it('빈 sourceId는 필터링된다', async () => {
    const { enqueueWhisperForRawItems } = await import('../whisper-enqueue');
    const result = await enqueueWhisperForRawItems({
      runId: 'run-1',
      subscriptionId: 1,
      candidates: [
        { sourceId: '', viewCount: 100 },
        { sourceId: 'real', viewCount: 50 },
      ],
    });
    expect(result.enqueued).toBe(1);
    const jobs = addBulkMock.mock.calls[0][0] as Array<{ data: { sourceId: string } }>;
    expect(jobs[0].data.sourceId).toBe('real');
  });

  it('viewCount undefined인 후보는 정렬 시 0으로 취급된다', async () => {
    const { enqueueWhisperForRawItems } = await import('../whisper-enqueue');
    await enqueueWhisperForRawItems({
      runId: 'run-1',
      subscriptionId: 1,
      candidates: [{ sourceId: 'no-views' }, { sourceId: 'with-views', viewCount: 10 }],
      topN: 1,
    });
    const jobs = addBulkMock.mock.calls[0][0] as Array<{ data: { sourceId: string } }>;
    expect(jobs[0].data.sourceId).toBe('with-views');
  });
});
