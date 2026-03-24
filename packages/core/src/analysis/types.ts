import { z } from 'zod';

// AI 프로바이더 타입 (ai-gateway의 AIProvider와 동일)
export type AIProvider = 'anthropic' | 'openai';

// 분석 모듈 공통 인터페이스 (D-01)
export interface AnalysisModule<T = unknown> {
  readonly name: string;           // 'macro-view', 'segmentation', etc.
  readonly displayName: string;    // '전체 여론 구조 분석'
  readonly provider: AIProvider;   // D-03: 모듈별 AI 모델 지정
  readonly model: string;          // 'gpt-4o-mini' or 'claude-sonnet-4-20250514'
  readonly schema: z.ZodType<T>;   // 모듈별 Zod 스키마

  buildPrompt(data: AnalysisInput): string;
  buildSystemPrompt(): string;
  // 선행 분석 결과가 필요한 모듈용 (모듈5~7)
  buildPromptWithContext?(data: AnalysisInput, priorResults: Record<string, unknown>): string;
}

// 분석 입력 데이터 (DB에서 로드)
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

// 분석 모듈 실행 결과
export interface AnalysisModuleResult<T = unknown> {
  module: string;
  status: 'completed' | 'failed';
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

// 모듈별 AI 모델 매핑 (D-03)
export const MODULE_MODEL_MAP: Record<string, { provider: AIProvider; model: string }> = {
  'macro-view':        { provider: 'openai',    model: 'gpt-4o-mini' },
  'segmentation':      { provider: 'openai',    model: 'gpt-4o-mini' },
  'sentiment-framing': { provider: 'openai',    model: 'gpt-4o-mini' },
  'message-impact':    { provider: 'openai',    model: 'gpt-4o-mini' },
  'risk-map':          { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'opportunity':       { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'strategy':          { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'final-summary':     { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'integrated-report': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
};

// 모듈 이름 상수
export const MODULE_NAMES = {
  MACRO_VIEW: 'macro-view',
  SEGMENTATION: 'segmentation',
  SENTIMENT_FRAMING: 'sentiment-framing',
  MESSAGE_IMPACT: 'message-impact',
  RISK_MAP: 'risk-map',
  OPPORTUNITY: 'opportunity',
  STRATEGY: 'strategy',
  FINAL_SUMMARY: 'final-summary',
} as const;
