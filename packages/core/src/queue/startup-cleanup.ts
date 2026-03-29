// Worker 시작 시 Redis에 남아있는 고아 작업 정리
// cancelled/삭제된 DB 작업의 BullMQ 잔류물을 제거하여 concurrency 슬롯 확보
import Redis from 'ioredis';
import { getRedisConnection } from './connection';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { eq } from 'drizzle-orm';

export async function cleanupOrphanedRedisJobs(): Promise<number> {
  const conn = getRedisConnection() as { host?: string; port?: number };
  const redis = new Redis({ host: conn.host ?? 'localhost', port: conn.port ?? 6379 });
  const db = getDb();
  let cleaned = 0;

  try {
    for (const queueName of ['collectors', 'pipeline', 'analysis']) {
      const prefix = `bull:${queueName}`;

      // active 리스트의 모든 작업을 검사
      const activeJobIds = await redis.lrange(`${prefix}:active`, 0, -1);

      for (const bullJobId of activeJobIds) {
        const dataStr = await redis.hget(`${prefix}:${bullJobId}`, 'data');
        if (!dataStr) continue;

        let dbJobId: number;
        try {
          const data = JSON.parse(dataStr);
          dbJobId = data.dbJobId;
          if (!dbJobId) continue;
        } catch { continue; }

        // DB에서 해당 job이 존재하고 실행 가능한 상태인지 확인
        const [job] = await db.select({ status: collectionJobs.status })
          .from(collectionJobs).where(eq(collectionJobs.id, dbJobId)).limit(1);

        const shouldRemove = !job || job.status === 'cancelled' || job.status === 'failed';
        if (shouldRemove) {
          await redis.lrem(`${prefix}:active`, 0, bullJobId);
          await redis.del(
            `${prefix}:${bullJobId}`,
            `${prefix}:${bullJobId}:lock`,
            `${prefix}:${bullJobId}:dependencies`,
            `${prefix}:${bullJobId}:processed`,
          );
          cleaned++;
          console.log(`[startup-cleanup] ${queueName}:${bullJobId} 제거 (dbJobId=${dbJobId}, status=${job?.status ?? 'deleted'})`);
        }
      }

      // waiting-children도 동일하게 검사
      const wcJobIds = await redis.zrange(`${prefix}:waiting-children`, 0, -1);

      for (const bullJobId of wcJobIds) {
        const dataStr = await redis.hget(`${prefix}:${bullJobId}`, 'data');
        if (!dataStr) continue;

        let dbJobId: number;
        try {
          const data = JSON.parse(dataStr);
          dbJobId = data.dbJobId;
          if (!dbJobId) continue;
        } catch { continue; }

        const [job] = await db.select({ status: collectionJobs.status })
          .from(collectionJobs).where(eq(collectionJobs.id, dbJobId)).limit(1);

        const shouldRemove = !job || job.status === 'cancelled' || job.status === 'failed';
        if (shouldRemove) {
          await redis.zrem(`${prefix}:waiting-children`, bullJobId);
          await redis.del(
            `${prefix}:${bullJobId}`,
            `${prefix}:${bullJobId}:lock`,
            `${prefix}:${bullJobId}:dependencies`,
            `${prefix}:${bullJobId}:processed`,
          );
          cleaned++;
          console.log(`[startup-cleanup] ${queueName}:${bullJobId} (wc) 제거 (dbJobId=${dbJobId})`);
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[startup-cleanup] ${cleaned}개 고아 작업 정리 완료`);
    }
  } finally {
    await redis.quit();
  }

  return cleaned;
}
