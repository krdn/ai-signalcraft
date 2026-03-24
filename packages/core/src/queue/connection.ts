import type { ConnectionOptions } from 'bullmq';

// BullMQ Redis 연결 설정 -- ConnectionOptions 타입으로 ioredis 버전 충돌 방지
export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6383,
  maxRetriesPerRequest: null,  // BullMQ 필수 설정
};
