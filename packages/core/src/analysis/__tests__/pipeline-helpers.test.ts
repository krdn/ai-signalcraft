/**
 * pipeline-helpers 테스트
 * 순수 함수 및 상태 뮤테이션 함수를 DB mock 없이 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PipelineContext } from '../pipeline-context';
import {
  isSkipped,
  isAlreadyCompleted,
  checkFailAndAbort,
  collectResults,
  markSkipped,
  preRunCheck,
} from '../pipeline-helpers';
vi.mock('../../db', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    then: vi.fn(),
  })),
}));

vi.mock('../persist-analysis', () => ({
  persistAnalysisResult: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../pipeline/control', () => ({
  isPipelineCancelled: vi.fn().mockResolvedValue(false),
  waitIfPaused: vi.fn().mockResolvedValue(true),
  checkCostLimit: vi.fn().mockResolvedValue({ exceeded: false, currentCost: 0, limit: 100 }),
}));

vi.mock('../../pipeline/persist', () => ({
  appendJobEvent: vi.fn().mockResolvedValue(undefined),
}));

function makeCtx(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    jobId: 1,
    input: { jobId: 1 } as any,
    allResults: {},
    priorResults: {},
    cancelledByUser: false,
    costLimitExceeded: false,
    skippedModules: [],
    providerConcurrency: {},
    modelAdapter: {} as any,
    ...overrides,
  };
}

// ---- isSkipped ----
describe('isSkipped', () => {
  it('skippedModules에 포함된 경우 true를 반환한다', () => {
    const ctx = makeCtx({ skippedModules: ['macro-view', 'segmentation'] });
    expect(isSkipped(ctx, 'macro-view')).toBe(true);
    expect(isSkipped(ctx, 'segmentation')).toBe(true);
  });

  it('skippedModules에 포함되지 않은 경우 false를 반환한다', () => {
    const ctx = makeCtx({ skippedModules: ['macro-view'] });
    expect(isSkipped(ctx, 'segmentation')).toBe(false);
  });

  it('skippedModules가 빈 배열이면 항상 false를 반환한다', () => {
    const ctx = makeCtx({ skippedModules: [] });
    expect(isSkipped(ctx, 'macro-view')).toBe(false);
    expect(isSkipped(ctx, 'any-module')).toBe(false);
  });
});

// ---- isAlreadyCompleted ----
describe('isAlreadyCompleted', () => {
  it('status가 completed인 경우 true를 반환한다', () => {
    const ctx = makeCtx({
      allResults: {
        'macro-view': { module: 'macro-view', status: 'completed' },
      },
    });
    expect(isAlreadyCompleted(ctx, 'macro-view')).toBe(true);
  });

  it('status가 failed인 경우 false를 반환한다', () => {
    const ctx = makeCtx({
      allResults: {
        'macro-view': { module: 'macro-view', status: 'failed' },
      },
    });
    expect(isAlreadyCompleted(ctx, 'macro-view')).toBe(false);
  });

  it('allResults에 존재하지 않는 모듈은 false를 반환한다', () => {
    const ctx = makeCtx({ allResults: {} });
    expect(isAlreadyCompleted(ctx, 'macro-view')).toBe(false);
  });

  it('status가 skipped인 경우 false를 반환한다', () => {
    const ctx = makeCtx({
      allResults: {
        'macro-view': { module: 'macro-view', status: 'skipped' },
      },
    });
    expect(isAlreadyCompleted(ctx, 'macro-view')).toBe(false);
  });
});

// ---- collectResults ----
describe('collectResults', () => {
  it('fulfilled 결과를 ctx.allResults에 반영한다', () => {
    const ctx = makeCtx();
    const settled: PromiseSettledResult<any>[] = [
      {
        status: 'fulfilled',
        value: { module: 'macro-view', status: 'completed', result: { data: 1 } },
      },
    ];
    collectResults(ctx, settled);
    expect(ctx.allResults['macro-view']).toEqual({
      module: 'macro-view',
      status: 'completed',
      result: { data: 1 },
    });
  });

  it('completed 결과는 ctx.priorResults에도 반영한다', () => {
    const ctx = makeCtx();
    const settled: PromiseSettledResult<any>[] = [
      {
        status: 'fulfilled',
        value: { module: 'segmentation', status: 'completed', result: { seg: 'data' } },
      },
    ];
    collectResults(ctx, settled);
    expect(ctx.priorResults['segmentation']).toEqual({ seg: 'data' });
  });

  it('failed 결과는 allResults에만 반영되고 priorResults에는 반영되지 않는다', () => {
    const ctx = makeCtx();
    const settled: PromiseSettledResult<any>[] = [
      {
        status: 'fulfilled',
        value: { module: 'risk-map', status: 'failed', errorMessage: '오류' },
      },
    ];
    collectResults(ctx, settled);
    expect(ctx.allResults['risk-map']).toBeDefined();
    expect(ctx.priorResults['risk-map']).toBeUndefined();
  });

  it('rejected 결과는 allResults에 반영되지 않는다', () => {
    const ctx = makeCtx();
    const settled: PromiseSettledResult<any>[] = [
      { status: 'rejected', reason: new Error('예외') },
    ];
    collectResults(ctx, settled);
    expect(Object.keys(ctx.allResults)).toHaveLength(0);
  });

  it('여러 결과를 한 번에 반영한다', () => {
    const ctx = makeCtx();
    const settled: PromiseSettledResult<any>[] = [
      {
        status: 'fulfilled',
        value: { module: 'macro-view', status: 'completed', result: { a: 1 } },
      },
      {
        status: 'fulfilled',
        value: { module: 'segmentation', status: 'failed' },
      },
    ];
    collectResults(ctx, settled);
    expect(ctx.allResults['macro-view'].status).toBe('completed');
    expect(ctx.allResults['segmentation'].status).toBe('failed');
    expect(ctx.priorResults['macro-view']).toEqual({ a: 1 });
    expect(ctx.priorResults['segmentation']).toBeUndefined();
  });
});

// ---- checkFailAndAbort ----
describe('checkFailAndAbort', () => {
  it('실패한 모듈이 없으면 false를 반환한다', () => {
    const ctx = makeCtx({
      allResults: {
        'macro-view': { module: 'macro-view', status: 'completed' },
      },
    });
    expect(checkFailAndAbort(ctx, 'Stage 1')).toBe(false);
  });

  it('일부만 실패하고 성공이 있으면 false를 반환한다 (부분 실패 허용)', () => {
    const ctx = makeCtx({
      allResults: {
        'macro-view': { module: 'macro-view', status: 'completed' },
        segmentation: { module: 'segmentation', status: 'failed' },
      },
    });
    expect(checkFailAndAbort(ctx, 'Stage 1')).toBe(false);
  });

  it('모두 실패하면 true를 반환한다 (전체 실패 중단)', () => {
    const ctx = makeCtx({
      allResults: {
        'macro-view': { module: 'macro-view', status: 'failed' },
        segmentation: { module: 'segmentation', status: 'failed' },
      },
    });
    expect(checkFailAndAbort(ctx, 'Stage 1')).toBe(true);
  });

  it('allResults가 비어있으면 false를 반환한다', () => {
    const ctx = makeCtx({ allResults: {} });
    expect(checkFailAndAbort(ctx, 'Stage 1')).toBe(false);
  });
});

// ---- markSkipped ----
describe('markSkipped', () => {
  it('ctx.allResults에 skipped 상태로 기록한다', async () => {
    const ctx = makeCtx();
    await markSkipped(ctx, 'macro-view');
    expect(ctx.allResults['macro-view']).toEqual({
      module: 'macro-view',
      status: 'skipped',
    });
  });

  it('persistAnalysisResult를 jobId와 함께 호출한다', async () => {
    const { persistAnalysisResult } = await import('../persist-analysis');
    const ctx = makeCtx({ jobId: 42 });
    await markSkipped(ctx, 'segmentation');
    expect(persistAnalysisResult).toHaveBeenCalledWith({
      jobId: 42,
      module: 'segmentation',
      status: 'skipped',
    });
  });
});

// ---- preRunCheck ----
describe('preRunCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('취소/일시정지/비용한도가 없으면 true를 반환한다', async () => {
    const { isPipelineCancelled, waitIfPaused, checkCostLimit } =
      await import('../../pipeline/control');
    vi.mocked(isPipelineCancelled).mockResolvedValue(false);
    vi.mocked(waitIfPaused).mockResolvedValue(true);
    vi.mocked(checkCostLimit).mockResolvedValue({ exceeded: false, currentCost: 0, limit: 100 });

    const ctx = makeCtx();
    const result = await preRunCheck(ctx);
    expect(result).toBe(true);
    expect(ctx.cancelledByUser).toBe(false);
    expect(ctx.costLimitExceeded).toBe(false);
  });

  it('파이프라인이 취소되면 false를 반환하고 ctx.cancelledByUser를 true로 설정한다', async () => {
    const { isPipelineCancelled } = await import('../../pipeline/control');
    vi.mocked(isPipelineCancelled).mockResolvedValue(true);

    const ctx = makeCtx();
    const result = await preRunCheck(ctx);
    expect(result).toBe(false);
    expect(ctx.cancelledByUser).toBe(true);
  });

  it('일시정지 후 재개 불가 시 false를 반환하고 ctx.cancelledByUser를 true로 설정한다', async () => {
    const { isPipelineCancelled, waitIfPaused } = await import('../../pipeline/control');
    vi.mocked(isPipelineCancelled).mockResolvedValue(false);
    vi.mocked(waitIfPaused).mockResolvedValue(false);

    const ctx = makeCtx();
    const result = await preRunCheck(ctx);
    expect(result).toBe(false);
    expect(ctx.cancelledByUser).toBe(true);
  });

  it('비용 한도 초과 시 false를 반환하고 ctx.costLimitExceeded를 true로 설정한다', async () => {
    const { isPipelineCancelled, waitIfPaused, checkCostLimit } =
      await import('../../pipeline/control');
    vi.mocked(isPipelineCancelled).mockResolvedValue(false);
    vi.mocked(waitIfPaused).mockResolvedValue(true);
    vi.mocked(checkCostLimit).mockResolvedValue({ exceeded: true, currentCost: 50, limit: 30 });

    const ctx = makeCtx();
    const result = await preRunCheck(ctx);
    expect(result).toBe(false);
    expect(ctx.costLimitExceeded).toBe(true);
  });
});
