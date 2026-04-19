import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCollectorApiKey, getCollectorUrl } from '../src/collector-client';

describe('getCollectorUrl', () => {
  const original = process.env.COLLECTOR_URL;

  beforeEach(() => {
    delete process.env.COLLECTOR_URL;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.COLLECTOR_URL;
    } else {
      process.env.COLLECTOR_URL = original;
    }
  });

  it('환경변수 미설정 시 한국어 에러 메시지로 throw', () => {
    expect(() => getCollectorUrl()).toThrow('COLLECTOR_URL');
    expect(() => getCollectorUrl()).toThrow(/설정되지 않았습니다/);
  });

  it('정상 URL을 그대로 반환', () => {
    process.env.COLLECTOR_URL = 'http://localhost:3400';
    expect(getCollectorUrl()).toBe('http://localhost:3400');
  });

  it('말미의 슬래시를 제거', () => {
    process.env.COLLECTOR_URL = 'http://localhost:3400/';
    expect(getCollectorUrl()).toBe('http://localhost:3400');
  });

  it('여러 개의 슬래시도 모두 제거', () => {
    process.env.COLLECTOR_URL = 'https://collector.example.com///';
    expect(getCollectorUrl()).toBe('https://collector.example.com');
  });

  it('경로가 포함된 URL은 유지', () => {
    process.env.COLLECTOR_URL = 'https://api.example.com/v1';
    expect(getCollectorUrl()).toBe('https://api.example.com/v1');
  });
});

describe('getCollectorApiKey', () => {
  const original = process.env.COLLECTOR_API_KEY;

  beforeEach(() => {
    delete process.env.COLLECTOR_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.COLLECTOR_API_KEY;
    } else {
      process.env.COLLECTOR_API_KEY = original;
    }
  });

  it('환경변수 미설정 시 한국어 에러 메시지로 throw', () => {
    expect(() => getCollectorApiKey()).toThrow('COLLECTOR_API_KEY');
    expect(() => getCollectorApiKey()).toThrow(/설정되지 않았습니다/);
  });

  it('정상 key를 그대로 반환', () => {
    process.env.COLLECTOR_API_KEY = 'secret-token-123';
    expect(getCollectorApiKey()).toBe('secret-token-123');
  });

  it('빈 문자열은 미설정으로 취급', () => {
    process.env.COLLECTOR_API_KEY = '';
    expect(() => getCollectorApiKey()).toThrow('COLLECTOR_API_KEY');
  });
});
