import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockState = {
  selectCalls: 0,
  jobs: [] as any[],
  updateCalls: [] as any[],
};

vi.mock('../../db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const idx = Math.min(mockState.selectCalls, mockState.jobs.length - 1);
            mockState.selectCalls += 1;
            return Promise.resolve([mockState.jobs[idx]]);
          },
        }),
      }),
    }),
    update: () => ({
      set: (values: any) => ({
        where: () => {
          mockState.updateCalls.push(values);
          return Promise.resolve();
        },
      }),
    }),
  }),
}));

vi.mock('../persist', () => ({
  appendJobEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../control', () => ({
  cancelPipeline: vi.fn().mockResolvedValue({ cancelled: true, message: 'cancelled' }),
}));

beforeEach(() => {
  mockState.selectCalls = 0;
  mockState.jobs = [];
  mockState.updateCalls = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('awaitStageGate', () => {
  it('breakpoints에 포함되지 않은 stage는 즉시 통과', async () => {
    mockState.jobs = [{ status: 'running', breakpoints: ['analysis-stage1'], resumeMode: null }];
    const { awaitStageGate } = await import('../pipeline-checks');
    const result = await awaitStageGate(1, 'collection');
    expect(result).toBe(true);
  });

  it('cancelled 상태면 즉시 false 반환', async () => {
    mockState.jobs = [{ status: 'cancelled', breakpoints: [], resumeMode: null }];
    const { awaitStageGate } = await import('../pipeline-checks');
    const result = await awaitStageGate(1, 'collection');
    expect(result).toBe(false);
  });

  it('breakpoints에 포함된 stage는 paused 후 running 복귀 시 통과', async () => {
    vi.useFakeTimers();
    // Sequence: initial check (breakpoint match) → update to paused → poll (still paused) → poll (running)
    mockState.jobs = [
      { status: 'running', breakpoints: ['collection'], resumeMode: null }, // initial
      { status: 'paused', breakpoints: ['collection'], resumeMode: null }, // first poll
      { status: 'running', breakpoints: ['collection'], resumeMode: null }, // second poll → resumed
    ];
    const { awaitStageGate } = await import('../pipeline-checks');
    const promise = awaitStageGate(1, 'collection');
    // Advance through polling delays
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe(true);
    // Verify it set status='paused' at some point
    expect(mockState.updateCalls.some((c) => c.status === 'paused')).toBe(true);
  });
});
