import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBullPrefix } from './connection';

describe('getBullPrefix', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.BULL_PREFIX;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('BULL_PREFIX가 명시되면 그 값을 사용한다', () => {
    process.env.BULL_PREFIX = 'custom-prefix';
    process.env.NODE_ENV = 'production';
    expect(getBullPrefix()).toBe('custom-prefix');
  });

  it('NODE_ENV=production이면 collector를 반환', () => {
    process.env.NODE_ENV = 'production';
    expect(getBullPrefix()).toBe('collector');
  });

  it('NODE_ENV=development이면 collector-dev를 반환', () => {
    process.env.NODE_ENV = 'development';
    expect(getBullPrefix()).toBe('collector-dev');
  });

  it('NODE_ENV 미설정 시 collector-dev로 안전하게 폴백', () => {
    expect(getBullPrefix()).toBe('collector-dev');
  });

  it('빈 문자열 BULL_PREFIX는 무시하고 환경 기반으로 폴백', () => {
    process.env.BULL_PREFIX = '';
    process.env.NODE_ENV = 'production';
    // 빈 문자열은 falsy이므로 NODE_ENV 기반 결정
    expect(getBullPrefix()).toBe('collector');
  });
});
