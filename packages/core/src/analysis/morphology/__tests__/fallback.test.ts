import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeMorphemes, extractNouns, stripJosa } from '../index';

// 각 테스트에서 fallback 강제 (환경에 mecab이 없더라도 deterministic)
beforeEach(() => {
  process.env.MORPHOLOGY_ENGINE = 'fallback';
});

describe('morphology fallback adapter', () => {
  it('공백 기준 어절 분리 + 조사 제거', async () => {
    const result = await analyzeMorphemes('한동훈이 발언했다');
    const words = result.map((m) => m.word);
    expect(words).toContain('한동훈');
    expect(words).toContain('이');
  });

  it('extractNouns는 조사를 제외한 명사만 반환', async () => {
    const nouns = await extractNouns('한동훈이 오늘 발언했다');
    expect(nouns).toContain('한동훈');
    expect(nouns).not.toContain('이');
  });

  it('stripJosa는 조사를 제거한 텍스트 반환', async () => {
    const result = await stripJosa('한동훈이 오늘 회의에 참석했다');
    expect(result).not.toContain('이 ');
    expect(result).not.toContain('에 ');
    expect(result).toContain('한동훈');
    expect(result).toContain('오늘');
  });

  it('조사와 혼동되지 않는 어절은 그대로 유지', async () => {
    // fallback은 끝자리 패턴 매칭이라 "회의"의 "의"를 조사로 오인할 수 있음.
    // "오늘"은 조사 패턴 아니므로 그대로 유지되어야 함.
    const result = await analyzeMorphemes('오늘 날씨');
    const words = result.map((m) => m.word);
    expect(words).toContain('오늘');
    // 전체 반환 배열에 원본 형태가 보존되어야 함
    expect(words.length).toBeGreaterThanOrEqual(2);
  });

  it('짧은 단어(2자 미만)는 extractNouns에서 제외', async () => {
    const nouns = await extractNouns('가 나 다 한동훈');
    expect(nouns).toContain('한동훈');
    // 1자 단어는 포함되지 않음
    expect(nouns.every((n) => n.length >= 2)).toBe(true);
  });
});
