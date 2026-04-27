import { describe, it, expect } from 'vitest';
import { median, mad, iqr, klDivergence } from '../../utils/stats';

describe('stats utils', () => {
  describe('median', () => {
    it('홀수 길이 정렬되지 않은 배열', () => {
      expect(median([3, 1, 2])).toBe(2);
    });
    it('짝수 길이', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
    it('빈 배열은 NaN', () => {
      expect(median([])).toBeNaN();
    });
  });

  describe('mad (median absolute deviation)', () => {
    it('동일 값들은 MAD=0', () => {
      expect(mad([5, 5, 5, 5])).toBe(0);
    });
    it('대칭 분포', () => {
      // median=3, |x-3|=[2,1,0,1,2] → median=1
      expect(mad([1, 2, 3, 4, 5])).toBe(1);
    });
  });

  describe('iqr', () => {
    it('Q1=2, Q3=4 → IQR=2', () => {
      expect(iqr([1, 2, 3, 4, 5])).toBeCloseTo(2, 5);
    });
  });

  describe('klDivergence', () => {
    it('동일 분포는 0', () => {
      const p = [0.25, 0.25, 0.25, 0.25];
      expect(klDivergence(p, p)).toBeCloseTo(0, 5);
    });
    it('서로 다른 분포는 양수', () => {
      const p = [0.5, 0.5, 0, 0];
      const q = [0.25, 0.25, 0.25, 0.25];
      expect(klDivergence(p, q)).toBeGreaterThan(0);
    });
  });
});
