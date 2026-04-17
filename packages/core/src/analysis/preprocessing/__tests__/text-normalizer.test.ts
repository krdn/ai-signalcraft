import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeWithDomain, normalizeAnalysisInput } from '../text-normalizer';
import { getDomainLexicon } from '../lexicon/registry';
import type { AnalysisInput } from '../../types';

describe('normalizeText (정치 도메인)', () => {
  const lexicon = getDomainLexicon('political');

  it('URL을 [URL] 토큰으로 치환한다', () => {
    const { text } = normalizeText('링크 https://example.com 참고', lexicon);
    expect(text).toContain('[URL]');
    expect(text).not.toContain('https://');
  });

  it('HTML 엔티티를 복원한다', () => {
    const { text } = normalizeText('안녕&nbsp;하세요&amp;반갑', lexicon);
    expect(text).toBe('안녕 하세요&반갑');
  });

  it('은어 ㅇㅈ → 인정으로 치환한다', () => {
    const { text } = normalizeText('완전 ㅇㅈ', lexicon);
    expect(text).toContain('인정');
  });

  it('야민정음 댕댕이 → 멍멍이 복원', () => {
    const { text } = normalizeText('댕댕이 귀엽다', lexicon);
    expect(text).toContain('멍멍이');
  });

  it('개체명 별칭을 canonical로 통합한다', () => {
    const { text } = normalizeText('한 장관이 발언했다', lexicon);
    expect(text).toContain('한동훈');
  });

  it('반어 표현에 [SARCASM] 마커를 붙인다', () => {
    const { text } = normalizeText('참 잘하시네요', lexicon);
    expect(text).toContain('[SARCASM]');
  });

  it('연속 느낌표를 축소한다', () => {
    const { text } = normalizeText('진짜!!!!!', lexicon);
    expect(text).toBe('진짜!');
  });

  it('ㅋ 반복은 ㅋㅋ로 축소한다', () => {
    const { text } = normalizeText('ㅋㅋㅋㅋㅋㅋ 웃겨', lexicon);
    expect(text).toContain('ㅋㅋ');
    expect(text).not.toContain('ㅋㅋㅋ');
  });

  it('자모분리 우회 표현을 복원한다', () => {
    const { text } = normalizeText('문ㅈㅇ 관련 논란', lexicon);
    expect(text).toContain('문재인');
  });

  it('빈 문자열을 안전하게 처리한다', () => {
    const { text } = normalizeText('', lexicon);
    expect(text).toBe('');
  });

  it('null/undefined를 안전하게 처리한다', () => {
    expect(normalizeText(null, lexicon).text).toBe('');
    expect(normalizeText(undefined, lexicon).text).toBe('');
  });

  it('매칭 횟수를 카운트한다', () => {
    const { matchCount } = normalizeText('ㅇㅈ ㄹㅇ 참 잘났다', lexicon);
    expect(matchCount).toBeGreaterThan(0);
  });
});

describe('normalizeText (팬덤 도메인)', () => {
  const lexicon = getDomainLexicon('fandom');

  it('덕질 → 팬활동으로 치환한다', () => {
    const { text } = normalizeText('덕질 그만둘거야', lexicon);
    expect(text).toContain('팬활동');
  });
});

describe('normalizeText (금융 도메인)', () => {
  const lexicon = getDomainLexicon('finance');

  it('존버 → 장기 보유로 치환한다', () => {
    const { text } = normalizeText('존버 해야지', lexicon);
    expect(text).toContain('장기 보유');
  });

  it('떡락 → 급락, 떡상 → 급등', () => {
    expect(normalizeText('떡락', lexicon).text).toBe('급락');
    expect(normalizeText('떡상', lexicon).text).toBe('급등');
  });
});

describe('normalizeWithDomain', () => {
  it('정치 도메인을 적용한다', () => {
    const out = normalizeWithDomain('이 대표 ㄹㅇ 참 잘하시네요', 'political');
    expect(out).toContain('이재명');
    expect(out).toContain('레알');
    expect(out).toContain('[SARCASM]');
  });

  it('도메인 미지정 시 공통 규칙만 적용한다', () => {
    const out = normalizeWithDomain('안녕   하세요!!!!!', undefined);
    expect(out).toBe('안녕 하세요!');
  });
});

describe('normalizeAnalysisInput', () => {
  const baseInput: AnalysisInput = {
    jobId: 1,
    keyword: 'test',
    articles: [
      {
        title: '한 장관 발언!!!!',
        content: '완전 ㅇㅈ https://example.com',
        publisher: '뉴스',
        publishedAt: new Date(),
        source: 'naver-news',
      },
    ],
    videos: [],
    comments: [
      {
        content: '참 잘났다 ㄹㅇ',
        source: 'youtube',
        author: 'user',
        likeCount: 10,
        dislikeCount: 0,
        publishedAt: new Date(),
      },
    ],
    dateRange: { start: new Date(), end: new Date() },
    domain: 'political',
  };

  it('정치 도메인 정규화를 전체 input에 적용한다', () => {
    const { input, stats } = normalizeAnalysisInput(baseInput, 'political');
    expect(input.articles[0].title).toContain('한동훈');
    expect(input.articles[0].title).not.toContain('!!!!');
    expect(input.articles[0].content).toContain('[URL]');
    expect(input.articles[0].content).toContain('인정');
    expect(input.comments[0].content).toContain('[SARCASM]');
    expect(input.comments[0].content).toContain('레알');
    expect(stats.domain).toBe('political');
    expect(stats.articlesProcessed).toBe(1);
    expect(stats.commentsProcessed).toBe(1);
    expect(stats.totalMatches).toBeGreaterThan(0);
  });

  it('도메인 미지정 시 공통 규칙만 적용한다', () => {
    const { input, stats } = normalizeAnalysisInput(baseInput, undefined);
    expect(input.articles[0].title).not.toContain('!!!!');
    // 공통만이므로 개체명은 변환 안 됨
    expect(input.articles[0].title).toContain('한 장관');
    expect(stats.domain).toBe('default');
  });

  it('처리 시간을 측정한다', () => {
    const { stats } = normalizeAnalysisInput(baseInput, 'political');
    expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});

describe('성능 — 8000건 규모 시뮬레이션', () => {
  it('1000건 정규화가 1초 내 완료된다', () => {
    const input: AnalysisInput = {
      jobId: 1,
      keyword: 'test',
      articles: Array.from({ length: 100 }, (_, i) => ({
        title: `한 장관 발언 ${i}!!!!`,
        content: '완전 ㅇㅈ ㄹㅇ https://example.com 참 잘났다',
        publisher: '뉴스',
        publishedAt: new Date(),
        source: 'naver-news',
      })),
      videos: [],
      comments: Array.from({ length: 900 }, (_, i) => ({
        content: `참 잘났다 ㄹㅇ 댕댕이 ${i} ㅋㅋㅋㅋㅋ`,
        source: 'youtube',
        author: `user${i}`,
        likeCount: 10,
        dislikeCount: 0,
        publishedAt: new Date(),
      })),
      dateRange: { start: new Date(), end: new Date() },
      domain: 'political',
    };

    const { stats } = normalizeAnalysisInput(input, 'political');
    expect(stats.elapsedMs).toBeLessThan(1000);
  });
});
