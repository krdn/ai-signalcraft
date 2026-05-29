import { composeTickerAnalysis, type AnalysisResult } from '@krdn/tickerlens';
import type { ModelConfigAdapter, AIProvider } from '@krdn/llm-gateway';
import { getProviderKeyInfo } from '../model-config';

// 주식 분석용 고정 모델 (per-persona 튜닝은 YAGNI — 단일 모델로 16개 모듈 모두 처리)
const STOCK_PROVIDER: AIProvider = 'anthropic';
const STOCK_MODEL = 'claude-sonnet-4-6';

export async function analyzeTicker(
  ticker: string,
  opts?: { depth?: 'full' | 'lite' },
): Promise<AnalysisResult> {
  // 키를 진입부에서 한 번 검증 — Yahoo 페치 전 즉시 실패, DB 조회 1회로 축소
  const keyInfo = await getProviderKeyInfo(STOCK_PROVIDER, STOCK_MODEL);
  if (!keyInfo?.apiKey) {
    throw new Error(
      `주식 분석용 프로바이더 키가 설정되지 않았습니다 (${STOCK_PROVIDER}). 설정에서 키를 등록하세요.`,
    );
  }
  const apiKey = keyInfo.apiKey;

  // 모듈 이름과 무관하게 단일 provider/model + 복호화 키를 resolve (클로저 바인딩)
  const configAdapter: ModelConfigAdapter = {
    async resolve(_moduleName: string) {
      return {
        provider: STOCK_PROVIDER,
        model: STOCK_MODEL,
        apiKey,
        ...(keyInfo.baseUrl ? { baseUrl: keyInfo.baseUrl } : {}),
      };
    },
  };

  return composeTickerAnalysis(ticker, { configAdapter, depth: opts?.depth ?? 'lite' });
}
