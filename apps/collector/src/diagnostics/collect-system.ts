import { sql } from 'drizzle-orm';
import IORedis from 'ioredis';
import { getDb } from '../db';
import { getRedisConnection } from '../queue/connection';
import { getCollectQueueStatus } from '../queue/health';
import type { LayerCPayload } from '../db/schema';

/**
 * Layer C — 시스템 전체 건강도 스냅샷. Redis/DB ping + 모든 수집 큐 상태 + 메모리.
 * 비동기 실행용이라 지연 SLA 없음. 각 ping은 실패해도 다른 섹션은 완주.
 */

async function pingRedis(): Promise<LayerCPayload['redis']> {
  const start = Date.now();
  const redis = new IORedis(getRedisConnection() as Record<string, unknown>);
  try {
    await redis.ping();
    return { ping: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { ping: 'fail', latencyMs: Date.now() - start };
  } finally {
    redis.disconnect();
  }
}

async function pingDb(): Promise<LayerCPayload['db']> {
  const start = Date.now();
  try {
    await getDb().execute(sql`SELECT 1`);
    return { ping: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { ping: 'fail', latencyMs: Date.now() - start };
  }
}

export async function collectLayerC(): Promise<LayerCPayload> {
  const [redis, db, queues] = await Promise.all([pingRedis(), pingDb(), getCollectQueueStatus()]);
  const processMemMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
  return { redis, db, queues, processMemMB };
}
