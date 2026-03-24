import { describe, it, expect } from 'vitest';
import { FMKoreaCollector } from '../src/adapters/fmkorea';

describe('FMKoreaCollector', () => {
  it('source가 "fmkorea"', () => {
    const collector = new FMKoreaCollector();
    expect(collector.source).toBe('fmkorea');
  });

  it('Collector 인터페이스의 collect 메서드 구현', () => {
    const collector = new FMKoreaCollector();
    expect(typeof collector.collect).toBe('function');
  });

  it('collect가 AsyncGenerator를 반환', () => {
    const collector = new FMKoreaCollector();
    const generator = collector.collect({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    expect(generator[Symbol.asyncIterator]).toBeDefined();
  });
});
