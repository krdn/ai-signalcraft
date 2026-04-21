import { describe, it, expect } from 'vitest';
import {
  normalizeSentiment,
  applyKoreanSentimentRules,
  applySarcasmAdjustment,
  type SentimentResult,
} from './sentiment';

describe('normalizeSentiment', () => {
  it('1 star → negative', () => {
    expect(normalizeSentiment({ label: '1 star', score: 0.9 })).toEqual({
      label: 'negative',
      score: 0.9,
    });
  });

  it('2 stars → negative', () => {
    expect(normalizeSentiment({ label: '2 stars', score: 0.8 })).toEqual({
      label: 'negative',
      score: 0.8,
    });
  });

  it('3 stars → neutral', () => {
    expect(normalizeSentiment({ label: '3 stars', score: 0.7 })).toEqual({
      label: 'neutral',
      score: 0.7,
    });
  });

  it('4 stars → positive', () => {
    expect(normalizeSentiment({ label: '4 stars', score: 0.85 })).toEqual({
      label: 'positive',
      score: 0.85,
    });
  });

  it('5 stars → positive', () => {
    expect(normalizeSentiment({ label: '5 stars', score: 0.95 })).toEqual({
      label: 'positive',
      score: 0.95,
    });
  });
});

describe('applyKoreanSentimentRules', () => {
  it('강한 부정 어휘가 있으면 negative로 override', () => {
    const result: SentimentResult = { label: 'positive', score: 0.6 };
    const adjusted = applyKoreanSentimentRules('이건 최악이다', result);
    expect(adjusted.label).toBe('negative');
    expect(adjusted.score).toBeGreaterThanOrEqual(0.75);
  });

  it('강한 긍정 어휘가 있으면 positive로 override', () => {
    const result: SentimentResult = { label: 'neutral', score: 0.5 };
    const adjusted = applyKoreanSentimentRules('정말 최고다', result);
    expect(adjusted.label).toBe('positive');
  });

  it('부정어+긍정어 조합 시 negative', () => {
    const result: SentimentResult = { label: 'positive', score: 0.8 };
    const adjusted = applyKoreanSentimentRules('안 좋아요', result);
    expect(adjusted.label).toBe('negative');
  });
});

describe('applySarcasmAdjustment', () => {
  it('[SARCASM] 마커 시 긍정→부정 flip', () => {
    const result: SentimentResult = { label: 'positive', score: 0.9 };
    const adjusted = applySarcasmAdjustment('참 잘났다 [SARCASM]', result);
    expect(adjusted.label).toBe('negative');
  });

  it('[NEGATIVE] 마커 시 부정 강화', () => {
    const result: SentimentResult = { label: 'neutral', score: 0.5 };
    const adjusted = applySarcasmAdjustment('문제가 있다 [NEGATIVE]', result);
    expect(adjusted.label).toBe('negative');
  });

  it('마커 없으면 결과 유지', () => {
    const result: SentimentResult = { label: 'positive', score: 0.8 };
    const adjusted = applySarcasmAdjustment('좋은 소식이다', result);
    expect(adjusted).toEqual(result);
  });
});
