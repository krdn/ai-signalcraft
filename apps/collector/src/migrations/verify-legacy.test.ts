import { describe, it, expect } from 'vitest';
import { judge, percent } from './verify-legacy';

describe('judge', () => {
  it('legacy=0이면 항상 ok (나눗셈 회피)', () => {
    expect(judge(0, 0)).toBe('ok');
    expect(judge(0, 100)).toBe('ok');
  });

  it('95% 이상이면 ok', () => {
    expect(judge(100, 95)).toBe('ok');
    expect(judge(100, 100)).toBe('ok');
    expect(judge(100, 150)).toBe('ok'); // target이 더 많아도 ok
  });

  it('90% 이상 95% 미만은 warn', () => {
    expect(judge(100, 94)).toBe('warn');
    expect(judge(100, 90)).toBe('warn');
  });

  it('90% 미만은 fail', () => {
    expect(judge(100, 89)).toBe('fail');
    expect(judge(100, 0)).toBe('fail');
  });

  it('경계값 정확히 처리', () => {
    expect(judge(1000, 950)).toBe('ok');
    expect(judge(1000, 949)).toBe('warn');
    expect(judge(1000, 900)).toBe('warn');
    expect(judge(1000, 899)).toBe('fail');
  });
});

describe('percent', () => {
  it('whole=0이면 em-dash', () => {
    expect(percent(0, 0)).toBe('—');
    expect(percent(5, 0)).toBe('—');
  });

  it('비율을 소수 1자리로 포맷', () => {
    expect(percent(50, 100)).toBe('50.0%');
    expect(percent(1, 3)).toBe('33.3%');
    expect(percent(2, 3)).toBe('66.7%');
  });

  it('100%, 0% 정상 표기', () => {
    expect(percent(100, 100)).toBe('100.0%');
    expect(percent(0, 100)).toBe('0.0%');
  });

  it('target이 source보다 많을 때도 계산', () => {
    expect(percent(150, 100)).toBe('150.0%');
  });
});
