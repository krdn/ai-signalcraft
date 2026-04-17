import { describe, it, expect } from 'vitest';
import { deduplicateArticlesLSH } from '../lsh';
import type { AnalysisInput } from '../../types';

type Article = AnalysisInput['articles'][number];

function makeArticle(title: string, content: string | null = null): Article {
  return {
    title,
    content,
    publisher: 'test',
    publishedAt: new Date(),
    source: 'naver-news',
  };
}

describe('deduplicateArticlesLSH', () => {
  it('거의 동일한 본문은 중복으로 판단 (긴 텍스트)', () => {
    const sharedContent =
      '한동훈 장관이 어제 열린 국정감사에서 현재 경제 상황에 대한 정부의 대응 방안에 대해 상세히 발언했다. ' +
      '이에 대해 야당은 즉각 반발하며 대안을 제시했고 여당은 방어에 나섰다. ' +
      '전문가들은 이번 발언이 향후 정책 방향에 큰 영향을 미칠 것으로 전망하고 있다.';

    const articles = [
      makeArticle('한동훈 장관 발언 논란', sharedContent),
      makeArticle('한동훈 장관 발언 논란 (속보)', sharedContent + ' 추가 속보.'),
      makeArticle(
        '오늘의 날씨',
        '오늘 경기 남부 지역에 많은 비가 내렸습니다. 강수량은 50mm에 달했습니다. 기상청은 내일까지 비가 계속될 것으로 예보했습니다.',
      ),
    ];

    const result = deduplicateArticlesLSH(articles, { threshold: 0.7 });
    // 날씨 기사는 별개로 유지되어야 함
    expect(result.some((a) => a.title.includes('날씨'))).toBe(true);
    // 중복 발언 기사는 하나로 줄어야 함
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('완전히 다른 기사는 모두 유지', () => {
    const articles = [
      makeArticle(
        '정치 뉴스 A',
        '정치 관련 긴 내용입니다 민주당 국민의힘 대화가 필요합니다 오늘 국회에서 회담이 있었습니다',
      ),
      makeArticle(
        '경제 뉴스 B',
        '주식 시장이 오늘 급등했습니다 코스피가 3%나 올랐습니다 반도체 업종이 상승을 이끌었습니다',
      ),
      makeArticle(
        '스포츠 뉴스 C',
        '야구 경기에서 극적인 역전승이 나왔습니다 9회말 만루홈런 한국 시리즈 진출이 확정되었습니다',
      ),
    ];

    const result = deduplicateArticlesLSH(articles, { threshold: 0.85 });
    expect(result.length).toBe(3);
  });

  it('1건 이하는 그대로 반환', () => {
    expect(deduplicateArticlesLSH([], {}).length).toBe(0);
    expect(deduplicateArticlesLSH([makeArticle('단일')], {}).length).toBe(1);
  });

  it('동일 본문이면 1개로 수렴 (본문 긴 쪽 유지)', () => {
    const baseContent =
      '이것은 여러 시간 동안 작성된 긴 본문입니다 다양한 내용이 포함되어 있고 여러 인용구와 전문가 의견이 있습니다 ';
    const shortContent = baseContent;
    const longContent = baseContent + '추가 분석 내용 더 많은 전문가 의견 그리고 관련 통계까지';

    const articles = [
      makeArticle('동일 제목 기사', shortContent),
      makeArticle('동일 제목 기사', longContent),
    ];

    const result = deduplicateArticlesLSH(articles, { threshold: 0.5 });
    expect(result.length).toBe(1);
    expect((result[0].content ?? '').length).toBeGreaterThan(shortContent.length);
  });

  it('대규모 처리 성능 — 500건이 1초 내 완료', () => {
    const articles: Article[] = Array.from({ length: 500 }, (_, i) => {
      const base = i % 50;
      return makeArticle(
        `기사 주제 ${base}`,
        `본문 내용입니다 기사 ${base} 버전 ${Math.floor(i / 50)} 관련 정보입니다 오늘 발생한 사건에 대한 자세한 분석을 제공합니다`,
      );
    });

    const start = Date.now();
    const result = deduplicateArticlesLSH(articles, { threshold: 0.7 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});
