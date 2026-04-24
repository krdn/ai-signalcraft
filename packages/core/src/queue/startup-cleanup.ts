// Worker 시작 시 Redis에 남아있는 고아 작업 정리
// cancelled/삭제된 DB 작업의 BullMQ 잔류물을 제거하여 concurrency 슬롯 확보
//
// 핵심 원칙: BullMQ Queue API만 사용하여 안전하게 작업 제거
// Redis 직접 조작(lrem, del 등)은 BullMQ 내부 상태를 오염시키므로 금지
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { getBullMQOptions } from './connection';

export async function cleanupOrphanedRedisJobs(): Promise<number> {
  const db = getDb();
  const bullOpts = getBullMQOptions();
  let cleaned = 0;

  for (const queueName of ['collectors', 'pipeline', 'analysis']) {
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
