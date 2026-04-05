// 파이프라인 런타임 체크 — runner에서 매 모듈 실행 전후 호출
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults } from '../db/schema/analysis';
// cancelPipeline은 control.ts에서 정의 — 순환 참조 방지를 위해 동적 import

/** 파이프라인이 취소되었는지 확인 */
export async function isPipelineCancelled(jobId: number): Promise<boolean> {
  const db = getDb();
  const [job] = await db
    .select({ status: collectionJobs.status })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  return !job || job.status === 'cancelled';
}

/** 파이프라인 일시정지 확인 + 재개 대기 (최대 30분) */
export async function waitIfPaused(jobId: number): Promise<boolean> {
  const db = getDb();
  const maxWaitMs = 30 * 60 * 1000;
  const pollIntervalMs = 3000;
  let waited = 0;

  while (waited < maxWaitMs) {
    const [job] = await db
      .select({ status: collectionJobs.status })
      .from(collectionJobs)
      .where(eq(collectionJobs.id, jobId))
      .limit(1);

    if (!job || job.status === 'cancelled') return false;
    if (job.status !== 'paused') return true;

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    waited += pollIntervalMs;
  }

  const { cancelPipeline } = await import('./control');
  await cancelPipeline(jobId);
  return false;
}

/** 현재 누적 비용 확인 + 한도 초과 체크 */
export async function checkCostLimit(
  jobId: number,
): Promise<{ exceeded: boolean; currentCost: number; limit: number | null }> {
  const db = getDb();

  const [job] = await db
    .select({ costLimitUsd: collectionJobs.costLimitUsd })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  if (!job || job.costLimitUsd == null) return { exceeded: false, currentCost: 0, limit: null };

  const results = await db
    .select({ usage: analysisResults.usage })
    .from(analysisResults)
    .where(eq(analysisResults.jobId, jobId));

  const TOKEN_COST_PER_1K: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 0.005, output: 0.025 },
    'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5-20251001': { input: 0.001, output: 0.005 },
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
    'gpt-4.1-nano': { input: 0.00005, output: 0.0002 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gemini-2.5-pro': { input: 0.00125, output: 0.01 },
    'gemini-2.5-flash': { input: 0.0003, output: 0.0025 },
    'gemini-2.5-flash-lite': { input: 0.0001, output: 0.0004 },
    'deepseek-chat': { input: 0.00028, output: 0.00042 },
    'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
  };

  let totalCost = 0;
  for (const row of results) {
    const usage = row.usage as {
      inputTokens?: number;
      outputTokens?: number;
      model?: string;
    } | null;
    if (!usage) continue;
    const cost = TOKEN_COST_PER_1K[usage.model ?? ''];
    if (cost) {
      totalCost +=
        ((usage.inputTokens ?? 0) / 1000) * cost.input +
        ((usage.outputTokens ?? 0) / 1000) * cost.output;
    }
  }

  return {
    exceeded: totalCost >= job.costLimitUsd,
    currentCost: Math.round(totalCost * 10000) / 10000,
    limit: job.costLimitUsd,
  };
}

/** 스킵 모듈 목록 조회 */
export async function getSkippedModules(jobId: number): Promise<string[]> {
  const db = getDb();
  const [job] = await db
    .select({ skippedModules: collectionJobs.skippedModules })
    .from(collectionJobs)
    .where(eq(collectionJobs.id, jobId))
    .limit(1);
  return (job?.skippedModules as string[]) ?? [];
}
