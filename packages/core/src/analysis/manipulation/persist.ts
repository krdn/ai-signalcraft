import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import {
  manipulationRuns,
  manipulationSignals,
  manipulationEvidence,
} from '../../db/schema/manipulation';
import type { RunOutput } from './runner';

export type PersistInput = {
  jobId: number;
  subscriptionId: number | null;
  output: RunOutput;
  weightsVersion: string;
};

/**
 * 7개 신호 결과 + aggregate를 manipulation_runs/signals/evidence 3개 테이블에 영속화.
 *
 * 모든 INSERT를 단일 트랜잭션으로 묶음 — signals/evidence INSERT 실패 시
 * runs도 롤백되어 status='completed'인데 자식 row가 없는 corrupt 상태를 방지.
 */
export async function persistRun(db: Database, input: PersistInput): Promise<string> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(manipulationRuns)
      .values({
        jobId: input.jobId,
        subscriptionId: input.subscriptionId,
        status: 'completed',
        manipulationScore: input.output.aggregate.manipulationScore,
        confidenceFactor: input.output.aggregate.confidenceFactor,
        weightsVersion: input.weightsVersion,
        signalScores: input.output.aggregate.signalScores,
        completedAt: new Date(),
      })
      .returning({ id: manipulationRuns.id })
      .execute();

    const runId = inserted[0]?.id;
    if (!runId) {
      throw new Error('manipulation_runs INSERT returned no id');
    }

    // signals 배치 INSERT
    if (input.output.signals.length > 0) {
      await tx.insert(manipulationSignals).values(
        input.output.signals.map((s) => ({
          runId,
          signal: s.signal,
          score: s.score,
          confidence: s.confidence,
          metrics: s.metrics,
          computeMs: s.computeMs,
        })),
      );
    }

    // evidence 배치 INSERT
    const allEvidence = input.output.signals.flatMap((s) =>
      s.evidence.map((e) => ({
        runId,
        signal: e.signal,
        severity: e.severity,
        title: e.title,
        summary: e.summary,
        visualization: e.visualization,
        rawRefs: e.rawRefs,
        rank: e.rank,
      })),
    );
    if (allEvidence.length > 0) {
      await tx.insert(manipulationEvidence).values(allEvidence);
    }

    return runId;
  });
}

/**
 * run을 실패로 표시 — dryrun CLI / orchestrator의 catch 블록에서 호출.
 *
 * rowCount 검증으로 존재하지 않는 runId UPDATE의 무성 성공을 잡아 경고.
 * 이미 fail path이므로 throw하지 않고 console.warn — caller가 다른 error를
 * masking하지 않게 함.
 */
export async function markRunFailed(
  db: Database,
  runId: string,
  error: { message: string; stack?: string },
): Promise<void> {
  const result = await db
    .update(manipulationRuns)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorDetails: error,
    })
    .where(eq(manipulationRuns.id, runId));

  // node-postgres driver는 result.rowCount 노출 (cleanup.ts와 같은 패턴)
  const rowCount = (result as { rowCount?: number | null }).rowCount;
  if (rowCount !== undefined && rowCount !== null && rowCount === 0) {
    console.warn(`[manipulation] markRunFailed: runId ${runId} 존재하지 않음 (0 rows updated)`);
  }
}
