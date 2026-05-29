import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeTicker } from '../analyze-ticker';

// tickerlens와 키 조회를 모킹 — 실제 LLM/Yahoo 호출 차단
const composeMock = vi.fn();
vi.mock('@krdn/tickerlens', () => ({
  composeTickerAnalysis: (...args: unknown[]) => composeMock(...args),
}));

const getProviderKeyInfoMock = vi.fn();
vi.mock('../../model-config', () => ({
  getProviderKeyInfo: (...args: unknown[]) => getProviderKeyInfoMock(...args),
}));

describe('analyzeTicker', () => {
  beforeEach(() => {
    composeMock.mockReset();
    getProviderKeyInfoMock.mockReset();
  });

  it('depth 미지정 시 lite를 기본값으로 composeTickerAnalysis에 전달', async () => {
    composeMock.mockResolvedValue({ ticker: 'AAPL' });
    await analyzeTicker('AAPL');
    expect(composeMock).toHaveBeenCalledWith('AAPL', expect.objectContaining({ depth: 'lite' }));
  });

  it('어댑터 resolve가 복호화된 apiKey와 고정 provider/model을 반환', async () => {
    getProviderKeyInfoMock.mockResolvedValue({
      selectedModel: null,
      baseUrl: null,
      apiKey: 'sk-decrypted',
    });
    composeMock.mockImplementation(async (_ticker, opts) => {
      const resolved = await opts.configAdapter.resolve('tickerlens.value.long');
      expect(resolved).toEqual({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKey: 'sk-decrypted',
      });
      return { ticker: 'AAPL' };
    });
    await analyzeTicker('AAPL', { depth: 'full' });
    expect(composeMock).toHaveBeenCalledWith('AAPL', expect.objectContaining({ depth: 'full' }));
  });

  it('apiKey 미설정 시 어댑터 resolve가 한국어 에러 throw', async () => {
    getProviderKeyInfoMock.mockResolvedValue({ selectedModel: null, baseUrl: null, apiKey: null });
    composeMock.mockImplementation(async (_ticker, opts) => {
      await opts.configAdapter.resolve('tickerlens.value.long');
      return { ticker: 'AAPL' };
    });
    await expect(analyzeTicker('AAPL')).rejects.toThrow(/프로바이더 키가 설정되지 않/);
  });
});
