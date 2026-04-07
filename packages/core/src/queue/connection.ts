import type { ConnectionOptions } from 'bullmq';

// BullMQ Redis 연결 설정 -- ConnectionOptions 타입으로 ioredis 버전 충돌 방지
// REDIS_URL (redis://host:port 형식) 우선, 없으면 REDIS_HOST/REDIS_PORT 개별 변수 사용
//
// lazy 평가 (함수): process.env는 호출 시점에 읽음
// ESM에서 import가 호이스팅되므로, dotenv 로드 전에 모듈이 평가될 수 있어 함수로 감싸 지연 평가

/**
 * BullMQ 큐 prefix -- 개발/운영 환경에서 같은 Redis를 공유할 때 네임스페이스 분리
 *
 * Redis는 `{prefix}:{queueName}` 형식으로 키를 생성:
 *   - 운영 (NODE_ENV=production):  'bull' (기본값, BullMQ 라이브러리 기본)
 *   - 개발 (NODE_ENV!=production): 'ais-dev' (자동 강제 — 운영 큐 오염 방지)
 *
 * 같은 Redis를 써도 서로 다른 prefix를 사용하면 큐가 완전히 분리되어
 * 개발 워커가 운영 작업을 가로채거나 반대 현상이 발생하지 않음.
 *
 * 안전장치: 개발 환경에서 BULL_PREFIX가 명시되지 않으면 자동으로 'ais-dev'로 강제.
 * 운영 환경에서만 'bull'(BullMQ 기본값) 사용 — 기존 운영 큐와의 하위 호환성 유지.
 */
export function getBullPrefix(): string {
  const explicit = process.env.BULL_PREFIX;
  if (explicit) return explicit;
  // 개발 환경에서는 자동으로 'ais-dev' 강제 — 운영 큐('bull:*') 오염 방지
  return process.env.NODE_ENV === 'production' ? 'bull' : 'ais-dev';
}

/**
 * BullMQ Queue/Worker/FlowProducer 공통 옵션 생성
 * 모든 큐 생성 시 이 함수를 사용하여 prefix와 connection을 일관되게 주입
 */
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
