import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModuleModelConfigForPreset } from '../model-config';
import { createModelConfigAdapter } from '../runner';

// --- runner.ts import-time side-effect mocks ---
// runner.ts(=테스트 대상)가 다음 모듈을 import만 해도 DB pool / Redis / kit provider registry가 초기화되어
// 단위 테스트 환경에서 실패한다. 아래 vi.mock은 모두 import 시점 부수효과를 차단하기 위한 것이며,
// createModelConfigAdapter 자체는 mocking하지 않는다 (테스트 대상이므로).
// runner.ts의 import 경로가 변경되면 이 목록도 따라가야 한다.

// model-config 모듈 모킹: getModuleModelConfig가 maxOutputTokens를 포함해 반환한다고 가정
vi.mock('../model-config', () => ({
  getModuleModelConfig: vi.fn(),
  getModuleModelConfigForPreset: vi.fn(),
  getAllModelSettingsForPreset: vi.fn(),
}));

// runner.ts가 import하는 외부/내부 의존성들이 side-effect 없이 로드되도록 모킹
// @krdn/ai-analysis-kit: DB/프로바이더 초기화 없이 타입/함수만 노출
vi.mock('@krdn/ai-analysis-kit', () => ({
  runModule: vi.fn(),
}));

// DB를 직접 사용하는 내부 모듈들
vi.mock('../../pipeline/control', () => ({
  isPipelineCancelled: vi.fn().mockResolvedValue(false),
  waitIfPaused: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../pipeline/persist', () => ({
  appendJobEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../persist-analysis', () => ({
  persistAnalysisResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../module-cache', () => ({
  hashAnalysisInput: vi.fn().mockReturnValue('hash'),
  getCachedModuleResult: vi.fn().mockResolvedValue(null),
  setCachedModuleResult: vi.fn().mockResolvedValue(undefined),
}));

// 모든 분석 모듈을 더미로 대체 (import side-effect 방지)
vi.mock('../modules', () => ({
  macroViewModule: { name: 'macro-view' },
  segmentationModule: { name: 'segmentation' },
  sentimentFramingModule: { name: 'sentiment-framing' },
  messageImpactModule: { name: 'message-impact' },
  riskMapModule: { name: 'risk-map' },
  opportunityModule: { name: 'opportunity' },
  strategyModule: { name: 'strategy' },
  approvalRatingModule: { name: 'approval-rating' },
  frameWarModule: { name: 'frame-war' },
  crisisScenarioModule: { name: 'crisis-scenario' },
  winSimulationModule: { name: 'win-simulation' },
  fanLoyaltyIndexModule: { name: 'fan-loyalty-index' },
  fandomNarrativeWarModule: { name: 'fandom-narrative-war' },
  fandomCrisisScenarioModule: { name: 'fandom-crisis-scenario' },
  releaseReceptionPredictionModule: { name: 'release-reception-prediction' },
  crisisTypeClassifierModule: { name: 'crisis-type-classifier' },
  reputationIndexModule: { name: 'reputation-index' },
  stakeholderMapModule: { name: 'stakeholder-map' },
  esgSentimentModule: { name: 'esg-sentiment' },
  mediaFramingDominanceModule: { name: 'media-framing-dominance' },
  csrCommunicationGapModule: { name: 'csr-communication-gap' },
  reputationRecoverySimulationModule: { name: 'reputation-recovery-simulation' },
  healthRiskPerceptionModule: { name: 'health-risk-perception' },
  compliancePredictorModule: { name: 'compliance-predictor' },
  performanceNarrativeModule: { name: 'performance-narrative' },
  seasonOutlookPredictionModule: { name: 'season-outlook-prediction' },
  marketSentimentIndexModule: { name: 'market-sentiment-index' },
  informationAsymmetryModule: { name: 'information-asymmetry' },
  catalystScenarioModule: { name: 'catalyst-scenario' },
  investmentSignalModule: { name: 'investment-signal' },
  institutionalReputationIndexModule: { name: 'institutional-reputation-index' },
  educationOpinionFrameModule: { name: 'education-opinion-frame' },
  educationCrisisScenarioModule: { name: 'education-crisis-scenario' },
  educationOutcomeSimulationModule: { name: 'education-outcome-simulation' },
}));

vi.mock('../domain', () => ({
  getDomainConfig: vi.fn().mockReturnValue({
    stage4: { parallel: [], sequential: [] },
  }),
}));

vi.mock('./pipeline-orchestrator', () => ({
  runAnalysisPipeline: vi.fn(),
}));

describe('ModelConfigAdapter maxOutputTokens propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preset 어댑터는 DB에 저장된 maxOutputTokens를 ResolvedModelConfig로 전달한다', async () => {
    vi.mocked(getModuleModelConfigForPreset).mockResolvedValueOnce({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      maxOutputTokens: 24000,
    });

    const adapter = createModelConfigAdapter('political');
    const resolved = await adapter.resolve('macro-view');

    expect(resolved.maxOutputTokens).toBe(24000);
    expect(resolved.provider).toBe('gemini');
    expect(resolved.model).toBe('gemini-2.5-flash');
  });

  it('maxOutputTokens가 null이면 ResolvedModelConfig에 키를 넣지 않는다 (kit 기본값 사용)', async () => {
    vi.mocked(getModuleModelConfigForPreset).mockResolvedValueOnce({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      // maxOutputTokens 미설정
    });

    const adapter = createModelConfigAdapter();
    const resolved = await adapter.resolve('macro-view');

    expect('maxOutputTokens' in resolved).toBe(false);
  });

  it('maxOutputTokens=0이면 ResolvedModelConfig에 키가 존재하고 0으로 전달된다 (!= null 보장)', async () => {
    vi.mocked(getModuleModelConfigForPreset).mockResolvedValueOnce({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      maxOutputTokens: 0,
    });

    const adapter = createModelConfigAdapter('political');
    const resolved = await adapter.resolve('macro-view');

    expect('maxOutputTokens' in resolved).toBe(true);
    expect(resolved.maxOutputTokens).toBe(0);
  });
});
