import type { AIProvider } from '@krdn/ai-analysis-kit/gateway';

// 모듈별 AI 모델 설정 (per D-02, from model-config.ts)
export interface ModuleModelConfig {
  provider: AIProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

// 프로바이더 키 정보 (per D-02, from provider-keys.ts)
export interface ProviderKeyInfo {
  id: number;
  providerName: string;
  providerType: string;
  name: string;
  maskedKey: string | null;
  baseUrl: string | null;
  selectedModel: string | null;
  availableModels: string[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
