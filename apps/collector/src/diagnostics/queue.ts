import { Queue } from 'bullmq';
import { getBullMQOptions } from '../queue/connection';

/**
 * Diagnostics 큐 job payload — 3가지 종류.
 * - layer-b: Layer B (소스 건강도) 비동기 수집, 완료 시 run_diagnostics.layerB UPDATE
 * - layer-c: Layer C (시스템 상태) 비동기 수집, 완료 시 run_diagnostics.layerC UPDATE
 * - escalate-to-force: 10분 후 cancel이 여전히 cancelling이면 force로 승격
 */
export type DiagnosticsJobData =
  | { kind: 'layer-b'; diagnosticId: string; source: string }
  | { kind: 'layer-c'; diagnosticId: string }
  | { kind: 'escalate-to-force'; runId: string; source: string };

let queue: Queue<DiagnosticsJobData> | null = null;

/**
 * Singleton queue factory — 첫 호출 시 lazy init.
 * 환경별 prefix 자동 분리 (collector / collector-dev).
 */
export function getDiagnosticsQueue(): Queue<DiagnosticsJobData> {
  if (!queue) {
    queue = new Queue<DiagnosticsJobData>('diagnostics', getBullMQOptions());
  }
  return queue;
}
