import { describe, it, expect } from 'vitest';
import { collectLayerC } from './collect-system';

describe('collectLayerC', () => {
  it('redis/db ping + queues + processMemMB를 반환', async () => {
    const result = await collectLayerC();
    expect(['ok', 'fail']).toContain(result.redis.ping);
    expect(['ok', 'fail']).toContain(result.db.ping);
    expect(typeof result.redis.latencyMs).toBe('number');
    expect(typeof result.db.latencyMs).toBe('number');
    expect(typeof result.processMemMB).toBe('number');
    expect(result.processMemMB).toBeGreaterThan(0);
    expect(result.queues).toBeDefined();
  });

  it('queue map에 모든 수집 큐가 존재', async () => {
    const result = await collectLayerC();
    const expectedQueues = [
      'collect-naver-news',
      'collect-naver-comments',
      'collect-youtube',
      'collect-dcinside',
      'collect-fmkorea',
      'collect-clien',
    ];
    for (const name of expectedQueues) {
      expect(result.queues[name]).toBeDefined();
      expect(result.queues[name].counts).toBeDefined();
    }
  });
});
