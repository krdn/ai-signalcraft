// Stage 1 스키마
export * from './macro-view.schema';
export * from './segmentation.schema';
export * from './sentiment-framing.schema';
export * from './message-impact.schema';

// Stage 2 스키마
export { RiskMapSchema, type RiskMapResult } from './risk-map.schema';
export { OpportunitySchema, type OpportunityResult } from './opportunity.schema';
export { StrategySchema, type StrategyResult } from './strategy.schema';
export { FinalSummarySchema, type FinalSummaryResult } from './final-summary.schema';

// Stage 4 스키마 (ADVN 고급 분석)
export { ApprovalRatingSchema, type ApprovalRatingResult } from './approval-rating.schema';
export { FrameWarSchema, type FrameWarResult } from './frame-war.schema';
export { CrisisScenarioSchema, type CrisisScenarioResult } from './crisis-scenario.schema';
export { WinSimulationSchema, type WinSimulationResult } from './win-simulation.schema';

// Stage 4 스키마 — PR 도메인
export {
  CrisisTypeClassifierSchema,
  type CrisisTypeClassifierResult,
} from './crisis-type-classifier.schema';
export { ReputationIndexSchema, type ReputationIndexResult } from './reputation-index.schema';

// Stage 4 스키마 — 기업 평판 도메인
export { StakeholderMapSchema, type StakeholderMapResult } from './stakeholder-map.schema';
export { EsgSentimentSchema, type EsgSentimentResult } from './esg-sentiment.schema';

// Stage 4 스키마 — 헬스케어 도메인
export {
  HealthRiskPerceptionSchema,
  type HealthRiskPerceptionResult,
} from './health-risk-perception.schema';
export {
  CompliancePredictorSchema,
  type CompliancePredictorResult,
} from './compliance-predictor.schema';

// Stage 4 스키마 — 스포츠 도메인
export {
  PerformanceNarrativeSchema,
  type PerformanceNarrativeResult,
} from './performance-narrative.schema';
export {
  SeasonOutlookPredictionSchema,
  type SeasonOutlookPredictionResult,
} from './season-outlook-prediction.schema';

// Stage 4 스키마 — 금융 도메인
export {
  MarketSentimentIndexSchema,
  type MarketSentimentIndexResult,
} from './market-sentiment-index.schema';
export {
  InformationAsymmetrySchema,
  type InformationAsymmetryResult,
} from './information-asymmetry.schema';
export { CatalystScenarioSchema, type CatalystScenarioResult } from './catalyst-scenario.schema';
export { InvestmentSignalSchema, type InvestmentSignalResult } from './investment-signal.schema';
