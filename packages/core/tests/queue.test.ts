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
});
