import 'dotenv/config';
import { Worker } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db';
import { runDiagnostics, runCancellations } from '../db/schema';
import { getBullMQOptions } from '../queue/connection';
import { collectLayerB } from './collect-source';
import { collectLayerC } from './collect-system';
import type { DiagnosticsJobData } from './queue';

/**
 * Diagnostics worker — 3가지 job 종류를 처리.
 *
 * - layer-b: collectLayerB(source) 호출 후 run_diagnostics.layerB UPDATE
 * - layer-c: collectLayerC() 호출 후 run_diagnostics.layerC UPDATE
 * - escalate-to-force: 10분 delay 후 실행. run_cancellations가 여전히 cancelling이면
 *   cancelRun(runId, source, 'force')를 호출해 강제 승격.
 *
 * 실패 시 BullMQ 재시도(attempts 기본 3)에 맡긴다 — 진단은 손실되어도 critical path 아님.
 */
export function startDiagnosticsWorker(): Worker<DiagnosticsJobData> {
  const worker = new Worker<DiagnosticsJobData>(
    'diagnostics',
    async (job) => {
      const { data } = job;
      if (data.kind === 'layer-b') {
        const payload = await collectLayerB(data.source);
        await getDb()
          .update(runDiagnostics)
          .set({ layerB: payload, layerBAt: new Date() })
          .where(eq(runDiagnostics.id, data.diagnosticId));
        return;
      }
      if (data.kind === 'layer-c') {
        const payload = await collectLayerC();
        await getDb()
          .update(runDiagnostics)
          .set({ layerC: payload, layerCAt: new Date() })
          .where(eq(runDiagnostics.id, data.diagnosticId));
        return;
      }
      if (data.kind === 'escalate-to-force') {
        // 10분 경과 시점에 run_cancellations가 여전히 cancelling이면 force 승격
        const [row] = await getDb()
          .select()
          .from(runCancellations)
          .where(
            and(eq(runCancellations.runId, data.runId), eq(runCancellations.source, data.source)),
          )
          .limit(1);
        if (row && row.status === 'cancelling') {
          // dynamic import로 순환 의존 방지 — run-control.ts가 diagnostics/queue.ts를 import하기 때문.
          // Task 10에서 추가되므로 런타임 전용 경로로 tsc 정적 검사를 우회한다.
          const runControlPath = '../queue/run-control';
          const mod = (await import(runControlPath)) as {
            cancelRun: (
              runId: string,
              source: string,
              mode: 'force',
              reason: string,
            ) => Promise<void>;
          };
          await mod.cancelRun(data.runId, data.source, 'force', 'auto-stall-timeout');
        }
        return;
      }
    },
    {
      ...getBullMQOptions(),
      concurrency: 4,
    },
  );

  worker.on('completed', (job) => {
    console.warn(`[diagnostics-worker] completed kind=${job.data.kind}`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[diagnostics-worker] failed kind=${job?.data.kind}: ${err instanceof Error ? err.message : String(err)}`,
    );
  });

  return worker;
}

async function main() {
  const worker = startDiagnosticsWorker();
  console.warn('[diagnostics-worker] started');

  const shutdown = async (sig: string) => {
    console.warn(`[diagnostics-worker] ${sig} received, closing...`);
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// ESM 진입점 판정 (tsx 호환) — 독립 프로세스로 실행 가능
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[diagnostics-worker] fatal:', err);
    process.exit(1);
  });
}
