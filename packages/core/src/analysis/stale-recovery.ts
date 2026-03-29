// Worker 시작 시 좀비 running 상태 분석 모듈 자동 복구
// Worker 재시작으로 인해 DB에 running으로 남아있는 분석 결과를 failed로 정리
import { getDb } from '../db';
import { analysisResults } from '../db/schema/analysis';
import { eq, and, lt, sql } from 'drizzle-orm';

/**
 * running 상태로 오래 방치된 분석 모듈을 failed로 전환
 * Worker 시작 시 1회 호출하여 좀비 상태 정리
 */
export async function recoverStaleJobs(
  staleThresholdMinutes: number = 30,
): Promise<{ recovered: number; jobIds: number[] }> {
  const threshold = sql`now() - interval '${sql.raw(String(staleThresholdMinutes))} minutes'`;

  const staleRows = await getDb()
    .update(analysisResults)
    .set({
      status: 'failed',
      errorMessage: `Worker 재시작으로 인한 자동 복구 (${staleThresholdMinutes}분 이상 running 상태)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(analysisResults.status, 'running'),
        lt(analysisResults.updatedAt, threshold),
      ),
    )
    .returning({ jobId: analysisResults.jobId, module: analysisResults.module });

  const jobIds = [...new Set(staleRows.map((r) => r.jobId))];

  if (staleRows.length > 0) {
    console.log(
      `[stale-recovery] ${staleRows.length}개 좀비 모듈 복구 완료:`,
      staleRows.map((r) => `job=${r.jobId}/${r.module}`).join(', '),
    );
  }

  return { recovered: staleRows.length, jobIds };
}
