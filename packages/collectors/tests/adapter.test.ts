import { describe, it, expect } from 'vitest';
import type { Collector, CollectionOptions } from '../src/adapters/base';
import { registerCollector, getCollector, getAllCollectors } from '../src/adapters/registry';

// 테스트용 Mock 수집기
class MockCollector implements Collector<{ id: string; text: string }> {
  readonly source = 'mock-source';

  async *collect(options: CollectionOptions) {
    yield [{ id: '1', text: `result for ${options.keyword}` }];
  }
}

describe('Collector Adapter Interface', () => {
  it('should register and retrieve a collector', () => {
    const mock = new MockCollector();
    registerCollector(mock);
    const retrieved = getCollector('mock-source');
    expect(retrieved).toBeDefined();
    expect(retrieved?.source).toBe('mock-source');
  });

  it('should collect data via AsyncGenerator', async () => {
    const mock = new MockCollector();
    const options: CollectionOptions = {
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    };

    const chunks: any[] = [];
    for await (const chunk of mock.collect(options)) {
      chunks.push(...chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('테스트');
  });

  it('should return undefined for unregistered collector', () => {
    const result = getCollector('nonexistent');
    expect(result).toBeUndefined();
  });
});
