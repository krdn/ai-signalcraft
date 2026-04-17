/**
 * Redis 컨텐츠 캐시 — BullMQ 와 동일 Redis 인스턴스를 공유하되
 * `ais:{env}:` prefix 로 키공간을 분리해 큐 키와 섞이지 않게 한다.
 *
 * 주 용도:
 * - 재사용 플래너 결과 (동시 flow 중복 쿼리 방지)
 * - 검색 URL 목록 (collector 재검색 방지)
 * - 전처리(RAG/dedup/cluster) 결과 스냅샷 (cross-job 재사용)
 * - 쿼리 임베딩 (반복되는 분석 프롬프트 텍스트의 임베딩 캐시)
 *
 * 모든 키는 contentHash 또는 deterministic input 기반 → 수동 invalidate 불필요.
 * 모듈/스키마 버전을 키에 포함해 코드 변경 시 자연 퇴출.
 */
import { createHash } from 'node:crypto';
import Redis, { type RedisOptions } from 'ioredis';
import { isContentCacheDisabled } from '../pipeline/reuse-config';

type CacheRedis = Pick<Redis, 'get' | 'set' | 'del' | 'quit'>;

let _client: CacheRedis | null = null;

function resolveOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
        ...(parsed.password ? { password: parsed.password } : {}),
        ...(parsed.username ? { username: parsed.username } : {}),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: true,
      };
    } catch {
      // fall through to individual vars
    }
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  };
}

/**
 * 컨텐츠 캐시 전용 ioredis 인스턴스. BullMQ 연결과 분리해
 * 캐시 에러가 큐 동작을 방해하지 않도록 한다.
 */
export function getCacheRedis(): CacheRedis {
  if (!_client) {
    _client = new Redis(resolveOptions());
  }
  return _client;
}

/**
 * env 별 네임스페이스. 개발/운영 같은 Redis 사용 시 키 충돌 방지.
 * BullMQ prefix (`bull` vs `ais-dev`) 와는 별개.
 */
export function getCachePrefix(): string {
  const explicit = process.env.CACHE_PREFIX;
  if (explicit) return explicit;
  return process.env.NODE_ENV === 'production' ? 'ais' : 'ais-dev';
}

export function buildCacheKey(...parts: string[]): string {
  return `${getCachePrefix()}:${parts.join(':')}`;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * JSON 직렬화 가능한 값을 TTL 과 함께 저장.
 * Redis 오류/비활성 시 조용히 실패 (캐시는 필수 경로가 아니어야 함).
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (isContentCacheDisabled()) return;
  try {
    const client = getCacheRedis();
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.warn('[redis-cache] set 실패:', key, err);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (isContentCacheDisabled()) return null;
  try {
    const client = getCacheRedis();
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('[redis-cache] get 실패:', key, err);
    return null;
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const client = getCacheRedis();
    await client.del(key);
  } catch (err) {
    console.warn('[redis-cache] del 실패:', key, err);
  }
}

/**
 * get-or-set 헬퍼 — 캐시 miss 시 producer 를 실행해 결과를 저장.
 * producer 가 예외를 던지면 캐시 저장 없이 그대로 throw.
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<{ value: T; hit: boolean }> {
  const existing = await cacheGet<T>(key);
  if (existing !== null) return { value: existing, hit: true };
  const value = await producer();
  await cacheSet(key, value, ttlSeconds);
  return { value, hit: false };
}

// ---- 네임스페이스별 키 빌더 (타이포 방지) ----

export function keyReusePlan(
  source: string,
  keyword: string,
  startIso: string,
  endIso: string,
): string {
  const periodHash = sha256(`${startIso}|${endIso}`).slice(0, 12);
  const kwHash = sha256(keyword.toLowerCase().trim()).slice(0, 12);
  return buildCacheKey('plan', source, kwHash, periodHash);
}

export function keySearchUrls(source: string, keyword: string, dateBucket: string): string {
  const kwHash = sha256(keyword.toLowerCase().trim()).slice(0, 12);
  return buildCacheKey('search', source, kwHash, dateBucket);
}

export function keyPreprocessing(
  inputHash: string,
  moduleId: string,
  moduleVersion: string,
): string {
  return buildCacheKey('preproc', inputHash, moduleId, moduleVersion);
}

export function keyEmbedding(text: string, modelId: string): string {
  const textHash = sha256(text);
  return buildCacheKey('emb', modelId, textHash);
}

/**
 * 테스트/종료 시 클라이언트 정리.
 */
export async function closeCacheRedis(): Promise<void> {
  if (_client) {
    try {
      await _client.quit();
    } catch {
      // ignore
    }
    _client = null;
  }
}
