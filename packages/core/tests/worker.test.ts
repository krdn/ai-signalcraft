import { describe, it, expect } from 'vitest';

describe('worker', () => {
  it('should export createCollectorWorker', async () => {
    const { createCollectorWorker } = await import('../src/queue/workers');
    expect(typeof createCollectorWorker).toBe('function');
  });

  it('should export createPipelineWorker', async () => {
    const { createPipelineWorker } = await import('../src/queue/workers');
    expect(typeof createPipelineWorker).toBe('function');
  });

  it('should be importable without errors (worker-process module check)', async () => {
    // worker-process.ts를 직접 import하면 Worker가 기동되므로,
    // 대신 worker-process가 사용하는 핵심 모듈들이 정상 import되는지 확인
    const pipeline = await import('../src/pipeline');
    expect(typeof pipeline.normalizeNaverArticle).toBe('function');
    expect(typeof pipeline.normalizeYoutubeVideo).toBe('function');
    expect(typeof pipeline.persistArticles).toBe('function');
    expect(typeof pipeline.persistVideos).toBe('function');
    expect(typeof pipeline.persistComments).toBe('function');
  });

  it('should export updateJobProgress from pipeline', async () => {
    const { updateJobProgress } = await import('../src/pipeline');
    expect(typeof updateJobProgress).toBe('function');
  });
});
