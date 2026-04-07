/**
 * Stage 1~4 분석 파이프라인 오케스트레이터 (DB 의존 없음)
 * 모든 상태/비용/취소 제어는 콜백과 AbortSignal로 위임
 */
import type { NormalizedUsage } from '@ai-signalcraft/insight-gateway';
import type { AnalysisModule, AnalysisInput, AnalysisModuleResult, ModuleConfig } from './types';
import { MODULE_MODEL_MAP } from './types';
import { runModule } from './runner';
import { runModuleMapReduce } from './map-reduce';
import {
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

/** Stage 구성 — 필요 시 외부에서 교체 가능 */
export const STAGE1_MODULES: AnalysisModule[] = [
  macroViewModule,
  segmentationModule,
  sentimentFramingModule,
  messageImpactModule,
];

export const STAGE2_PARALLEL: AnalysisModule[] = [riskMapModule, opportunityModule];
export const STAGE2_SEQUENTIAL: AnalysisModule[] = [strategyModule];
export const STAGE3_MODULES: AnalysisModule[] = [finalSummaryModule];
export const STAGE4_PARALLEL: AnalysisModule[] = [approvalRatingModule, frameWarModule];
export const STAGE4_SEQUENTIAL: AnalysisModule[] = [crisisScenarioModule, winSimulationModule];

type StageUsage = NormalizedUsage & { provider: string; model: string };

export interface PipelineOptions {
  input: AnalysisInput;
  /** 모듈별 설정 해석기 — 기본값: MODULE_MODEL_MAP 기반 + apiKey/baseUrl 주입 */
  configResolver?: (moduleName: string) => ModuleConfig;
  /** Stage 4 (ADVN 고급 분석) 실행 여부 */
  enableStage4?: boolean;
  /** Stage별 특정 모듈 스킵 */
  skipModules?: string[];
  /** Map-Reduce 강제 사용 여부 (Stage 1에만 적용) */
  useMapReduceOnStage1?: boolean;
  signal?: AbortSignal;
  onModuleStart?: (moduleName: string, stage: string) => void;
  onModuleComplete?: (result: AnalysisModuleResult) => void;
  onModuleError?: (moduleName: string, error: string) => void;
  onStageComplete?: (stage: string, results: AnalysisModuleResult[]) => void;
  onUsage?: (usage: StageUsage) => void;
  onEvent?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

export interface PipelineResult {
  results: Record<string, AnalysisModuleResult>;
  completedModules: string[];
  failedModules: string[];
  skippedModules: string[];
  totalUsage: NormalizedUsage;
  cancelled: boolean;
}

function defaultConfigResolver(
  apiKeys: Record<string, string | undefined> = {},
): (moduleName: string) => ModuleConfig {
  return (moduleName: string): ModuleConfig => {
    const fallback = MODULE_MODEL_MAP[moduleName];
    if (!fallback) {
      throw new Error(`Unknown module: ${moduleName}`);
    }
    return {
      provider: fallback.provider,
      model: fallback.model,
      apiKey: apiKeys[fallback.provider],
    };
  };
}

export function makeDefaultConfigResolver(apiKeys: Record<string, string | undefined>) {
  return defaultConfigResolver(apiKeys);
}

/** 순차 실행 헬퍼 (Stage 내부에서 모듈 순차 실행) */
async function runSequential(
  modules: AnalysisModule[],
  opts: PipelineOptions,
  stage: string,
  priorResults: Record<string, unknown>,
  allResults: Record<string, AnalysisModuleResult>,
  totalUsage: NormalizedUsage,
): Promise<void> {
  const resolver = opts.configResolver ?? defaultConfigResolver();
  for (const module of modules) {
    if (opts.signal?.aborted) return;
    if (opts.skipModules?.includes(module.name)) continue;

    opts.onModuleStart?.(module.name, stage);
    const result = await runModule({
      module,
      input: opts.input,
      config: resolver(module.name),
      priorResults,
      signal: opts.signal,
      onUsage: (u) => {
        totalUsage.inputTokens += u.inputTokens;
        totalUsage.outputTokens += u.outputTokens;
        totalUsage.totalTokens += u.totalTokens;
        opts.onUsage?.(u);
      },
      onEvent: opts.onEvent,
    });

    allResults[result.module] = result;
    if (result.status === 'completed') {
      priorResults[result.module] = result.result;
      opts.onModuleComplete?.(result);
    } else if (result.status === 'failed') {
      opts.onModuleError?.(result.module, result.errorMessage ?? 'unknown');
    }
  }
}

/** 병렬 실행 헬퍼 (Stage 내부에서 모듈 병렬 실행) */
async function runParallel(
  modules: AnalysisModule[],
  opts: PipelineOptions,
  stage: string,
  priorResults: Record<string, unknown>,
  allResults: Record<string, AnalysisModuleResult>,
  totalUsage: NormalizedUsage,
  useMapReduce = false,
): Promise<void> {
  const resolver = opts.configResolver ?? defaultConfigResolver();
  const active = modules.filter((m) => !opts.skipModules?.includes(m.name));

  const settled = await Promise.allSettled(
    active.map((module) => {
      opts.onModuleStart?.(module.name, stage);
      const params = {
        module,
        input: opts.input,
        config: resolver(module.name),
        priorResults,
        signal: opts.signal,
        onUsage: (u: StageUsage) => {
          totalUsage.inputTokens += u.inputTokens;
          totalUsage.outputTokens += u.outputTokens;
          totalUsage.totalTokens += u.totalTokens;
          opts.onUsage?.(u);
        },
        onEvent: opts.onEvent,
      };
      return useMapReduce ? runModuleMapReduce(params) : runModule(params);
    }),
  );

  for (const s of settled) {
    if (s.status === 'fulfilled') {
      const result = s.value;
      allResults[result.module] = result;
      if (result.status === 'completed') {
        priorResults[result.module] = result.result;
        opts.onModuleComplete?.(result);
      } else if (result.status === 'failed') {
        opts.onModuleError?.(result.module, result.errorMessage ?? 'unknown');
      }
    }
  }
}

/** 전체 Stage 실패 감지 — 성공 0개일 때만 중단 */
function allStageModulesFailed(
  stageModules: AnalysisModule[],
  allResults: Record<string, AnalysisModuleResult>,
): boolean {
  const relevant = stageModules
    .map((m) => allResults[m.name])
    .filter((r): r is AnalysisModuleResult => r !== undefined);
  if (relevant.length === 0) return false;
  return relevant.every((r) => r.status === 'failed');
}

/**
 * 전체 파이프라인 실행
 * Stage 1 → Stage 2 → Stage 3 → (옵션) Stage 4
 * 각 Stage 전체 실패 시 조기 중단
 */
export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const allResults: Record<string, AnalysisModuleResult> = {};
  const priorResults: Record<string, unknown> = {};
  const totalUsage: NormalizedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  const isCancelled = () => opts.signal?.aborted === true;

  // === Stage 1 (병렬, 독립) ===
  if (isCancelled()) return buildResult(allResults, totalUsage, true);

  opts.onEvent?.(
    'info',
    'Stage 1 시작 (macro-view, segmentation, sentiment-framing, message-impact)',
  );
  await runParallel(
    STAGE1_MODULES,
    opts,
    'stage1',
    priorResults,
    allResults,
    totalUsage,
    opts.useMapReduceOnStage1 ?? false,
  );
  opts.onStageComplete?.('stage1', STAGE1_MODULES.map((m) => allResults[m.name]).filter(Boolean));

  if (allStageModulesFailed(STAGE1_MODULES, allResults)) {
    opts.onEvent?.('error', 'Stage 1 전체 실패 — 파이프라인 중단');
    return buildResult(allResults, totalUsage, isCancelled());
  }

  // === Stage 2 (risk-map/opportunity 병렬 → strategy 순차) ===
  if (isCancelled()) return buildResult(allResults, totalUsage, true);

  opts.onEvent?.('info', 'Stage 2 시작 (risk-map, opportunity, strategy)');
  await runParallel(STAGE2_PARALLEL, opts, 'stage2a', priorResults, allResults, totalUsage);
  await runSequential(STAGE2_SEQUENTIAL, opts, 'stage2b', priorResults, allResults, totalUsage);
  opts.onStageComplete?.(
    'stage2',
    [...STAGE2_PARALLEL, ...STAGE2_SEQUENTIAL].map((m) => allResults[m.name]).filter(Boolean),
  );

  if (allStageModulesFailed([...STAGE2_PARALLEL, ...STAGE2_SEQUENTIAL], allResults)) {
    opts.onEvent?.('error', 'Stage 2 전체 실패 — 파이프라인 중단');
    return buildResult(allResults, totalUsage, isCancelled());
  }

  // === Stage 3 (final-summary) ===
  if (isCancelled()) return buildResult(allResults, totalUsage, true);

  opts.onEvent?.('info', 'Stage 3 시작 (final-summary)');
  await runSequential(STAGE3_MODULES, opts, 'stage3', priorResults, allResults, totalUsage);
  opts.onStageComplete?.('stage3', STAGE3_MODULES.map((m) => allResults[m.name]).filter(Boolean));

  // === Stage 4 (옵션, ADVN 고급 분석) ===
  if (opts.enableStage4 && !isCancelled()) {
    opts.onEvent?.(
      'info',
      'Stage 4 시작 (approval-rating, frame-war, crisis-scenario, win-simulation)',
    );
    await runParallel(STAGE4_PARALLEL, opts, 'stage4a', priorResults, allResults, totalUsage);
    await runSequential(STAGE4_SEQUENTIAL, opts, 'stage4b', priorResults, allResults, totalUsage);
    opts.onStageComplete?.(
      'stage4',
      [...STAGE4_PARALLEL, ...STAGE4_SEQUENTIAL].map((m) => allResults[m.name]).filter(Boolean),
    );
  }

  return buildResult(allResults, totalUsage, isCancelled());
}

function buildResult(
  allResults: Record<string, AnalysisModuleResult>,
  totalUsage: NormalizedUsage,
  cancelled: boolean,
): PipelineResult {
  const completedModules: string[] = [];
  const failedModules: string[] = [];
  const skippedModules: string[] = [];

  for (const r of Object.values(allResults)) {
    if (r.status === 'completed') completedModules.push(r.module);
    else if (r.status === 'failed') failedModules.push(r.module);
    else if (r.status === 'skipped') skippedModules.push(r.module);
  }

  return {
    results: allResults,
    completedModules,
    failedModules,
    skippedModules,
    totalUsage,
    cancelled,
  };
}
