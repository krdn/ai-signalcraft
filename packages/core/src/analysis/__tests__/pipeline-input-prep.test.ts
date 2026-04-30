// pipeline-input-prep 헬퍼의 fixture 기반 회귀 테스트.
//
// 분해된 헬퍼들은 사이드 이펙트가 updateJobProgress 호출이라 mock 검증으로 진행.
//   - recordSubscriptionSourceStats: source별 카운트 집계 회귀
//   - persistCollectorFullset: fullset 미존재 시 noop 동작
//   - recordSamplingStats: progress payload shape 회귀

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordSubscriptionSourceStats,
  persistCollectorFullset,
  recordSamplingStats,
} from '../pipeline-input-prep';

const updateJobProgress = vi.fn();
const persistFromCollectorPayload = vi.fn();
const appendJobEvent = vi.fn();

vi.mock('../../pipeline/persist', () => ({
  updateJobProgress: (...args: unknown[]) => updateJobProgress(...args),
  appendJobEvent: (...args: unknown[]) => appendJobEvent(...args),
}));
vi.mock('../../pipeline/persist-from-collector', () => ({
  persistFromCollectorPayload: (...args: unknown[]) => persistFromCollectorPayload(...args),
}));

beforeEach(() => {
  updateJobProgress.mockReset();
  updateJobProgress.mockResolvedValue(undefined);
  persistFromCollectorPayload.mockReset();
  appendJobEvent.mockReset();
  appendJobEvent.mockResolvedValue(undefined);
});

describe('recordSubscriptionSourceStats', () => {
  it('source별 articles/comments/videos 카운트를 progress payload로 합성', async () => {
    const input = {
      articles: [{ source: 'naver-news' }, { source: 'naver-news' }, { source: 'dcinside' }],
      comments: [
        { source: 'naver-comments' },
        { source: 'naver-comments' },
        { source: 'naver-comments' },
        { source: 'dcinside' },
      ],
      videos: [{}, {}],
      // 기타 필드 — 본 헬퍼는 위 셋만 사용
    };

    await recordSubscriptionSourceStats(
      42,
      input as unknown as Parameters<typeof recordSubscriptionSourceStats>[1],
    );

    expect(updateJobProgress).toHaveBeenCalledOnce();
    const [jobId, payload] = updateJobProgress.mock.calls[0];
    expect(jobId).toBe(42);
    expect(payload['naver-news']).toEqual({
      status: 'completed',
      articles: 2,
      comments: 0,
      videos: 0,
    });
    expect(payload['naver-comments']).toEqual({
      status: 'completed',
      articles: 0,
      comments: 3,
      videos: 0,
    });
    expect(payload.dcinside).toEqual({
      status: 'completed',
      articles: 1,
      comments: 1,
      videos: 0,
    });
    expect(payload.youtube).toEqual({
      status: 'completed',
      articles: 0,
      comments: 0,
      videos: 2,
    });
  });

  it('source 필드 없으면 unknown으로 분류', async () => {
    const input = {
      articles: [{}, { source: '' }],
      comments: [{}],
      videos: [],
    };
    await recordSubscriptionSourceStats(
      1,
      input as unknown as Parameters<typeof recordSubscriptionSourceStats>[1],
    );

    const [, payload] = updateJobProgress.mock.calls[0];
    expect(payload.unknown).toEqual({
      status: 'completed',
      articles: 2,
      comments: 1,
      videos: 0,
    });
  });

  it('빈 입력은 빈 payload로 호출 (오류 없음)', async () => {
    const input = { articles: [], comments: [], videos: [] };
    await recordSubscriptionSourceStats(
      1,
      input as unknown as Parameters<typeof recordSubscriptionSourceStats>[1],
    );

    const [, payload] = updateJobProgress.mock.calls[0];
    expect(payload).toEqual({});
  });

  it('updateJobProgress 실패 시 throw하지 않음 (catch + logError)', async () => {
    updateJobProgress.mockRejectedValueOnce(new Error('DB down'));
    const input = { articles: [{ source: 'a' }], comments: [], videos: [] };
    await expect(
      recordSubscriptionSourceStats(
        1,
        input as unknown as Parameters<typeof recordSubscriptionSourceStats>[1],
      ),
    ).resolves.toBeUndefined();
  });
});

describe('persistCollectorFullset', () => {
  it('fullset 미보유 시 noop (updateJobProgress / persist 미호출)', async () => {
    await persistCollectorFullset(1, {});
    expect(updateJobProgress).not.toHaveBeenCalled();
    expect(persistFromCollectorPayload).not.toHaveBeenCalled();
  });

  it('fullset 있으면 running → completed 순서로 progress 업데이트', async () => {
    persistFromCollectorPayload.mockResolvedValueOnce({
      articles: 100,
      videos: 30,
      comments: 250,
    });
    await persistCollectorFullset(1, { fullset: [{ source: 'naver-news' }] as never });

    expect(persistFromCollectorPayload).toHaveBeenCalledOnce();
    expect(updateJobProgress).toHaveBeenCalledTimes(2);

    const [, runningPayload] = updateJobProgress.mock.calls[0];
    expect(runningPayload.persist.status).toBe('running');
    expect(runningPayload.persist.source).toBe('collector');

    const [, completedPayload] = updateJobProgress.mock.calls[1];
    expect(completedPayload.persist).toEqual({
      status: 'completed',
      source: 'collector',
      articles: 100,
      videos: 30,
      comments: 250,
    });
  });

  it('persistFromCollectorPayload 실패 시 progress=failed + appendJobEvent warn', async () => {
    persistFromCollectorPayload.mockRejectedValueOnce(new Error('FK constraint'));
    await persistCollectorFullset(1, { fullset: [] as never });

    expect(updateJobProgress).toHaveBeenCalledTimes(2);
    const [, failedPayload] = updateJobProgress.mock.calls[1];
    expect(failedPayload.persist.status).toBe('failed');
    expect(failedPayload.persist.error).toContain('FK constraint');

    expect(appendJobEvent).toHaveBeenCalledOnce();
    const [, level, message] = appendJobEvent.mock.calls[0];
    expect(level).toBe('warn');
    expect(message).toContain('persistFromCollectorPayload 실패');
  });
});

describe('recordSamplingStats', () => {
  it('progress payload에 sampling 통계 매핑', async () => {
    const stats = {
      binCount: 4,
      binIntervalMs: 3600000,
      articles: {
        totalInput: 1000,
        totalSampled: 500,
        binsUsed: 4,
        nullPoolSize: 50,
        nullPoolSampled: 25,
        perBin: [
          {
            start: new Date('2026-04-01T00:00:00Z'),
            end: new Date('2026-04-01T01:00:00Z'),
            inputCount: 250,
            sampledCount: 125,
          },
        ],
      },
      comments: {
        totalInput: 2000,
        totalSampled: 1000,
        binsUsed: 4,
        nullPoolSize: 0,
        nullPoolSampled: 0,
        perBin: [],
      },
      videos: {
        totalInput: 50,
        totalSampled: 50,
        binsUsed: 4,
        nullPoolSize: 0,
        nullPoolSampled: 0,
      },
    };
    await recordSamplingStats(7, stats);

    expect(updateJobProgress).toHaveBeenCalledOnce();
    const [jobId, payload] = updateJobProgress.mock.calls[0];
    expect(jobId).toBe(7);
    expect(payload.sampling.status).toBe('completed');
    expect(payload.sampling.binCount).toBe(4);
    expect(payload.sampling.articles.totalInput).toBe(1000);
    // perBin의 Date를 ISO string으로 변환
    expect(payload.sampling.articles.perBin[0].start).toBe('2026-04-01T00:00:00.000Z');
    expect(payload.sampling.articles.perBin[0].end).toBe('2026-04-01T01:00:00.000Z');
    // videos는 perBin 없음
    expect(payload.sampling.videos.perBin).toBeUndefined();
  });
});
