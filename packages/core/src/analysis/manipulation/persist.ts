import { eq } from 'drizzle-orm';
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

// db는 drizzle 인스턴스 (타입은 caller가 전달, 테스트에서 모의 가능)
export async function persistRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: PersistInput,
): Promise<string> {
  const inserted = await db
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
  const runId: string = inserted[0].id;

  // signals 배치 INSERT
  if (input.output.signals.length > 0) {
    await db.insert(manipulationSignals).values(
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
    await db.insert(manipulationEvidence).values(allEvidence);
  }

  return runId;
}

export async function markRunFailed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  runId: string,
  error: { message: string; stack?: string },
): Promise<void> {
  await db
    .update(manipulationRuns)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorDetails: error,
    })
    .where(eq(manipulationRuns.id, runId));
}
