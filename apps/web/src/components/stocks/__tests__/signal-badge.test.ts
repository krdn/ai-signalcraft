import { describe, it, expect } from 'vitest';
import { signalMeta } from '../signal-badge';

describe('signalMeta', () => {
  it('strong_buy/buy는 초록 계열, sell/strong_sell은 빨강 계열, hold는 중립', () => {
    expect(signalMeta('strong_buy').tone).toBe('positive');
    expect(signalMeta('buy').tone).toBe('positive');
    expect(signalMeta('hold').tone).toBe('neutral');
    expect(signalMeta('sell').tone).toBe('negative');
    expect(signalMeta('strong_sell').tone).toBe('negative');
  });

  it('각 시그널에 한국어 라벨 제공', () => {
    expect(signalMeta('strong_buy').label).toBe('적극 매수');
    expect(signalMeta('hold').label).toBe('보유');
  });
});
