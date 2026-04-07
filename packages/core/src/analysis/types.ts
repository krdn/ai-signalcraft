// 분석 타입 — @ai-signalcraft/insight-engine으로 단일화 (D-01)
// ais 전용 타입은 별도 정의 가능하지만, 현재는 engine 타입을 그대로 재노출
export type {
  AIProvider,
  ProviderType,
  AnalysisModule,
  AnalysisInput,
  AnalysisModuleResult,
  ModuleConfig,
} from '@ai-signalcraft/insight-engine';
export { MODULE_MODEL_MAP, MODULE_NAMES } from '@ai-signalcraft/insight-engine';
