// 파이프라인 헬퍼 함수들 — PipelineContext를 파라미터로 받는 순수/비순수 함수
import { eq } from 'drizzle-orm';
import { isPipelineCancelled, waitIfPaused, checkCostLimit } from '../pipeline/control';
import { appendJobEvent } from '../pipeline/persist';
import { getDb } from '../db';
import { logError } from '../utils/logger';
import { analysisResults as analysisResultsTable } from '../db/schema/analysis';
import { persistAnalysisResult } from './persist-analysis';
import type { AnalysisModuleResult } from './types';
import type { PipelineContext } from './pipeline-context';

/** DB에서 이미 완료된 분석 결과를 로드 (체크포인트 복원) */
export async function loadCompletedResults(
  jobId: number,
  retryModules?: string[],
): Promise<{
  allResults: Record<string, AnalysisModuleResult>;
  priorResults: Record<string, unknown>;
}> {
  const db = getDb();
  const rows = await db
    .select()
    .from(analysisResultsTable)
    .where(eq(analysisResultsTable.jobId, jobId));

  const allResults: Record<string, AnalysisModuleResult> = {};
  const priorResults: Record<string, unknown> = {};

  for (const row of rows) {
    if (retryModules?.includes(row.module)) continue;
    if (row.status !== 'completed') continue;

    allResults[row.module] = {
      module: row.module,
      status: 'completed',
      result: row.result as AnalysisModuleResult['result'],
      usage: row.usage as AnalysisModuleResult['usage'],
    };
    priorResults[row.module] = row.result;
  }

  return { allResults, priorResults };
}

/** 공통 체크: 취소/일시정지/비용한도. false 반환 시 파이프라인 중단 */
export async function preRunCheck(ctx: PipelineContext): Promise<boolean> {
  if (await isPipelineCancelled(ctx.jobId)) {
    ctx.cancelledByUser = true;
    return false;
  }
  const resumed = await waitIfPaused(ctx.jobId);
  if (!resumed) {
    ctx.cancelledByUser = true;
    return false;
  }
  const costCheck = await checkCostLimit(ctx.jobId);
  if (costCheck.exceeded) {
    ctx.costLimitExceeded = true;
    console.warn(`[cost-limit] 비용 한도 초과: $${costCheck.currentCost} / $${costCheck.limit}`);
    return false;
  }
  return true;
}

/** 모듈이 건너뛰기(skip) 목록에 포함되어 있는지 확인 */
export function isSkipped(ctx: PipelineContext, moduleName: string): boolean {
  return ctx.skippedModules.includes(moduleName);
}

/** 모듈이 이미 완료(completed) 상태인지 확인 */
export function isAlreadyCompleted(ctx: PipelineContext, moduleName: string): boolean {
  return ctx.allResults[moduleName]?.status === 'completed';
}

/**
 * 실패 감지 — 전체 실패 시에만 중단, 부분 실패는 경고 후 계속
 * 주의: allResults 전체를 스캔하므로 현재까지 누적된 모든 결과를 기준으로 판단
 */
export function checkFailAndAbort(ctx: PipelineContext, stageName: string): boolean {
  const stageModules = Object.values(ctx.allResults);
  const failed = stageModules.filter((r) => r.status === 'failed');
  if (failed.length === 0) return false;

  const completed = stageModules.filter((r) => r.status === 'completed');
  const failedNames = failed.map((f) => f.module).join(', ');

  // 성공한 모듈이 1개라도 있으면 계속 진행 (부분 실패 허용)
  if (completed.length > 0) {
    console.warn(
      `[pipeline] ${stageName} 부분 실패 — 실패: ${failedNames}, 성공 ${completed.length}개로 계속 진행`,
    );
    appendJobEvent(
      ctx.jobId,
      'warn',
      `${stageName}에서 부분 실패 (${failedNames}), 성공한 결과로 계속 진행`,
    ).catch((err) => logError('pipeline-helpers', err));
    return false;
  }

  // 전부 실패 시에만 중단
  console.error(`[pipeline] ${stageName} 전체 실패 — 파이프라인 중단: ${failedNames}`);
  for (const f of failed) {
    console.error(`[pipeline] 실패 상세 — ${f.module}: ${f.errorMessage ?? '원인 불명'}`);
  }
  appendJobEvent(
    ctx.jobId,
    'error',
    `${stageName}에서 전체 실패 (${failedNames}), 파이프라인 중단`,
  ).catch((err) => logError('pipeline-helpers', err));
  return true;
}

/** 모듈을 skipped 상태로 DB에 저장하고 allResults에 반영 */
export async function markSkipped(ctx: PipelineContext, moduleName: string): Promise<void> {
  await persistAnalysisResult({
    jobId: ctx.jobId,
    module: moduleName,
    status: 'skipped',
  });
  ctx.allResults[moduleName] = {
    module: moduleName,
    status: 'skipped',
  };
}

/** 병렬 실행 결과를 ctx.allResults와 ctx.priorResults에 반영 */
export function collectResults(
  ctx: PipelineContext,
  settled: PromiseSettledResult<AnalysisModuleResult>[],
): void {
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      ctx.allResults[s.value.module] = s.value;
      if (s.value.status === 'completed') {
        ctx.priorResults[s.value.module] = s.value.result;
      }
    }
  }
}
