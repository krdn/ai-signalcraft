import { z } from 'zod';
import type { AIProvider } from '@ai-signalcraft/insight-gateway';

export type { AIProvider };
export type ProviderType = AIProvider;

/** 분석 모듈 공통 인터페이스 */
export interface AnalysisModule<T = unknown> {
  readonly name: string;
  readonly displayName: string;
  readonly provider: AIProvider;
  readonly model: string;
  readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>;

  buildPrompt(data: AnalysisInput): string;
  buildSystemPrompt(): string;
  /** 선행 분석 결과가 필요한 모듈용 (Stage 2+) */
  buildPromptWithContext?(data: AnalysisInput, priorResults: Record<string, unknown>): string;
}

/** 분석 입력 데이터 — 외부에서 주입 (DB 조회 없음) */
export interface AnalysisInput {
  jobId: number;
  keyword: string;
  articles: Array<{
    title: string;
    content: string | null;
    publisher: string | null;
    publishedAt: Date | null;
    source: string;
  }>;
  videos: Array<{
    title: string;
    description: string | null;
    channelTitle: string | null;
    viewCount: number | null;
    likeCount: number | null;
    publishedAt: Date | null;
  }>;
  comments: Array<{
    content: string;
    source: string;
    author: string | null;
    likeCount: number | null;
    dislikeCount: number | null;
    publishedAt: Date | null;
  }>;
  dateRange: { start: Date; end: Date };
}

/** 분석 모듈 실행 결과 */
export interface AnalysisModuleResult<T = unknown> {
  module: string;
  status: 'completed' | 'failed' | 'skipped';
  result?: T;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    provider: string;
    model: string;
  };
  errorMessage?: string;
}

/** 모듈별 실행 설정 — 호출자가 전달 */
export interface ModuleConfig {
  provider: AIProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  /** 기본 8192 */
  maxOutputTokens?: number;
  /** 기본 300000ms */
  timeoutMs?: number;
}

/** 모듈별 기본 모델 매핑 — 외부 설정 없을 때 fallback */
export const MODULE_MODEL_MAP: Record<string, { provider: AIProvider; model: string }> = {
  // Stage 1
  'macro-view': { provider: 'gemini', model: 'gemini-2.5-flash' },
  segmentation: { provider: 'gemini', model: 'gemini-2.5-flash' },
  'sentiment-framing': { provider: 'gemini', model: 'gemini-2.5-flash' },
  'message-impact': { provider: 'gemini', model: 'gemini-2.5-flash' },
  // Stage 2
  'risk-map': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  opportunity: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  strategy: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'final-summary': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'integrated-report': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  // Stage 4
  'approval-rating': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'frame-war': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'crisis-scenario': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'win-simulation': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
};

export const MODULE_NAMES = {
  MACRO_VIEW: 'macro-view',
  SEGMENTATION: 'segmentation',
  SENTIMENT_FRAMING: 'sentiment-framing',
  MESSAGE_IMPACT: 'message-impact',
  RISK_MAP: 'risk-map',
  OPPORTUNITY: 'opportunity',
  STRATEGY: 'strategy',
  FINAL_SUMMARY: 'final-summary',
  APPROVAL_RATING: 'approval-rating',
  FRAME_WAR: 'frame-war',
  CRISIS_SCENARIO: 'crisis-scenario',
  WIN_SIMULATION: 'win-simulation',
} as const;
