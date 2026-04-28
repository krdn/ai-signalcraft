import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStage5Manipulation } from '../stage5';

const eventLog: { level: string; msg: string }[] = [];

vi.mock('../../../pipeline/persist', () => ({
  appendJobEvent: vi.fn(async (_jobId: number, level: string, msg: string) => {
    eventLog.push({ level, msg });
  }),
}));

const runDetectionMock = vi.fn();
vi.mock('../runner', () => ({
  runManipulationDetection: (...args: unknown[]) => runDetectionMock(...args),
}));

const persistRunMock = vi.fn();
vi.mock('../persist', () => ({
  persistRun: (...args: unknown[]) => persistRunMock(...args),
}));

const resolveConfigMock = vi.fn();
vi.mock('../config', () => ({
  resolveDomainConfig: (...args: unknown[]) => resolveConfigMock(...args),
}));

vi.mock('../../../db', () => ({
  getDb: () => ({}),
}));

vi.mock('../../../collector-client', () => ({
  getCollectorClient: () => ({
    items: {
      query: { query: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) },
      fetchManipulationBaselines: { query: vi.fn().mockResolvedValue({ byHour: {} }) },
    },
  }),
}));

describe('runStage5Manipulation', () => {
  beforeEach(() => {
    eventLog.length = 0;
    runDetectionMock.mockReset();
    persistRunMock.mockReset();
    resolveConfigMock.mockReset();
  });

  it('runManipulation !== true 이면 즉시 SKIP — appendJobEvent도 호출하지 않음', async () => {
    await runStage5Manipulation({
      jobId: 1,
      jobOptions: { runManipulation: false, subscriptionId: 42 },
      domain: 'political',
      dateRange: { start: new Date(), end: new Date() },
    });
    expect(runDetectionMock).not.toHaveBeenCalled();
    expect(eventLog).toEqual([]);
  });

  it('subscriptionId가 없으면 SKIP', async () => {
    await runStage5Manipulation({
      jobId: 1,
      jobOptions: { runManipulation: true },
      domain: 'political',
      dateRange: { start: new Date(), end: new Date() },
    });
    expect(runDetectionMock).not.toHaveBeenCalled();
    expect(eventLog).toEqual([]);
  });

  it('정상 흐름 — config 로드 → 분석 → persist → info 이벤트', async () => {
    resolveConfigMock.mockResolvedValue({
      domain: 'political',
      weights: {} as never,
      thresholds: {} as never,
      baselineDays: 30,
      narrativeContext: '',
    });
    runDetectionMock.mockResolvedValue({
      signals: [],
      aggregate: { manipulationScore: 42.7, confidenceFactor: 0.8, signalScores: {} },
    });
    persistRunMock.mockResolvedValue('run-uuid-1');

    await runStage5Manipulation({
      jobId: 100,
      jobOptions: { runManipulation: true, subscriptionId: 42 },
      domain: 'political',
      dateRange: { start: new Date('2026-04-21'), end: new Date('2026-04-28') },
    });

    expect(resolveConfigMock).toHaveBeenCalledWith('political');
    expect(runDetectionMock).toHaveBeenCalledTimes(1);
    expect(persistRunMock).toHaveBeenCalledTimes(1);
    expect(eventLog).toContainEqual({
      level: 'info',
      msg: expect.stringContaining('manipulation 분석 시작'),
    });
    expect(eventLog).toContainEqual({
      level: 'info',
      msg: expect.stringContaining('42.7'),
    });
  });

  it('실행 중 throw 발생 시 warn 이벤트만 남기고 본 함수는 정상 반환 (격리)', async () => {
    resolveConfigMock.mockResolvedValue({
      domain: 'political',
      weights: {} as never,
      thresholds: {} as never,
      baselineDays: 30,
      narrativeContext: '',
    });
    runDetectionMock.mockRejectedValue(new Error('boom'));

    await expect(
      runStage5Manipulation({
        jobId: 100,
        jobOptions: { runManipulation: true, subscriptionId: 42 },
        domain: 'political',
        dateRange: { start: new Date('2026-04-21'), end: new Date('2026-04-28') },
      }),
    ).resolves.toBeUndefined();

    expect(eventLog).toContainEqual({
      level: 'warn',
      msg: expect.stringContaining('manipulation 실패: boom'),
    });
  });

  it('manipulationDomainOverride가 있으면 그 도메인으로 config 로드', async () => {
    resolveConfigMock.mockResolvedValue({
      domain: 'economic',
      weights: {} as never,
      thresholds: {} as never,
      baselineDays: 30,
      narrativeContext: '',
    });
    runDetectionMock.mockResolvedValue({
      signals: [],
      aggregate: { manipulationScore: 0, confidenceFactor: 1, signalScores: {} },
    });
    persistRunMock.mockResolvedValue('run-uuid-2');

    await runStage5Manipulation({
      jobId: 100,
      jobOptions: {
        runManipulation: true,
        subscriptionId: 42,
        manipulationDomainOverride: 'economic',
      },
      domain: 'political',
      dateRange: { start: new Date(), end: new Date() },
    });

    expect(resolveConfigMock).toHaveBeenCalledWith('economic');
  });
});
