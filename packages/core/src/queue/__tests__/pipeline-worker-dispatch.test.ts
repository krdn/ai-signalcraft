import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

// vi.mock은 import 전에 호이스팅되므로 const는 참조 불가 → vi.hoisted로 함께 끌어올림
const { handleNormalize, handlePersist, handleClassify } = vi.hoisted(() => ({
  handleNormalize: vi.fn().mockResolvedValue({ normalized: true }),
  handlePersist: vi.fn().mockResolvedValue({ persisted: true }),
  handleClassify: vi.fn().mockResolvedValue({ classified: true }),
}));

vi.mock('../pipeline-worker-normalize', () => ({ handleNormalize }));
vi.mock('../pipeline-worker-persist', () => ({ handlePersist }));
vi.mock('../pipeline-worker-classify', () => ({ handleClassify }));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  logError: vi.fn(),
}));

const { createPipelineHandler } = await import('../pipeline-worker');

const makeJob = (name: string, data: Record<string, unknown> = {}): Job =>
  ({ name, data: { dbJobId: 1, ...data } }) as unknown as Job;

describe('createPipelineHandler dispatcher', () => {
  beforeEach(() => {
    handleNormalize.mockClear();
    handlePersist.mockClear();
    handleClassify.mockClear();
  });

  it('normalize-naver를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('normalize-naver'));
    expect(handleNormalize).toHaveBeenCalledOnce();
    expect(handlePersist).not.toHaveBeenCalled();
    expect(handleClassify).not.toHaveBeenCalled();
    expect(result).toEqual({ normalized: true });
  });

  it('normalize-youtube를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    await handler(makeJob('normalize-youtube'));
    expect(handleNormalize).toHaveBeenCalledOnce();
  });

  it('normalize-feed-*를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    await handler(makeJob('normalize-feed-uuid-123'));
    expect(handleNormalize).toHaveBeenCalledOnce();
  });

  it('normalize-community를 handleNormalize로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    await handler(makeJob('normalize-community-dcinside'));
    expect(handleNormalize).toHaveBeenCalledOnce();
  });

  it('persist를 handlePersist로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('persist'));
    expect(handlePersist).toHaveBeenCalledOnce();
    expect(handleNormalize).not.toHaveBeenCalled();
    expect(result).toEqual({ persisted: true });
  });

  it('classify를 handleClassify로 라우팅한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('classify'));
    expect(handleClassify).toHaveBeenCalledOnce();
    expect(handleClassify.mock.calls[0]).toHaveLength(1); // classify는 jobStartTime 미전달
    expect(result).toEqual({ classified: true });
  });

  it('알 수 없는 job.name은 undefined를 반환한다', async () => {
    const handler = createPipelineHandler();
    const result = await handler(makeJob('unknown-stage'));
    expect(handleNormalize).not.toHaveBeenCalled();
    expect(handlePersist).not.toHaveBeenCalled();
    expect(handleClassify).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('jobStartTime을 normalize/persist에 전달한다', async () => {
    const handler = createPipelineHandler();

    const beforePersist = Date.now();
    await handler(makeJob('persist'));
    const afterPersist = Date.now();
    const [, persistTime] = handlePersist.mock.calls[0];
    expect(typeof persistTime).toBe('number');
    expect(persistTime).toBeGreaterThanOrEqual(beforePersist);
    expect(persistTime).toBeLessThanOrEqual(afterPersist);

    const beforeNormalize = Date.now();
    await handler(makeJob('normalize-naver'));
    const afterNormalize = Date.now();
    const [, normalizeTime] = handleNormalize.mock.calls[0];
    expect(typeof normalizeTime).toBe('number');
    expect(normalizeTime).toBeGreaterThanOrEqual(beforeNormalize);
    expect(normalizeTime).toBeLessThanOrEqual(afterNormalize);
  });
});
