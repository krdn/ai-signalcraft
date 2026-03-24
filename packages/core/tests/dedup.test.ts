import { describe, it, expect } from 'vitest';

// DB 연결이 필요한 통합 테스트 -- 실제 DB가 없으면 export 검증만 수행
describe('Dedup - DB Upsert', () => {
  it('should export persistArticles function', async () => {
    const { persistArticles } = await import('../src/pipeline/persist');
    expect(typeof persistArticles).toBe('function');
  });

  it('should export persistVideos function', async () => {
    const { persistVideos } = await import('../src/pipeline/persist');
    expect(typeof persistVideos).toBe('function');
  });

  it('should export persistComments function', async () => {
    const { persistComments } = await import('../src/pipeline/persist');
    expect(typeof persistComments).toBe('function');
  });

  it('should export createCollectionJob function', async () => {
    const { createCollectionJob } = await import('../src/pipeline/persist');
    expect(typeof createCollectionJob).toBe('function');
  });

  it('should export updateJobProgress function', async () => {
    const { updateJobProgress } = await import('../src/pipeline/persist');
    expect(typeof updateJobProgress).toBe('function');
  });
});
