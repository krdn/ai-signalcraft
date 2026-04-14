// 파이프라인 실행 컨텍스트 — 헬퍼 함수들이 공유하는 상태 객체
import type { AnalysisInput, AnalysisModuleResult } from './types';
import type { ModelConfigAdapter } from './runner';

export interface PipelineContext {
  jobId: number;
  input: AnalysisInput;
  allResults: Record<string, AnalysisModuleResult>;
  priorResults: Record<string, unknown>;
  cancelledByUser: boolean;
  costLimitExceeded: boolean;
  skippedModules: string[];
  providerConcurrency: Record<string, number>;
  modelAdapter: ModelConfigAdapter;
}
