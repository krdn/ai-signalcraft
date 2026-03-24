import { describe, it, expect } from 'vitest';

describe('Queue - triggerCollection', () => {
  it('should export triggerCollection function', async () => {
    const { triggerCollection } = await import('../src/queue/flows');
    expect(typeof triggerCollection).toBe('function');
  });

  it('should export CollectionTriggerSchema', async () => {
    const { CollectionTriggerSchema } = await import('../src/types');
    expect(CollectionTriggerSchema).toBeDefined();

    // 유효한 입력 파싱
    const valid = CollectionTriggerSchema.parse({
      keyword: '윤석열',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    expect(valid.keyword).toBe('윤석열');
  });

  it('should reject invalid CollectionTrigger', async () => {
    const { CollectionTriggerSchema } = await import('../src/types');
    expect(() => CollectionTriggerSchema.parse({ keyword: '' })).toThrow();
  });

  it('sources 필드가 포함된 입력이 유효하게 파싱된다', async () => {
    const { CollectionTriggerSchema } = await import('../src/types');
    const result = CollectionTriggerSchema.parse({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
      sources: ['naver', 'youtube'],
    });
    expect(result.sources).toEqual(['naver', 'youtube']);
  });

  it('sources 필드가 없는 입력도 유효하게 파싱된다 (하위 호환)', async () => {
    const { CollectionTriggerSchema } = await import('../src/types');
    const result = CollectionTriggerSchema.parse({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
    });
    expect(result.sources).toBeUndefined();
  });

  it('sources에 유효하지 않은 소스명은 거부된다', async () => {
    const { CollectionTriggerSchema } = await import('../src/types');
    expect(() => CollectionTriggerSchema.parse({
      keyword: '테스트',
      startDate: '2026-03-17T00:00:00.000Z',
      endDate: '2026-03-24T00:00:00.000Z',
      sources: ['invalid-source'],
    })).toThrow();
  });
});
