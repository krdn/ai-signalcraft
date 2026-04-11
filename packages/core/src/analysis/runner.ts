// ai-signalcraft 분석 러너 — 12개 모듈의 Stage 상수를 로컬 정의하고,
// 단일 모듈 실행 엔진만 @krdn/ai-analysis-kit의 runModule을 사용한다.
//
// 분리 정책:
//   - 범용 엔진 (runModule, 어댑터, 재시도, 프로바이더 레지스트리) → kit
//   - 도메인 자산 (12개 모듈, 스키마, Stage 배열, MODULE_MODEL_MAP) → 본 프로젝트
import {
  runModule as kitRunModule,
  type ModelConfigAdapter,
  type PipelineControlAdapter,
  type RunModuleOptions,
  type AnalysisModule as KitAnalysisModule,
} from '@krdn/ai-analysis-kit';
import { isPipelineCancelled, waitIfPaused } from '../pipeline/control';
import { appendJobEvent } from '../pipeline/persist';
import { getModuleModelConfig, getModuleModelConfigForPreset } from './model-config';
import { persistAnalysisResult } from './persist-analysis';
import type { AnalysisModule, AnalysisInput, AnalysisModuleResult } from './types';
import type { AnalysisDomain } from './domain';
import { getDomainConfig } from './domain';
import {
  macroViewModule,
  segmentationModule,
  sentimentFramingModule,
  messageImpactModule,
  riskMapModule,
  opportunityModule,
  strategyModule,
  approvalRatingModule,
  frameWarModule,
  crisisScenarioModule,
  winSimulationModule,
  fanLoyaltyIndexModule,
  fandomNarrativeWarModule,
  fandomCrisisScenarioModule,
  releaseReceptionPredictionModule,
  // PR 도메인 신규 모듈
  crisisTypeClassifierModule,
  reputationIndexModule,
  // 기업 평판 도메인 신규 모듈
  stakeholderMapModule,
  esgSentimentModule,
  // 헬스케어 도메인 신규 모듈
  healthRiskPerceptionModule,
  compliancePredictorModule,
  // 스포츠 도메인 신규 모듈
  performanceNarrativeModule,
  seasonOutlookPredictionModule,
  // 금융 도메인 신규 모듈
  marketSentimentIndexModule,
  informationAsymmetryModule,
  catalystScenarioModule,
  investmentSignalModule,
} from './modules';

/** 모듈명 → 모듈 인스턴스 매핑 (Stage 4 라우팅용) */
const MODULE_MAP: Record<string, AnalysisModule> = {
  // 정치/정책/지자체/교육 도메인 (공유)
  'approval-rating': approvalRatingModule,
  'frame-war': frameWarModule,
  'crisis-scenario': crisisScenarioModule,
  'win-simulation': winSimulationModule,
  // 팬덤/스포츠 도메인 (공유)
  'fan-loyalty-index': fanLoyaltyIndexModule,
  'fandom-narrative-war': fandomNarrativeWarModule,
  'fandom-crisis-scenario': fandomCrisisScenarioModule,
  'release-reception-prediction': releaseReceptionPredictionModule,
  // PR 도메인 신규 모듈
  'crisis-type-classifier': crisisTypeClassifierModule,
  'reputation-index': reputationIndexModule,
  // 기업 평판/유통 도메인 신규 모듈
  'stakeholder-map': stakeholderMapModule,
  'esg-sentiment': esgSentimentModule,
  // 헬스케어 도메인 신규 모듈
  'health-risk-perception': healthRiskPerceptionModule,
  'compliance-predictor': compliancePredictorModule,
  // 스포츠 도메인 신규 모듈
  'performance-narrative': performanceNarrativeModule,
  'season-outlook-prediction': seasonOutlookPredictionModule,
  // 금융 도메인 신규 모듈
  'market-sentiment-index': marketSentimentIndexModule,
  'information-asymmetry': informationAsymmetryModule,
  'catalyst-scenario': catalystScenarioModule,
  'investment-signal': investmentSignalModule,
  // 공유 모듈 (기업/PR/법률/유통에서 재사용)
  opportunity: opportunityModule,
};

// ---------- Stage 상수 (로컬) ----------
// Stage 1: 병렬 실행 (독립 모듈)
export const STAGE1_MODULES: AnalysisModule[] = [
  macroViewModule,
  segmentationModule,
  sentimentFramingModule,
  messageImpactModule,
];

// Stage 2: 순차/병렬 가능 (Stage 1 결과 의존)
export const STAGE2_MODULES: AnalysisModule[] = [riskMapModule, opportunityModule, strategyModule];

// Stage 4: 고급 분석 (ADVN 모듈)
// 기본값(정치 도메인) — 하위 호환성 유지
export const STAGE4_PARALLEL: AnalysisModule[] = [approvalRatingModule, frameWarModule];
export const STAGE4_SEQUENTIAL: AnalysisModule[] = [crisisScenarioModule, winSimulationModule];

/** 도메인에 따른 Stage 4 모듈 조회 */
export function getStage4Modules(domain?: AnalysisDomain): {
  parallel: AnalysisModule[];
  sequential: AnalysisModule[];
} {
  const d = domain ?? 'political';
  const config = getDomainConfig(d);
  return {
    parallel: config.stage4.parallel.map((name) => MODULE_MAP[name]).filter(Boolean),
    sequential: config.stage4.sequential.map((name) => MODULE_MAP[name]).filter(Boolean),
  };
}

// ---------- kit runModule에 주입할 어댑터 ----------
/** DB 기반 ModelConfigAdapter */
const dbModelConfigAdapter: ModelConfigAdapter = {
  async resolve(moduleName: string) {
    const cfg = await getModuleModelConfig(moduleName);
    return {
      provider: cfg.provider,
      model: cfg.model,
      ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
      ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
    };
  },
};

/** 프리셋 인식 ModelConfigAdapter 팩토리 */
export function createModelConfigAdapter(presetSlug?: string): ModelConfigAdapter {
  return {
    async resolve(moduleName: string) {
      const cfg = await getModuleModelConfigForPreset(moduleName, presetSlug);
      return {
        provider: cfg.provider,
        model: cfg.model,
        ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
        ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}),
      };
    },
  };
}

/** DB 기반 PipelineControlAdapter */
const dbPipelineControl: PipelineControlAdapter = {
  async isCancelled(jobId) {
    return isPipelineCancelled(jobId);
  },
  async waitIfPaused(jobId) {
    await waitIfPaused(jobId);
  },
  async checkCostLimit() {
    return true;
  },
  async appendEvent(jobId, level, message) {
    await appendJobEvent(jobId, level, message).catch(() => undefined);
  },
};

/** persist 콜백 — kit이 status 전환마다 호출 */
const persistCallback: NonNullable<RunModuleOptions['onPersist']> = async (event) => {
  const base = { jobId: event.jobId, module: event.module };
  if (event.status === 'running') {
    await persistAnalysisResult({ ...base, status: 'running' });
  } else if (event.status === 'skipped') {
    await persistAnalysisResult({
      ...base,
      status: 'skipped',
      errorMessage: event.errorMessage,
    });
  } else if (event.status === 'completed') {
    await persistAnalysisResult({
      ...base,
      status: 'completed',
      result: event.result as never,
      usage: event.usage,
    });
  } else if (event.status === 'failed') {
    await persistAnalysisResult({
      ...base,
      status: 'failed',
      errorMessage: event.errorMessage,
    });
  }
};

/**
 * 단일 분석 모듈 실행 (DB persist + 파이프라인 제어 포함)
 * 부분 실패 허용 — 실패 시에도 에러를 throw하지 않고 failed 상태 반환.
 *
 * 내부는 @krdn/ai-analysis-kit의 runModule을 호출한다. 로컬 AnalysisModule/AnalysisInput
 * 타입은 kit 타입과 구조적으로 동일(field/method 시그니처 일치)하므로 호환된다.
 */
/** ai-signalcraft 도메인의 AnalysisInput에서 jobId/itemCount 추출 */
const extractMeta = (input: AnalysisInput) => ({
  jobId: input.jobId,
  itemCount: input.articles.length + input.videos.length + input.comments.length,
});

export async function runModule<T>(
  module: AnalysisModule<T>,
  input: AnalysisInput,
  priorResults?: Record<string, unknown>,
  configAdapter?: ModelConfigAdapter,
): Promise<AnalysisModuleResult<T>> {
  const result = await kitRunModule<AnalysisInput, T>(
    module as unknown as KitAnalysisModule<AnalysisInput, T>,
    input,
    {
      configAdapter: configAdapter ?? dbModelConfigAdapter,
      pipelineControl: dbPipelineControl,
      onPersist: persistCallback,
      extractMeta,
    },
    priorResults,
  );
  return result as unknown as AnalysisModuleResult<T>;
}

// 오케스트레이션 함수 re-export — 기존 import 경로 호환성 유지
export { runAnalysisPipeline } from './pipeline-orchestrator';
