import { describe, it, expect } from 'vitest';
import { maskSensitive, truncate, sanitizeError } from './masking';

describe('maskSensitive', () => {
  it('32자 이상 영숫자 시퀀스를 [REDACTED]로 치환', () => {
    const input = 'api key is AKIAIOSFODNN7EXAMPLEabcdefghij1234567890';
    expect(maskSensitive(input)).toBe('api key is [REDACTED]');
  });

  it('짧은 토큰은 건드리지 않는다', () => {
    expect(maskSensitive('short abc123 ok')).toBe('short abc123 ok');
  });

  it('여러 시퀀스 모두 치환', () => {
    const input = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA then BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    expect(maskSensitive(input)).toBe('[REDACTED] then [REDACTED]');
  });

  it('null은 null 반환', () => {
    expect(maskSensitive(null)).toBeNull();
  });
});

describe('truncate', () => {
  it('4096자 초과 시 꼬리를 ... 으로 대체', () => {
    const long = 'x'.repeat(5000);
    const out = truncate(long, 4096);
    expect(out.length).toBe(4096);
    expect(out.endsWith('...')).toBe(true);
  });

  it('짧으면 그대로', () => {
    expect(truncate('short', 4096)).toBe('short');
  });
});

describe('sanitizeError', () => {
  it('masking + truncate를 한 번에', () => {
    // 긴 비영숫자 prefix(공백 포함) + 32자 토큰 → 토큰만 [REDACTED]로 치환된 뒤 100자로 잘린다
    const long = 'x '.repeat(2500) + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const out = sanitizeError(long, 100);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(100);
  });

  it('null은 null', () => {
    expect(sanitizeError(null)).toBeNull();
  });
});
