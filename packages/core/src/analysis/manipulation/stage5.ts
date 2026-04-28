import { getDb } from '../../db';
import { appendJobEvent } from '../../pipeline/persist';
import { getCollectorClient } from '../../collector-client';
import { evaluateManipulationAlerts } from '../../alerts/manipulation-evaluator';
import { resolveDomainConfig } from './config';
import { createCollectorManipulationLoader } from './loaders/collector-loader';
import { runManipulationDetection } from './runner';
import { persistRun } from './persist';

export type Stage5Args = {
  jobId: number;
  jobOptions: Record<string, unknown>;
  domain: string;
  dateRange: { start: Date; end: Date };
};

/**
 * Stage 5 — Manipulation Detection entry.
 *
 * 실행 조건: jobOptions.runManipulation === true AND options.subscriptionId 존재.
 * 실패는 본 분석 파이프라인에 영향 주지 않음 (try/catch + appendJobEvent 격리).
 */
export async function runStage5Manipulation(args: Stage5Args): Promise<void> {
  const subscriptionId =
    typeof args.jobOptions.subscriptionId === 'number' ? args.jobOptions.subscriptionId : null;
  const runFlag = args.jobOptions.runManipulation === true;
  if (!runFlag || !subscriptionId) {
    return;
  }

  await appendJobEvent(args.jobId, 'info', 'manipulation 분석 시작');

  try {
    const overrideRaw = args.jobOptions.manipulationDomainOverride;
    const targetDomain = typeof overrideRaw === 'string' && overrideRaw ? overrideRaw : args.domain;
    const config = await resolveDomainConfig(targetDomain);
    const sourcesRaw = args.jobOptions.sources;
    const sources = Array.isArray(sourcesRaw) ? (sourcesRaw as string[]) : [];

    const loader = createCollectorManipulationLoader({
      client: getCollectorClient(),
      subscriptionId,
      sources,
      dateRange: args.dateRange,
      baselineDays: config.baselineDays,
    });

    const output = await runManipulationDetection({
      jobId: args.jobId,
      subscriptionId,
      config,
      dateRange: args.dateRange,
      loader,
    });

    const runId = await persistRun(getDb(), {
      jobId: args.jobId,
      subscriptionId,
      output,
      weightsVersion: `v1-${config.domain}`,
    });

    // 알림 평가 — fire-and-forget. evaluator는 내부에서 모든 예외를 catch.
    void evaluateManipulationAlerts({
      runId,
      jobId: args.jobId,
      subscriptionId,
    });

    await appendJobEvent(
      args.jobId,
      'info',
      `manipulation 완료: score=${output.aggregate.manipulationScore.toFixed(1)}, confidence=${output.aggregate.confidenceFactor.toFixed(2)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendJobEvent(args.jobId, 'warn', `manipulation 실패: ${msg}`);
  }
}
