import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
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

describe('naver comments pipeline integration', () => {
  it('flows.ts에서 collect-naver-comments가 제거되었다', () => {
    const flowsContent = readFileSync(resolve(__dirname, '../src/queue/flows.ts'), 'utf-8');
    expect(flowsContent).not.toContain("name: 'collect-naver-comments'");
    expect(flowsContent).toContain("name: 'collect-naver-articles'");
  });

  it('pipeline-worker 모듈군에서 normalize-naver 시 collectForArticle을 호출한다', () => {
    const queueDir = resolve(__dirname, '../src/queue');
    const workerFiles = readdirSync(queueDir)
      .filter((f) => f.startsWith('pipeline-worker') && f.endsWith('.ts'))
      .map((f) => readFileSync(join(queueDir, f), 'utf-8'))
      .join('\n');
    expect(workerFiles).toContain('collectForArticle');
    expect(workerFiles).toContain("job.name === 'normalize-naver'");
  });

  it('normalize-naver data에 maxComments가 포함된다', () => {
    const flowsContent = readFileSync(resolve(__dirname, '../src/queue/flows.ts'), 'utf-8');
    // normalize-naver의 data 객체에 maxComments가 있어야 함
    expect(flowsContent).toContain('maxComments');
  });
});
