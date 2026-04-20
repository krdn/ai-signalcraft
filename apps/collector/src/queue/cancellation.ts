import { and, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { runCancellations } from '../db/schema';

/**
 * 수집 작업이 협력적으로 중단되었음을 나타내는 에러.
 * worker catch 블록에서 일반 에러와 구분해 재시도 없이 종결시키는 용도.
 */
export class CancelledError extends Error {
  constructor(
    public readonly runId: string,
    public readonly source: string,
  ) {
    super(`Run ${runId}/${source} cancelled`);
    this.name = 'CancelledError';
  }
}

/**
 * worker의 단계/배치 시작부에서 호출. cancelling/cancelled이면 CancelledError throw.
 * BullMQ 외부 force cancel만으로는 실행 중인 processor를 멈출 수 없으므로,
 * 이 함수가 유일한 cooperative 중단 신호다 (Task 0 검증).
 */
export async function checkCancellation(runId: string, source: string): Promise<void> {
  const [row] = await getDb()
    .select()
    .from(runCancellations)
    .where(and(eq(runCancellations.runId, runId), eq(runCancellations.source, source)))
    .limit(1);
  if (row && (row.status === 'cancelling' || row.status === 'cancelled')) {
    throw new CancelledError(runId, source);
  }
}

/**
 * job 종료 시 호출. cancelling이면 cancelled로 최종 전이.
 * 멱등: 이미 cancelled면 0 row affected로 no-op. 동시 worker 경합 안전.
 */
export async function finalizeCancellationIfDone(runId: string, source: string): Promise<void> {
  await getDb()
    .update(runCancellations)
    .set({ status: 'cancelled', finalizedAt: new Date() })
    .where(
      and(
        eq(runCancellations.runId, runId),
        eq(runCancellations.source, source),
        eq(runCancellations.status, 'cancelling'),
      ),
    );
}
