// @ai-insight/engine - 순수 AI 분석 엔진

// 타입
export type {
  AnalysisModule,
  AnalysisInput,
  AnalysisModuleResult,
  ModuleConfig,
  AIProvider,
  ProviderType,
} from './types';
export { MODULE_MODEL_MAP, MODULE_NAMES } from './types';

// 모듈 14개 (실제로는 12개 + 2개 ADVN 중 조합)
export {
  macroViewModule,
  segmentationModule,
  sentimentFramingModule,
  messageImpactModule,
  riskMapModule,
  opportunityModule,
  strategyModule,
  finalSummaryModule,
  approvalRatingModule,
  frameWarModule,
  crisisScenarioModule,
  winSimulationModule,
} from './modules/index';

// 스키마
export * from './schemas/index';

// 실행
export { runModule, type RunModuleParams } from './runner';
export {
  runModuleMapReduce,
  chunkAnalysisInput,
  type RunModuleMapReduceParams,
} from './map-reduce';
export {
  runPipeline,
  makeDefaultConfigResolver,
  STAGE1_MODULES,
  STAGE2_PARALLEL,
  STAGE2_SEQUENTIAL,
  STAGE3_MODULES,
  STAGE4_PARALLEL,
  STAGE4_SEQUENTIAL,
  type PipelineOptions,
  type PipelineResult,
} from './orchestrator';

// 전처리
export {
  preprocessAnalysisInput,
  OPTIMIZATION_PRESETS,
  type OptimizationPreset,
  type PresetConfig,
  type PreprocessingResult,
} from './preprocessing/index';

// 게이트웨이 재노출 (편의)
export {
  analyzeText,
  analyzeStructured,
  normalizeUsage,
  PROVIDER_REGISTRY,
  AI_PROVIDER_VALUES,
  type AIGatewayOptions,
  type NormalizedUsage,
  type ProviderMeta,
  type AccessMethod,
} from '@ai-signalcraft/insight-gateway';
