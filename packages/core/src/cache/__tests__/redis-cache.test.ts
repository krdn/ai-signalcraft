import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCacheKey,
  getCachePrefix,
  keyEmbedding,
  keyPreprocessing,
  keyReusePlan,
  keySearchUrls,
  sha256,
} from '../redis-cache';

describe('redis-cache 키 빌더', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    for (const key of ['CACHE_PREFIX', 'NODE_ENV']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  describe('getCachePrefix', () => {
    it('운영 환경은 ais', () => {
      delete process.env.CACHE_PREFIX;
      process.env.NODE_ENV = 'production';
      expect(getCachePrefix()).toBe('ais');
    });

    it('개발 환경은 ais-dev', () => {
      delete process.env.CACHE_PREFIX;
      process.env.NODE_ENV = 'development';
      expect(getCachePrefix()).toBe('ais-dev');
    });

    it('명시적 env 오버라이드', () => {
      process.env.CACHE_PREFIX = 'custom';
      expect(getCachePrefix()).toBe('custom');
    });
  });

  describe('buildCacheKey', () => {
    it('prefix 와 parts 를 : 로 연결', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      expect(buildCacheKey('foo', 'bar', 'baz')).toBe('ais-test:foo:bar:baz');
    });
  });

  describe('sha256', () => {
    it('결정적 해시', () => {
      expect(sha256('hello')).toBe(sha256('hello'));
      expect(sha256('a')).not.toBe(sha256('b'));
      expect(sha256('hello')).toHaveLength(64);
    });
  });

  describe('keyReusePlan', () => {
    it('같은 입력은 같은 키', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      const a = keyReusePlan('naver', '이재명', '2026-01-01T00:00:00Z', '2026-01-07T00:00:00Z');
      const b = keyReusePlan('naver', '이재명', '2026-01-01T00:00:00Z', '2026-01-07T00:00:00Z');
      expect(a).toBe(b);
    });

    it('키워드 대소문자 변주는 같은 키 (normalize)', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      const a = keyReusePlan('naver', 'Hello', '2026-01-01T00:00:00Z', '2026-01-07T00:00:00Z');
      const b = keyReusePlan('naver', 'hello', '2026-01-01T00:00:00Z', '2026-01-07T00:00:00Z');
      expect(a).toBe(b);
    });

    it('다른 소스는 다른 키', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      const a = keyReusePlan('naver', 'kw', '2026-01-01T00:00:00Z', '2026-01-07T00:00:00Z');
      const b = keyReusePlan('dcinside', 'kw', '2026-01-01T00:00:00Z', '2026-01-07T00:00:00Z');
      expect(a).not.toBe(b);
    });

    it('다른 기간은 다른 키', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      const a = keyReusePlan('naver', 'kw', '2026-01-01T00:00:00Z', '2026-01-07T00:00:00Z');
      const b = keyReusePlan('naver', 'kw', '2026-01-01T00:00:00Z', '2026-01-14T00:00:00Z');
      expect(a).not.toBe(b);
    });
  });

  describe('keySearchUrls', () => {
    it('dateBucket 포함', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      const k = keySearchUrls('naver', 'kw', '2026-01-01');
      expect(k).toContain('search');
      expect(k).toContain('naver');
      expect(k).toContain('2026-01-01');
    });
  });

  describe('keyPreprocessing', () => {
    it('inputHash + moduleId + version 조합', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      const k = keyPreprocessing('abc123', 'macro-view', 'v1');
      expect(k).toBe('ais-test:preproc:abc123:macro-view:v1');
    });

    it('모듈 버전이 다르면 다른 키 (코드 변경 시 자연 퇴출)', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      expect(keyPreprocessing('abc', 'm', 'v1')).not.toBe(keyPreprocessing('abc', 'm', 'v2'));
    });
  });

  describe('keyEmbedding', () => {
    it('동일 텍스트는 동일 키', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      expect(keyEmbedding('hello', 'e5')).toBe(keyEmbedding('hello', 'e5'));
    });

    it('모델이 다르면 다른 키', () => {
      process.env.CACHE_PREFIX = 'ais-test';
      expect(keyEmbedding('hello', 'e5')).not.toBe(keyEmbedding('hello', 'bge'));
    });
  });
});
