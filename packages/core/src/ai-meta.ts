// 프로바이더 메타 정보 — 클라이언트 번들 안전 (순수 데이터)
//
// 주의: `@krdn/ai-analysis-kit/gateway`를 re-export하면 barrel을 통해
// OpenTelemetry/gemini-cli-core 등 Node 전용 의존성이 브라우저 번들에 포함됨.
// 따라서 메타 데이터를 여기에 인라인으로 정의. 업스트림 변경 시 동기화 필요.
// 원본: @krdn/ai-analysis-kit/src/gateway/provider-meta.ts

export type AIProvider =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'gemini-cli'
  | 'claude-cli'
  | 'ollama'
  | 'deepseek'
  | 'xai'
  | 'openrouter'
  | 'custom';

export type AccessMethod = 'direct-api' | 'proxy-cli' | 'local';

export interface ProviderMeta {
  type: AIProvider;
  displayName: string;
  accessMethod: AccessMethod;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  supportsStructuredOutput: boolean;
  requiresJsonMode: boolean;
  color: string;
}

export const PROVIDER_REGISTRY: Record<AIProvider, ProviderMeta> = {
  // --- 직접 API ---
  anthropic: {
    type: 'anthropic',
    displayName: 'Anthropic (Claude)',
    accessMethod: 'direct-api',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsStructuredOutput: true,
    requiresJsonMode: false,
    color: 'bg-orange-500',
  },
  openai: {
    type: 'openai',
    displayName: 'OpenAI (ChatGPT)',
    accessMethod: 'direct-api',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportsStructuredOutput: true,
    requiresJsonMode: false,
    color: 'bg-green-500',
  },
  gemini: {
    type: 'gemini',
    displayName: 'Google (Gemini)',
    accessMethod: 'direct-api',
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsStructuredOutput: true,
    requiresJsonMode: false,
    color: 'bg-blue-500',
  },
  deepseek: {
    type: 'deepseek',
    displayName: 'DeepSeek',
    accessMethod: 'direct-api',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    supportsStructuredOutput: true,
    requiresJsonMode: false,
    color: 'bg-purple-500',
  },
  xai: {
    type: 'xai',
    displayName: 'xAI (Grok)',
    accessMethod: 'direct-api',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.x.ai/v1',
    supportsStructuredOutput: true,
    requiresJsonMode: false,
    color: 'bg-red-500',
  },
  openrouter: {
    type: 'openrouter',
    displayName: 'OpenRouter',
    accessMethod: 'direct-api',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    supportsStructuredOutput: true,
    requiresJsonMode: true,
    color: 'bg-cyan-500',
  },
  // --- Proxy CLI ---
  'claude-cli': {
    type: 'claude-cli',
    displayName: 'Claude CLI (Proxy)',
    accessMethod: 'proxy-cli',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:8317',
    supportsStructuredOutput: false,
    requiresJsonMode: false,
    color: 'bg-amber-500',
  },
  'gemini-cli': {
    type: 'gemini-cli',
    displayName: 'Gemini CLI (Proxy)',
    accessMethod: 'proxy-cli',
    requiresApiKey: false,
    requiresBaseUrl: false,
    supportsStructuredOutput: false,
    requiresJsonMode: false,
    color: 'bg-teal-500',
  },
  // --- 로컬 ---
  ollama: {
    type: 'ollama',
    displayName: 'Ollama (Local)',
    accessMethod: 'local',
    requiresApiKey: false,
    requiresBaseUrl: false,
    defaultBaseUrl: 'http://localhost:11434',
    supportsStructuredOutput: false,
    requiresJsonMode: false,
    color: 'bg-gray-500',
  },
  custom: {
    type: 'custom',
    displayName: 'Custom (OpenAI Compatible)',
    accessMethod: 'local',
    requiresApiKey: false,
    requiresBaseUrl: true,
    supportsStructuredOutput: false,
    requiresJsonMode: false,
    color: 'bg-zinc-500',
  },
};

export const AI_PROVIDER_VALUES = Object.keys(PROVIDER_REGISTRY) as [AIProvider, ...AIProvider[]];

export function getProvidersByAccess(method: AccessMethod): ProviderMeta[] {
  return Object.values(PROVIDER_REGISTRY).filter((p) => p.accessMethod === method);
}

export function isProxyCli(provider: AIProvider): boolean {
  return PROVIDER_REGISTRY[provider]?.accessMethod === 'proxy-cli';
}

export function needsTextFallback(provider: AIProvider): boolean {
  return !PROVIDER_REGISTRY[provider]?.supportsStructuredOutput;
}

export function needsJsonMode(provider: AIProvider): boolean {
  return PROVIDER_REGISTRY[provider]?.requiresJsonMode ?? false;
}
