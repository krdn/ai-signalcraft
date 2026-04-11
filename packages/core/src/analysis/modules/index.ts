// Stage 1 분석 모듈
export { macroViewModule } from './macro-view';
export { segmentationModule } from './segmentation';
export { sentimentFramingModule } from './sentiment-framing';
export { messageImpactModule } from './message-impact';

// Stage 2 분석 모듈
export { riskMapModule } from './risk-map';
export { opportunityModule } from './opportunity';
export { strategyModule } from './strategy';
export { finalSummaryModule } from './final-summary';

// Stage 4 분석 모듈 — 정치 도메인 (ADVN)
export { approvalRatingModule } from './approval-rating';
export { frameWarModule } from './frame-war';
export { crisisScenarioModule } from './crisis-scenario';
export { winSimulationModule } from './win-simulation';

// Stage 4 분석 모듈 — 팬덤 도메인 (ADVN-F)
export {
  fanLoyaltyIndexModule,
  fandomNarrativeWarModule,
  fandomCrisisScenarioModule,
  releaseReceptionPredictionModule,
} from './fandom';

// Stage 4 분석 모듈 — PR 도메인
export { crisisTypeClassifierModule } from './pr/crisis-type-classifier';
export { reputationIndexModule } from './pr/reputation-index';

// Stage 4 분석 모듈 — 기업 평판 도메인
export { stakeholderMapModule } from './corporate/stakeholder-map';
export { esgSentimentModule } from './corporate/esg-sentiment';
export { mediaFramingDominanceModule } from './corporate/media-framing-dominance';
export { csrCommunicationGapModule } from './corporate/csr-communication-gap';
export { reputationRecoverySimulationModule } from './corporate/reputation-recovery-simulation';

// Stage 4 분석 모듈 — 헬스케어 도메인
export { healthRiskPerceptionModule } from './healthcare/health-risk-perception';
export { compliancePredictorModule } from './healthcare/compliance-predictor';

// Stage 4 분석 모듈 — 스포츠 도메인
export { performanceNarrativeModule } from './sports/performance-narrative';
export { seasonOutlookPredictionModule } from './sports/season-outlook-prediction';

// Stage 4 분석 모듈 — 금융 도메인
export { marketSentimentIndexModule } from './finance/market-sentiment-index';
export { informationAsymmetryModule } from './finance/information-asymmetry';
export { catalystScenarioModule } from './finance/catalyst-scenario';
export { investmentSignalModule } from './finance/investment-signal';
