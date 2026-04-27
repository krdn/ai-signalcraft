import { describe, it, expect } from 'vitest';
import { ngramSet, jaccard } from '../../utils/ngram';

describe('ngram utils', () => {
  describe('ngramSet', () => {
    it('짧은 텍스트는 빈 집합', () => {
      expect(ngramSet('abc', 5).size).toBe(0);
    });
    it('5글자 텍스트는 1개 ngram', () => {
      expect(ngramSet('abcde', 5).size).toBe(1);
    });
    it('정확한 ngram 수 (길이 - n + 1)', () => {
      expect(ngramSet('abcdefgh', 5).size).toBe(4);
    });
    it('공백 정규화', () => {
      expect(ngramSet('a  b  c', 3)).toEqual(ngramSet('a b c', 3));
    });
    it('한국어 ngram 수', () => {
      // 가나다라마바사 — 7글자, n=5 → 3개
      expect(ngramSet('가나다라마바사', 5).size).toBe(3);
    });
  });

  describe('jaccard', () => {
    it('동일 집합은 1', () => {
      const s = new Set(['a', 'b', 'c']);
      expect(jaccard(s, s)).toBe(1);
    });
    it('교집합 없음은 0', () => {
      expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
    });
    it('절반 겹침은 1/3 (교집합 1, 합집합 3)', () => {
      expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 5);
    });
    it('빈 집합 두 개는 0', () => {
      expect(jaccard(new Set(), new Set())).toBe(0);
    });
    it('비대칭 크기 (|A|=3, |B|=1) — 교집합 1, 합집합 3', () => {
      expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b']))).toBeCloseTo(1 / 3, 5);
    });
    it('한쪽만 빈 집합은 0', () => {
      expect(jaccard(new Set(['a']), new Set())).toBe(0);
    });
  });
});
