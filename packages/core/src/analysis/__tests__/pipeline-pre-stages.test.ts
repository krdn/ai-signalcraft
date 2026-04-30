// pipeline-pre-stages 헬퍼의 fixture 기반 회귀 테스트.
//
// runDomainNormalization / runTokenOptimization은 input을 변형해 반환.
// 정상/실패 분기에서 progress 페이로드와 반환 input이 회귀 없는지 검증.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDomainNormalization, runTokenOptimization } from '../pipeline-pre-stages';
import type { AnalysisInput } from '../types';

const updateJobProgress = vi.fn();
const recordStageDuration = vi.fn();
const normalizeAnalysisInput = vi.fn();
const preprocessAnalysisInput = vi.fn();

vi.mock('../../pipeline/persist', () => ({
  updateJobProgress: (...args: unknown[]) => updateJobProgress(...args),
}));
vi.mock('../../metrics', () => ({
  recordStageDuration: (...args: unknown[]) => recordStageDuration(...args),
  withSpan: async (_name: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('../preprocessing', () => ({
  normalizeAnalysisInput: (...args: unknown[]) => normalizeAnalysisInput(...args),
  preprocessAnalysisInput: (...args: unknown[]) => preprocessAnalysisInput(...args),
}));
// rag-retriever / sampling은 dynamic import이므로 vi.mock보다는 자동 모듈 해결에 의존.

beforeEach(() => {
  updateJobProgress.mockReset();
  updateJobProgress.mockResolvedValue(undefined);
  recordStageDuration.mockReset();
  recordStageDuration.mockResolvedValue(undefined);
  normalizeAnalysisInput.mockReset();
  preprocessAnalysisInput.mockReset();
});

const baseInput: AnalysisInput = {
  jobId: 1,
  keyword: '테스트',
  domain: 'political',
  dateRange: { start: new Date('2026-04-01'), end: new Date('2026-04-08') },
  articles: [],
  videos: [],
  comments: [],
} as AnalysisInput;

describe('runDomainNormalization', () => {
  it('정상 시 normalizeAnalysisInput 결과를 반환 + progress completed', async () => {
    const normalized = { ...baseInput, articles: [{ source: 'a' } as never] };
    normalizeAnalysisInput.mockReturnValueOnce({
      input: normalized,
      stats: { matched: 5 },
    });

    const result = await runDomainNormalization(1, baseInput);

    expect(result).toBe(normalized);
    expect(updateJobProgress).toHaveBeenCalledTimes(2);
    const [, runningPayload] = updateJobProgress.mock.calls[0];
    expect(runningPayload.normalization.status).toBe('running');
    expect(runningPayload.normalization.domain).toBe('political');

    const [, completedPayload] = updateJobProgress.mock.calls[1];
    expect(completedPayload.normalization.status).toBe('completed');
    expect(completedPayload.normalization.matched).toBe(5);
  });

  it('실패 시 원본 input 반환 + progress failed (분석 차단 아님)', async () => {
    normalizeAnalysisInput.mockImplementationOnce(() => {
      throw new Error('정규화 사전 손상');
    });

    const result = await runDomainNormalization(1, baseInput);

    expect(result).toBe(baseInput); // 원본 그대로
    const failedCalls = updateJobProgress.mock.calls.filter(
      ([, payload]) => payload.normalization?.status === 'failed',
    );
    expect(failedCalls).toHaveLength(1);
  });

  it('domain 미지정 시 default로 progress 기록', async () => {
    const noDomainInput = { ...baseInput, domain: undefined };
    normalizeAnalysisInput.mockReturnValueOnce({ input: noDomainInput, stats: {} });

    await runDomainNormalization(1, noDomainInput);
    const [, runningPayload] = updateJobProgress.mock.calls[0];
    expect(runningPayload.normalization.domain).toBe('default');
  });
});

describe('runTokenOptimization', () => {
  it('tokenOptimization=none이면 progress=skipped + input 그대로', async () => {
    const result = await runTokenOptimization({
      jobId: 1,
      input: baseInput,
      tokenOptimization: 'none',
      isCollectorPath: false,
    });

    expect(result).toBe(baseInput);
    expect(updateJobProgress).toHaveBeenCalledOnce();
    const [, payload] = updateJobProgress.mock.calls[0];
    expect(payload['token-optimization'].status).toBe('skipped');
    expect(preprocessAnalysisInput).not.toHaveBeenCalled();
  });

  it('일반 RAG 외 프리셋 + collector 경로 아님 → preprocessAnalysisInput 위임', async () => {
    const preprocessed = {
      input: { ...baseInput, articles: [{ id: 1 } as never] },
      stats: { dedupRatio: 0.3 },
    };
    preprocessAnalysisInput.mockResolvedValueOnce(preprocessed);

    const result = await runTokenOptimization({
      jobId: 1,
      input: baseInput,
      tokenOptimization: 'standard',
      isCollectorPath: false,
    });

    expect(result).toBe(preprocessed.input);
    expect(preprocessAnalysisInput).toHaveBeenCalledWith(baseInput, 'standard', 1, {
      skipNormalization: true,
    });
    const completedCall = updateJobProgress.mock.calls.find(
      ([, p]) => p['token-optimization']?.status === 'completed',
    );
    expect(completedCall).toBeDefined();
    expect(completedCall![1]['token-optimization'].dedupRatio).toBe(0.3);
  });

  it('preprocessAnalysisInput 실패 시 원본 input 반환 + progress=failed', async () => {
    preprocessAnalysisInput.mockRejectedValueOnce(new Error('LLM down'));

    const result = await runTokenOptimization({
      jobId: 1,
      input: baseInput,
      tokenOptimization: 'aggressive',
      isCollectorPath: false,
    });

    expect(result).toBe(baseInput);
    const failedCall = updateJobProgress.mock.calls.find(
      ([, p]) => p['token-optimization']?.status === 'failed',
    );
    expect(failedCall).toBeDefined();
  });
});
