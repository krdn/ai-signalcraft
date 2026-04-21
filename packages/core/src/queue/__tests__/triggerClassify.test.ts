import { describe, it, expect } from 'vitest';

describe('triggerClassify', () => {
  it('flows 모듈에서 triggerClassify 함수가 export된다', async () => {
    const { triggerClassify } = await import('../flows');
    expect(typeof triggerClassify).toBe('function');
  });

  it('triggerClassify는 2개의 인자를 받는다 (dbJobId, keyword)', async () => {
    const { triggerClassify } = await import('../flows');
    expect(triggerClassify.length).toBe(2);
  });
});
