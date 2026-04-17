import { describe, it, expect } from 'vitest';
import { applySarcasmAdjustment, applySarcasmAdjustments } from '../sarcasm-postprocess';

describe('applySarcasmAdjustment', () => {
  it('[SARCASM] 마커가 있으면 positive를 negative로 flip', () => {
    const result = applySarcasmAdjustment('참 잘났다 [SARCASM]', { label: 'positive', score: 0.9 });
    expect(result.label).toBe('negative');
  });

  it('[SARCASM] 없이 positive는 유지', () => {
    const result = applySarcasmAdjustment('진짜 훌륭한 정책', { label: 'positive', score: 0.9 });
    expect(result.label).toBe('positive');
  });

  it('[CRITICAL] 마커는 neutral을 negative로 강화', () => {
    const result = applySarcasmAdjustment('유전무죄 [CRITICAL]', { label: 'neutral', score: 0.5 });
    expect(result.label).toBe('negative');
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  it('[WEAK_APOLOGY] 마커는 positive를 negative로 강화', () => {
    const result = applySarcasmAdjustment('유감입니다 [WEAK_APOLOGY]', {
      label: 'positive',
      score: 0.7,
    });
    expect(result.label).toBe('negative');
  });

  it('[SARCASM?] 마커는 확신도만 낮춤', () => {
    const result = applySarcasmAdjustment('역시 우리 [SARCASM?]', {
      label: 'positive',
      score: 0.8,
    });
    expect(result.label).toBe('positive'); // flip 안 함
    expect(result.score).toBeLessThan(0.8); // 확신도 감소
  });

  it('이미 negative인 경우 그대로', () => {
    const result = applySarcasmAdjustment('이건 정말 최악입니다 [SARCASM]', {
      label: 'negative',
      score: 0.85,
    });
    expect(result.label).toBe('negative');
  });

  it('applySarcasmAdjustments 배치 처리', () => {
    const texts = ['참 잘났다 [SARCASM]', '정말 좋은 정책입니다', '유전무죄 [CRITICAL]'];
    const results = applySarcasmAdjustments(texts, [
      { label: 'positive', score: 0.9 },
      { label: 'positive', score: 0.9 },
      { label: 'neutral', score: 0.5 },
    ]);

    expect(results[0].label).toBe('negative'); // flip
    expect(results[1].label).toBe('positive'); // 유지
    expect(results[2].label).toBe('negative'); // 강화
  });
});
