import { composeTickerAnalysis, type AnalysisResult } from '@krdn/tickerlens';
import type { ModelConfigAdapter } from '@krdn/llm-gateway/adapters';
import type { AIProvider } from '@krdn/llm-gateway';
import { getProviderKeyInfo } from '../model-config';

// 주식 분석용 고정 모델 (per-persona 튜닝은 YAGNI — 단일 모델로 16개 모듈 모두 처리)
const STOCK_PROVIDER: AIProvider = 'anthropic';
const STOCK_MODEL = 'claude-sonnet-4-6';

/** 모듈 이름과 무관하게 단일 provider/model + 복호화 키를 resolve하는 어댑터 */
function createStockConfigAdapter(): ModelConfigAdapter {
  return {
    async resolve(_moduleName: string) {
      const keyInfo = await getProviderKeyInfo(STOCK_PROVIDER, STOCK_MODEL);
      if (!keyInfo?.apiKey) {
        throw new Error(
          `주식 분석용 프로바이더 키가 설정되지 않았습니다 (${STOCK_PROVIDER}). 설정에서 키를 등록하세요.`,
        );
      }
      return {
        provider: STOCK_PROVIDER,
        model: STOCK_MODEL,
        apiKey: keyInfo.apiKey,
        ...(keyInfo.baseUrl ? { baseUrl: keyInfo.baseUrl } : {}),
      };
    },
  };
}

export async function analyzeTicker(
  ticker: string,
  opts?: { depth?: 'full' | 'lite' },
): Promise<AnalysisResult> {
  return composeTickerAnalysis(ticker, {
    configAdapter: createStockConfigAdapter(),
    depth: opts?.depth ?? 'lite',
  });
}
