// 24시간 초과 paused 잡 자동 취소 cron — 1차 in-process timeout 안전망
import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { collectionJobs } from '../db/schema/collections';
import { cancelPipeline } from './control';
import { appendJobEvent } from './persist';

export async function expirePausedJobs(): Promise<number> {
  const db = getDb();
  const expired = await db
    .select({ id: collectionJobs.id })
    .from(collectionJobs)
    .where(
      and(
        eq(collectionJobs.status, 'paused'),
        lt(collectionJobs.pausedAt, sql`now() - interval '24 hours'`),
      ),
    );

  for (const { id } of expired) {
    try {
      await cancelPipeline(id);
      await appendJobEvent(id, 'warn', '24시간 정지 초과로 자동 취소되었습니다 (cron)').catch(
        () => {},
      );
    } catch (error) {
      console.error(`[expire-paused] 잡 ${id} 취소 실패:`, error);
    }
  }
  return expired.length;
}

let cronHandle: NodeJS.Timeout | null = null;

export function startExpirePausedCron(intervalMs = 60 * 60 * 1000) {
  if (cronHandle) return;
  cronHandle = setInterval(() => {
    expirePausedJobs().catch((err) => {
      console.error('[expire-paused] cron 실행 실패:', err);
    });
  }, intervalMs);
  console.log('[expire-paused] cron 시작 (1시간 주기)');
}

export function stopExpirePausedCron() {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
  }
}
