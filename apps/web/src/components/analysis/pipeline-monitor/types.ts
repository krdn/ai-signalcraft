// 파이프라인 모니터 공유 타입

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled' | 'paused';
export type ModuleStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ItemDetail {
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  comments: number;
}

export interface SourceDetail {
  status: string;
  count: number;
  label: string;
  articleDetails?: ItemDetail[];
  videoDetails?: ItemDetail[];
}

export interface ModuleUsage {
  input: number;
  output: number;
  provider: string;
  model: string;
}

export interface AnalysisModuleDetailed {
  module: string;
  label: string;
  status: ModuleStatus;
  stage: number;
  usage: ModuleUsage | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface TokenUsage {
  total: { input: number; output: number };
  byModule: Array<{
    module: string;
    input: number;
    output: number;
    provider: string;
    model: string;
  }>;
  estimatedCostUsd: number;
}

export interface PipelineTimeline {
  jobCreatedAt: string;
  jobUpdatedAt: string;
  analysisStartedAt: string | null;
  analysisCompletedAt: string | null;
  reportCompletedAt: string | null;
}

export interface PipelineEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface PipelineStatusData {
  status: string;
  keyword: string;
  progress: unknown;
  errorDetails: unknown;
  pipelineStages: Record<string, { status: string }>;
  analysisModuleCount: { total: number; completed: number };
  hasReport: boolean;
  sourceDetails: Record<string, SourceDetail>;
  analysisModules: Array<{ module: string; status: ModuleStatus; label: string }>;
  elapsedSeconds: number;
  // 제어 관련 필드
  costLimitUsd: number | null;
  skippedModules: string[];
  // 확장 필드
  overallProgress: number;
  tokenUsage: TokenUsage;
  timeline: PipelineTimeline;
  analysisModulesDetailed: AnalysisModuleDetailed[];
  events: PipelineEvent[];
}
