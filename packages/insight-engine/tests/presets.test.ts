import { describe, it, expect } from 'vitest';
import { OPTIMIZATION_PRESETS, type OptimizationPreset } from '../src/preprocessing/presets';

describe('OPTIMIZATION_PRESETS', () => {
  it('4개 프리셋이 정의되어 있어야 한다', () => {
    expect(Object.keys(OPTIMIZATION_PRESETS)).toHaveLength(4);
    expect(OPTIMIZATION_PRESETS).toHaveProperty('none');
    expect(OPTIMIZATION_PRESETS).toHaveProperty('light');
    expect(OPTIMIZATION_PRESETS).toHaveProperty('standard');
    expect(OPTIMIZATION_PRESETS).toHaveProperty('aggressive');
  });

  it('none 프리셋은 모든 최적화가 비활성이다', () => {
    const none = OPTIMIZATION_PRESETS.none;
    expect(none.deduplication).toBe(false);
    expect(none.clustering).toBe(false);
    expect(none.commentLimit).toBeNull();
  });

  it('프리셋 강도가 올라갈수록 유사도 임계값이 낮아진다', () => {
    const light = OPTIMIZATION_PRESETS.light;
    const standard = OPTIMIZATION_PRESETS.standard;
    const aggressive = OPTIMIZATION_PRESETS.aggressive;
    expect(light.similarityThreshold!).toBeGreaterThan(standard.similarityThreshold!);
    expect(standard.similarityThreshold!).toBeGreaterThan(aggressive.similarityThreshold!);
  });

  it('aggressive만 클러스터링이 활성이다', () => {
    expect(OPTIMIZATION_PRESETS.light.clustering).toBe(false);
    expect(OPTIMIZATION_PRESETS.standard.clustering).toBe(false);
    expect(OPTIMIZATION_PRESETS.aggressive.clustering).toBe(true);
  });

  it('댓글 상한이 프리셋 강도에 따라 줄어든다', () => {
    expect(OPTIMIZATION_PRESETS.light.commentLimit!).toBeGreaterThan(
      OPTIMIZATION_PRESETS.standard.commentLimit!,
    );
    expect(OPTIMIZATION_PRESETS.standard.commentLimit!).toBeGreaterThan(
      OPTIMIZATION_PRESETS.aggressive.commentLimit!,
    );
  });
});
