// Worker 시작 시 Redis에 남아있는 고아 작업 정리
// cancelled/삭제된 DB 작업의 BullMQ 잔류물을 제거하여 concurrency 슬롯 확보
//
// 핵심 원칙: BullMQ Queue API만 사용하여 안전하게 작업 제거
// Redis 직접 조작(lrem, del 등)은 BullMQ 내부 상태를 오염시키므로 금지
import { Queue } from 'bullmq';
import { eq, and, lt, sql, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { analysisResults } from '../db/schema/analysis';
import { getBullMQOptions } from './connection';

export async function cleanupOrphanedRedisJobs(): Promise<number> {
  const db = getDb();
  const bullOpts = getBullMQOptions();
  let cleaned = 0;

  // collectors 큐는 collector worker의 startup-recovery.ts가 담당 — 이중 복구 방지
  for (const queueName of ['pipeline', 'analysis'] as const) {
    const queue = new Queue(queueName, bullOpts);

    try {
      // waiting/delayed 상태의 고아 작업 제거 (안전)
      const jobs = await queue.getJobs(['waiting', 'delayed']);
      for (const job of jobs) {
        if (!job?.data?.dbJobId) continue;

        const [dbJob] = await db
          .select({ status: collectionJobs.status })
          .from(collectionJobs)
          .where(eq(collectionJobs.id, job.data.dbJobId))
          .limit(1);

        const shouldRemove = !dbJob || dbJob.status === 'cancelled' || dbJob.status === 'failed';
        if (shouldRemove) {
          try {
            await job.remove();
            cleaned++;
            console.log(
              `[startup-cleanup] ${queueName}:${job.id} 제거 (dbJobId=${job.data.dbJobId}, status=${dbJob?.status ?? 'deleted'})`,
            );
          } catch {
            // 이미 상태 변경됨 — 무시
          }
        }
      }

      // waiting-children 상태의 고아 작업도 확인
      // BullMQ Queue API로 가져와서 안전하게 제거
      const wcJobs = await queue.getJobs(['waiting-children']);
      for (const job of wcJobs) {
        if (!job?.data?.dbJobId) continue;

        const [dbJob] = await db
          .select({ status: collectionJobs.status })
          .from(collectionJobs)
          .where(eq(collectionJobs.id, job.data.dbJobId))
          .limit(1);

        const shouldRemove = !dbJob || dbJob.status === 'cancelled' || dbJob.status === 'failed';
        if (shouldRemove) {
          try {
            await job.remove();
            cleaned++;
            console.log(
              `[startup-cleanup] ${queueName}:${job.id} (wc) 제거 (dbJobId=${job.data.dbJobId})`,
            );
          } catch {
            // 이미 상태 변경됨 — 무시
          }
        }
      }

      // active 상태이지만 finishedOn이 없는 job → orphaned, 재큐잉
      const activeJobs = await queue.getJobs(['active']);
      for (const job of activeJobs) {
        if (!job) continue;

        // finishedOn이 있으면 정상 완료/실패한 것 — 스킵
        if (job.finishedOn) continue;

        // processedOn이 없으면 아직 처리 시작 전 — 스킵
        if (!job.processedOn) continue;

        console.warn(
          `[startup-cleanup] ${queueName}:${job.id} orphaned active job 감지 — 재큐잉 (dbJobId=${job.data?.dbJobId})`,
        );

        try {
          // 같은 data로 새 job 생성
          await queue.add(job.name, job.data, {
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 86400 },
            attempts: 3,
          });

          // 원본 job 제거
          await job.remove();
          cleaned++;
        } catch (err) {
          console.warn(
            `[startup-cleanup] ${queueName}:${job.id} 재큐잉 실패:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    } catch (err) {
      console.warn(`[startup-cleanup] ${queueName} 큐 정리 중 오류:`, err);
    } finally {
      await queue.close();
    }
  }

  if (cleaned > 0) {
    console.log(`[startup-cleanup] ${cleaned}개 고아 작업 정리 완료`);
  }

  return cleaned;
}

/**
 * DB에 'running'으로 남아있지만 BullMQ 큐에 존재하지 않는 고아 collection_jobs를 'failed'로 전환.
 *
 * 발생 원인: DB INSERT(status='running') 성공 후 Redis enqueue 실패 또는 Worker 비정상 종료 시
 * BullMQ에 job이 없으므로 processing이 영원히 시작되지 않아 stuck 상태가 됨.
 *
 * 판별 기준 (AND 조건):
 *   1. status = 'running'
 *   2. updated_at < now() - staleMinutes  (최소 N분간 heartbeat 없음)
 *   3. analysis 큐에 해당 dbJobId를 가진 waiting/active/delayed job 없음
 *   4. analysis_results 행 없음  (분석이 실제로 시작된 job은 건드리지 않음)
 *
 * 조건 3+4 없이 "N분 이상 running" 단순 판별 시 장시간 정상 실행 중인 job을 오살할 수 있음.
 */
export async function recoverOrphanedCollectionJobs(staleMinutes = 10): Promise<number> {
  const db = getDb();
  const bullOpts = getBullMQOptions();
  const threshold = sql`now() - interval '${sql.raw(String(staleMinutes))} minutes'`;

  // 1. N분 이상 running인 collection_jobs 조회
  const staleJobs = await db
    .select({ id: collectionJobs.id })
    .from(collectionJobs)
    .where(and(eq(collectionJobs.status, 'running'), lt(collectionJobs.updatedAt, threshold)));

  if (staleJobs.length === 0) return 0;

  const staleIds = staleJobs.map((j) => j.id);

  // 2. BullMQ analysis 큐에 살아있는 job dbJobId 목록 수집
  const analysisQueue = new Queue('analysis', bullOpts);
  let liveDbJobIds: Set<number>;
  try {
    const liveJobs = await analysisQueue.getJobs([
      'waiting',
      'active',
      'delayed',
      'waiting-children',
    ]);
    liveDbJobIds = new Set(
      liveJobs.filter((j) => j?.data?.dbJobId != null).map((j) => j.data.dbJobId as number),
    );
  } finally {
    await analysisQueue.close();
  }

  // 3. analysis_results 행이 있는 jobId 수집 (분석 진행 중인 job 보호)
  const analysedRows = await db
    .selectDistinct({ jobId: analysisResults.jobId })
    .from(analysisResults)
    .where(inArray(analysisResults.jobId, staleIds));
  const analysedJobIds = new Set(analysedRows.map((r) => r.jobId));

  // 4. 두 조건을 모두 만족하지 않는 job만 orphan으로 확정
  const orphanIds = staleIds.filter((id) => !liveDbJobIds.has(id) && !analysedJobIds.has(id));

  if (orphanIds.length === 0) return 0;

  await db
    .update(collectionJobs)
    .set({
      status: 'failed',
      errorDetails: {
        message: `Worker 시작 시 orphan 복구: BullMQ 큐에 없고 분석 결과 없음 (${staleMinutes}분 초과)`,
      },
    })
    .where(inArray(collectionJobs.id, orphanIds));

  console.log(
    `[startup-cleanup] collection_jobs orphan 복구: ${orphanIds.length}개 → failed (ids: ${orphanIds.join(', ')})`,
  );

  return orphanIds.length;
}
