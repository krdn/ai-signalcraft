// ai-signalcraft 분석 타입 — 모든 분석 모듈/입출력 타입은
// @krdn/ai-analysis-kit에서 단일 정의되며 여기서 re-export한다.
export type {
  AIProvider,
  ProviderType,
  AnalysisModule,
  AnalysisInput,
  AnalysisModuleResult,
} from '@krdn/ai-analysis-kit';
export { MODULE_MODEL_MAP, MODULE_NAMES } from '@krdn/ai-analysis-kit';
