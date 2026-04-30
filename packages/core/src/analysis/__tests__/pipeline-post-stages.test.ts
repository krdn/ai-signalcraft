// pipeline-post-stages 헬퍼의 fixture 기반 회귀 테스트.
//
// runStage5IfEnabled / runPostAnalysisStages 두 함수는 비차단 사이드 이펙트.
// 분기 결정과 mock 호출 인자를 검증.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStage5IfEnabled, runPostAnalysisStages } from '../pipeline-post-stages';
import type { AnalysisModuleResult } from '../types';

const runStage5Manipulation = vi.fn();
const evaluateAlerts = vi.fn();
const extractEntitiesFromResults = vi.fn();
const persistOntology = vi.fn();
const runSeriesDeltaAnalysis = vi.fn();
const appendJobEvent = vi.fn();
const dbSelect = vi.fn();

vi.mock('../manipulation', () => ({
  runStage5Manipulation: (...args: unknown[]) => runStage5Manipulation(...args),
}));
vi.mock('../../alerts', () => ({
  evaluateAlerts: (...args: unknown[]) => evaluateAlerts(...args),
}));
vi.mock('../ontology-extractor', () => ({
  extractEntitiesFromResults: (...args: unknown[]) => extractEntitiesFromResults(...args),
}));
vi.mock('../persist-ontology', () => ({
  persistOntology: (...args: unknown[]) => persistOntology(...args),
}));
vi.mock('../delta', () => ({
  runSeriesDeltaAnalysis: (...args: unknown[]) => runSeriesDeltaAnalysis(...args),
}));
vi.mock('../../pipeline/persist', () => ({
  appendJobEvent: (...args: unknown[]) => appendJobEvent(...args),
}));
vi.mock('../../db', () => ({
  getDb: () => ({
    select: (...args: unknown[]) => dbSelect(...args),
  }),
}));

beforeEach(() => {
  runStage5Manipulation.mockReset();
  runStage5Manipulation.mockResolvedValue(undefined);
  evaluateAlerts.mockReset();
  evaluateAlerts.mockResolvedValue(undefined);
  extractEntitiesFromResults.mockReset();
  persistOntology.mockReset();
  persistOntology.mockResolvedValue({ entityCount: 0, relationCount: 0 });
  runSeriesDeltaAnalysis.mockReset();
  runSeriesDeltaAnalysis.mockResolvedValue(undefined);
  appendJobEvent.mockReset();
  appendJobEvent.mockResolvedValue(undefined);
  dbSelect.mockReset();
});

describe('runStage5IfEnabled', () => {
  it('cancelledByUser=true면 즉시 반환 (DB 조회/runStage5 미호출)', async () => {
    await runStage5IfEnabled({
      jobId: 1,
      jobOptions: { runManipulation: true },
      domain: 'political',
      cancelledByUser: true,
      costLimitExceeded: false,
    });
    expect(dbSelect).not.toHaveBeenCalled();
    expect(runStage5Manipulation).not.toHaveBeenCalled();
  });

  it('costLimitExceeded=true도 즉시 반환', async () => {
    await runStage5IfEnabled({
      jobId: 1,
      jobOptions: {},
      domain: 'political',
      cancelledByUser: false,
      costLimitExceeded: true,
    });
    expect(runStage5Manipulation).not.toHaveBeenCalled();
  });

  it('startDate/endDate 둘 다 있으면 runStage5Manipulation 호출', async () => {
    const startDate = new Date('2026-04-01');
    const endDate = new Date('2026-04-08');
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ startDate, endDate }]),
        }),
      }),
    });

    await runStage5IfEnabled({
      jobId: 5,
      jobOptions: { runManipulation: true, subscriptionId: 7 },
      domain: 'fandom',
      cancelledByUser: false,
      costLimitExceeded: false,
    });

    expect(runStage5Manipulation).toHaveBeenCalledOnce();
    const [arg] = runStage5Manipulation.mock.calls[0];
    expect(arg.jobId).toBe(5);
    expect(arg.domain).toBe('fandom');
    expect(arg.dateRange.start).toBe(startDate);
    expect(arg.dateRange.end).toBe(endDate);
  });

  it('domain 미지정 시 political로 폴백', async () => {
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ startDate: new Date(), endDate: new Date() }]),
        }),
      }),
    });
    await runStage5IfEnabled({
      jobId: 1,
      jobOptions: {},
      domain: undefined,
      cancelledByUser: false,
      costLimitExceeded: false,
    });
    expect(runStage5Manipulation.mock.calls[0][0].domain).toBe('political');
  });

  it('startDate/endDate 누락 시 runStage5 미호출 (logError만)', async () => {
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ startDate: null, endDate: null }]),
        }),
      }),
    });
    await runStage5IfEnabled({
      jobId: 1,
      jobOptions: {},
      domain: 'political',
      cancelledByUser: false,
      costLimitExceeded: false,
    });
    expect(runStage5Manipulation).not.toHaveBeenCalled();
  });

  it('runStage5Manipulation throw해도 propagate 안 함 (비차단)', async () => {
    dbSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ startDate: new Date(), endDate: new Date() }]),
        }),
      }),
    });
    runStage5Manipulation.mockRejectedValueOnce(new Error('manip failed'));

    await expect(
      runStage5IfEnabled({
        jobId: 1,
        jobOptions: {},
        domain: 'political',
        cancelledByUser: false,
        costLimitExceeded: false,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('runPostAnalysisStages', () => {
  it('completed 모듈만 ontology 추출에 전달', async () => {
    const allResults: Record<string, AnalysisModuleResult> = {
      a: { module: 'a', status: 'completed', result: { x: 1 } } as AnalysisModuleResult,
      b: { module: 'b', status: 'failed' } as AnalysisModuleResult,
      c: { module: 'c', status: 'completed', result: { y: 2 } } as AnalysisModuleResult,
    };
    extractEntitiesFromResults.mockReturnValueOnce({ entities: [], relations: [] });
    dbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ seriesId: null }]),
        }),
      }),
    });

    await runPostAnalysisStages(1, allResults);

    expect(extractEntitiesFromResults).toHaveBeenCalledOnce();
    const [resultsArg] = extractEntitiesFromResults.mock.calls[0];
    expect(Object.keys(resultsArg).sort()).toEqual(['a', 'c']); // failed b 제외
  });

  it('entities 있으면 persistOntology 호출 + appendJobEvent info', async () => {
    extractEntitiesFromResults.mockReturnValueOnce({
      entities: [{ name: 'X', type: 'person' }],
      relations: [{ from: 'X', to: 'Y' }],
    });
    persistOntology.mockResolvedValueOnce({ entityCount: 1, relationCount: 1 });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ seriesId: null }]) }) }),
    });

    await runPostAnalysisStages(7, {
      a: { module: 'a', status: 'completed', result: {} } as AnalysisModuleResult,
    });

    expect(persistOntology).toHaveBeenCalledOnce();
    expect(appendJobEvent).toHaveBeenCalled();
    const lastEvent = appendJobEvent.mock.calls.at(-1)!;
    expect(lastEvent[1]).toBe('info');
    expect(lastEvent[2]).toContain('온톨로지 추출 완료');
  });

  it('seriesId 있으면 runSeriesDeltaAnalysis 호출', async () => {
    extractEntitiesFromResults.mockReturnValueOnce({ entities: [], relations: [] });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ seriesId: 99 }]) }) }),
    });

    await runPostAnalysisStages(1, {});

    expect(runSeriesDeltaAnalysis).toHaveBeenCalledWith(99, 1);
  });

  it('seriesId 없으면 delta 미호출', async () => {
    extractEntitiesFromResults.mockReturnValueOnce({ entities: [], relations: [] });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ seriesId: null }]) }) }),
    });

    await runPostAnalysisStages(1, {});

    expect(runSeriesDeltaAnalysis).not.toHaveBeenCalled();
  });

  it('evaluateAlerts는 항상 호출 (비차단)', async () => {
    extractEntitiesFromResults.mockReturnValueOnce({ entities: [], relations: [] });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ seriesId: null }]) }) }),
    });

    const allResults = { a: { module: 'a', status: 'completed' } as AnalysisModuleResult };
    await runPostAnalysisStages(1, allResults);

    expect(evaluateAlerts).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it('ontology 추출 throw해도 propagate 안 함 (try/catch)', async () => {
    extractEntitiesFromResults.mockImplementationOnce(() => {
      throw new Error('parse fail');
    });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ seriesId: null }]) }) }),
    });

    await expect(runPostAnalysisStages(1, {})).resolves.toBeUndefined();
  });
});
