import type { ConnectionOptions } from 'bullmq';

// BullMQ Redis 연결 설정 -- ConnectionOptions 타입으로 ioredis 버전 충돌 방지
// REDIS_URL (redis://host:port 형식) 우선, 없으면 REDIS_HOST/REDIS_PORT 개별 변수 사용
//
// lazy 평가 (함수): process.env는 호출 시점에 읽음
// ESM에서 import가 호이스팅되므로, dotenv 로드 전에 모듈이 평가될 수 있어 함수로 감싸 지연 평가
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
        maxRetriesPerRequest: null, // BullMQ 필수 설정
      };
    } catch {
      console.warn(`REDIS_URL 파싱 실패: ${redisUrl}, 개별 환경변수로 폴백`);
    }
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null, // BullMQ 필수 설정
  };
}

// lazy getter -- 첫 접근 시 process.env를 읽어 연결 설정을 생성하고 캐싱
let _cached: ConnectionOptions | null = null;

export function getRedisConnection(): ConnectionOptions {
  if (!_cached) {
    _cached = parseRedisConnection();
  }
  return _cached;
}

// 하위 호환: Next.js 환경에서는 모듈 로드 시점에 이미 env가 주입되어 있으므로 문제없음
// Worker 프로세스에서는 getRedisConnection() 사용 권장
export const redisConnection: ConnectionOptions = parseRedisConnection();
