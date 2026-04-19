import type { ConnectionOptions } from 'bullmq';

/**
 * BullMQ 큐 prefix
 *
 * 수집 시스템은 ais-signalcraft(apps/web)와 Redis를 공유하지만 prefix를 'collector'로
 * 별도로 두어 큐가 섞이지 않도록 강제.
 *
 *   - 운영:   'collector'
 *   - 개발:   'collector-dev'
 */
export function getBullPrefix(): string {
  const explicit = process.env.BULL_PREFIX;
  if (explicit) return explicit;
  return process.env.NODE_ENV === 'production' ? 'collector' : 'collector-dev';
}

export function getBullMQOptions(): { connection: ConnectionOptions; prefix: string } {
  return {
    connection: getRedisConnection(),
    prefix: getBullPrefix(),
  };
}

function parseRedisConnection(): ConnectionOptions {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
        ...(parsed.password ? { password: parsed.password } : {}),
        ...(parsed.username ? { username: parsed.username } : {}),
        maxRetriesPerRequest: null,
      };
    } catch {
      console.warn(`REDIS_URL 파싱 실패: ${redisUrl}, 개별 환경변수로 폴백`);
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  };
}

let _cached: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (!_cached) {
    _cached = parseRedisConnection();
  }
  return _cached;
}
