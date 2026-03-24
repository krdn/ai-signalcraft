import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

describe('naver comments pipeline integration', () => {
  it('flows.ts에서 collect-naver-comments가 제거되었다', () => {
    const flowsContent = readFileSync(resolve(__dirname, '../src/queue/flows.ts'), 'utf-8');
    expect(flowsContent).not.toContain("name: 'collect-naver-comments'");
    expect(flowsContent).toContain("name: 'collect-naver-articles'");
  });

  it('worker-process.ts에서 normalize-naver 시 collectForArticle을 호출한다', () => {
    const workerContent = readFileSync(resolve(__dirname, '../src/queue/worker-process.ts'), 'utf-8');
    expect(workerContent).toContain('collectForArticle');
    expect(workerContent).toContain("job.name === 'normalize-naver'");
  });

  it('normalize-naver data에 maxComments가 포함된다', () => {
    const flowsContent = readFileSync(resolve(__dirname, '../src/queue/flows.ts'), 'utf-8');
    // normalize-naver의 data 객체에 maxComments가 있어야 함
    expect(flowsContent).toContain('maxComments');
  });
});
