import { describe, it, expect } from 'vitest';
import { median, mad, iqr, klDivergence, zScore, zScoreToScore, clamp } from '../../utils/stats';

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
    it('길이 불일치는 throw', () => {
      expect(() => klDivergence([0.5, 0.5], [0.25, 0.25, 0.25, 0.25])).toThrow();
    });
  });

  describe('zScore', () => {
    it('정상 계산', () => {
      expect(zScore(5, 3, 2)).toBe(1);
    });
    it('scale=0이면 0 반환 (zero-variance sentinel)', () => {
      expect(zScore(99, 0, 0)).toBe(0);
    });
  });

  describe('zScoreToScore', () => {
    it('z=0은 낮은 점수 (~7.6)', () => {
      expect(zScoreToScore(0)).toBeCloseTo(7.59, 1);
    });
    it('z=2.5는 중간점 50', () => {
      expect(zScoreToScore(2.5)).toBeCloseTo(50, 1);
    });
    it('z=4는 약 82', () => {
      expect(zScoreToScore(4)).toBeCloseTo(81.76, 1);
    });
    it('음수 z도 절댓값 처리 (단방향)', () => {
      expect(zScoreToScore(-4)).toBeCloseTo(zScoreToScore(4), 5);
    });
  });

  describe('clamp', () => {
    it('범위 내 값은 그대로', () => {
      expect(clamp(3, 0, 10)).toBe(3);
    });
    it('하한 클램프', () => {
      expect(clamp(-5, 0, 100)).toBe(0);
    });
    it('상한 클램프', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });
  });
});
