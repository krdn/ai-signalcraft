// ai-signalcraft 분석 러너 — @krdn/ai-analysis-kit의 runModule을 호출하면서
// DB 기반 model-config / pipeline 제어 / persist 어댑터를 주입하는 thin wrapper.
import {
  runModule as kitRunModule,
  STAGE1_MODULES as KIT_STAGE1,
  STAGE2_MODULES as KIT_STAGE2,
  STAGE4_PARALLEL as KIT_STAGE4_PARALLEL,
  STAGE4_SEQUENTIAL as KIT_STAGE4_SEQUENTIAL,
  type ModelConfigAdapter,
  type PipelineControlAdapter,
  type RunModuleOptions,
  type AnalysisModule,
  type AnalysisInput,
  type AnalysisModuleResult,
} from '@krdn/ai-analysis-kit';
import { isPipelineCancelled, waitIfPaused } from '../pipeline/control';
import { appendJobEvent } from '../pipeline/persist';
import { getModuleModelConfig } from './model-config';
import { persistAnalysisResult } from './persist-analysis';

// Stage 상수 — kit에서 가져와 그대로 re-export (기존 import 경로 호환)
export const STAGE1_MODULES: AnalysisModule[] = KIT_STAGE1;
export const STAGE2_MODULES: AnalysisModule[] = KIT_STAGE2;
export const STAGE4_PARALLEL: AnalysisModule[] = KIT_STAGE4_PARALLEL;
export const STAGE4_SEQUENTIAL: AnalysisModule[] = KIT_STAGE4_SEQUENTIAL;

/** DB 기반 ModelConfigAdapter — 기존 getModuleModelConfig를 그대로 위임 */
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

/** DB 기반 PipelineControlAdapter — 기존 cancellation/pause/event 함수에 위임 */
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

/** persist 콜백 — kit이 status 전환마다 호출, 기존 persistAnalysisResult로 위임 */
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
 * 내부 구현은 @krdn/ai-analysis-kit의 runModule을 호출하며,
 * ai-signalcraft 고유의 DB 저장/취소/일시정지 로직은 어댑터로 주입한다.
 */
export async function runModule<T>(
  module: AnalysisModule<T>,
  input: AnalysisInput,
  priorResults?: Record<string, unknown>,
): Promise<AnalysisModuleResult<T>> {
  return kitRunModule<T>(
    module,
    input,
    {
      configAdapter: dbModelConfigAdapter,
      pipelineControl: dbPipelineControl,
      onPersist: persistCallback,
    },
    priorResults,
  );
}

// 오케스트레이션 함수 re-export — 기존 import 경로 호환성 유지
export { runAnalysisPipeline } from './pipeline-orchestrator';
