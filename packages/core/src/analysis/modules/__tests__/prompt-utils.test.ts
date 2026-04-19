/**
 * prompt-utils.ts 단위 테스트
 * DB 연결 없이 순수 함수만 테스트
 */
import { describe, it, expect } from 'vitest';
import type { AnalysisInput } from '../../types';
import { formatDateRange, formatInputData, buildModuleSystemPrompt } from '../prompt-utils';

// ─── 테스트 픽스처 ──────────────────────────────────────────────────

function createMockInput(overrides?: Partial<AnalysisInput>): AnalysisInput {
  return {
    jobId: 1,
    keyword: '테스트 키워드',
    articles: [
      {
        title: '테스트 기사 제목',
        content: '기사 본문 내용입니다.',
        publisher: '테스트 언론사',
        publishedAt: new Date('2024-01-15'),
        source: 'naver',
      },
    ],
    videos: [
      {
        title: '테스트 영상',
        description: '영상 설명입니다.',
        content: '영상 설명입니다.',
        channelTitle: '테스트 채널',
        viewCount: 1000,
        likeCount: 50,
        publishedAt: new Date('2024-01-14'),
      },
    ],
    comments: [
      {
        content: '테스트 댓글입니다.',
        source: 'youtube',
        author: '작성자',
        likeCount: 10,
        dislikeCount: 0,
        publishedAt: new Date('2024-01-15'),
      },
    ],
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
    ...overrides,
  };
}

// ─── formatDateRange 테스트 ──────────────────────────────────────────

describe('formatDateRange', () => {
  it('Date 객체를 YYYY-MM-DD 형식으로 포맷한다', () => {
    const data = createMockInput({
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    });
    const result = formatDateRange(data);
    expect(result).toBe('분석 기간: 2024-01-01 ~ 2024-01-31');
  });

  it('문자열 형태의 날짜도 처리한다 (Drizzle ORM 반환값 대응)', () => {
    // Drizzle이 timestamp를 문자열로 반환하는 경우 대응
    const data = createMockInput({
      dateRange: {
        start: '2024-03-01' as unknown as Date,
        end: '2024-03-31' as unknown as Date,
      },
    });
    const result = formatDateRange(data);
    expect(result).toBe('분석 기간: 2024-03-01 ~ 2024-03-31');
  });

  it('ISO 문자열 형태의 날짜도 처리한다', () => {
    const data = createMockInput({
      dateRange: {
        start: '2024-06-01T00:00:00.000Z' as unknown as Date,
        end: '2024-06-30T23:59:59.000Z' as unknown as Date,
      },
    });
    const result = formatDateRange(data);
    expect(result).toMatch(/^분석 기간: 2024-06-\d{2} ~ 2024-06-\d{2}$/);
  });

  it('반환값은 "분석 기간:" 접두사로 시작한다', () => {
    const data = createMockInput();
    expect(formatDateRange(data)).toMatch(/^분석 기간:/);
  });
});

// ─── formatInputData 테스트 ─────────────────────────────────────────

describe('formatInputData', () => {
  it('500자 이하 본문은 그대로 반환한다', () => {
    const shortContent = 'A'.repeat(500);
    const data = createMockInput({
      articles: [
        {
          title: '제목',
          content: shortContent,
          publisher: '언론사',
          publishedAt: new Date('2024-01-15'),
          source: 'naver',
        },
      ],
    });
    const { articles } = formatInputData(data);
    expect(articles[0].content).toBe(shortContent);
    expect(articles[0].content).not.toContain('...');
  });

  it('501자 초과 본문은 500자에서 잘리고 ... 이 추가된다', () => {
    const longContent = 'B'.repeat(501);
    const data = createMockInput({
      articles: [
        {
          title: '제목',
          content: longContent,
          publisher: '언론사',
          publishedAt: new Date('2024-01-15'),
          source: 'naver',
        },
      ],
    });
    const { articles } = formatInputData(data);
    expect(articles[0].content).toBe('B'.repeat(500) + '...');
    expect(articles[0].content.length).toBe(503);
  });

  it('null content는 "(본문 없음)"으로 대체된다', () => {
    const data = createMockInput({
      articles: [
        {
          title: '제목',
          content: null,
          publisher: '언론사',
          publishedAt: new Date('2024-01-15'),
          source: 'naver',
        },
      ],
    });
    const { articles } = formatInputData(data);
    expect(articles[0].content).toBe('(본문 없음)');
  });

  it('null publisher는 "출처 미상"으로 대체된다', () => {
    const data = createMockInput({
      articles: [
        {
          title: '제목',
          content: '본문',
          publisher: null,
          publishedAt: new Date('2024-01-15'),
          source: 'naver',
        },
      ],
    });
    const { articles } = formatInputData(data);
    expect(articles[0].publisher).toBe('출처 미상');
  });

  it('null channelTitle은 "채널 미상"으로 대체된다', () => {
    const data = createMockInput({
      videos: [
        {
          title: '영상',
          description: null,
          content: null,
          channelTitle: null,
          viewCount: 0,
          likeCount: 0,
          publishedAt: null,
        },
      ],
    });
    const { videos } = formatInputData(data);
    expect(videos[0].channel).toBe('채널 미상');
  });

  it('null author는 "익명"으로 대체된다', () => {
    const data = createMockInput({
      comments: [
        {
          content: '댓글',
          source: 'youtube',
          author: null,
          likeCount: 0,
          dislikeCount: 0,
          publishedAt: null,
        },
      ],
    });
    const { comments } = formatInputData(data);
    expect(comments[0].author).toBe('익명');
  });

  it('null publishedAt은 "날짜 미상"으로 변환된다', () => {
    const data = createMockInput({
      articles: [
        {
          title: '제목',
          content: '본문',
          publisher: '언론사',
          publishedAt: null,
          source: 'naver',
        },
      ],
    });
    const { articles } = formatInputData(data);
    expect(articles[0].publishedAt).toBe('날짜 미상');
  });

  it('null viewCount와 likeCount는 0으로 대체된다', () => {
    const data = createMockInput({
      videos: [
        {
          title: '영상',
          description: null,
          content: null,
          channelTitle: '채널',
          viewCount: null,
          likeCount: null,
          publishedAt: null,
        },
      ],
    });
    const { videos } = formatInputData(data);
    expect(videos[0].viewCount).toBe(0);
    expect(videos[0].likeCount).toBe(0);
  });

  it('dateRange를 문자열 형식으로 반환한다', () => {
    const data = createMockInput({
      dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    });
    const { dateRange } = formatInputData(data);
    expect(dateRange).toContain('2024-01-01');
    expect(dateRange).toContain('2024-01-31');
    expect(dateRange).toContain('~');
  });

  it('빈 배열도 정상 처리된다', () => {
    const data = createMockInput({ articles: [], videos: [], comments: [] });
    const result = formatInputData(data);
    expect(result.articles).toHaveLength(0);
    expect(result.videos).toHaveLength(0);
    expect(result.comments).toHaveLength(0);
  });
});

// ─── buildModuleSystemPrompt 테스트 ─────────────────────────────────

describe('buildModuleSystemPrompt', () => {
  it('political 도메인의 macro-view는 오버라이드가 있으므로 문자열을 반환한다', () => {
    const result = buildModuleSystemPrompt('macro-view', 'political');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(result!.length).toBeGreaterThan(0);
  });

  it('political 도메인의 segmentation도 오버라이드가 있으므로 문자열을 반환한다', () => {
    const result = buildModuleSystemPrompt('segmentation', 'political');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
  });

  it('오버라이드가 없는 모듈명은 null을 반환한다', () => {
    // 존재하지 않는 모듈명
    const result = buildModuleSystemPrompt('non-existent-module', 'political');
    expect(result).toBeNull();
  });

  it('domain 파라미터 생략 시 political 도메인을 기본값으로 사용한다', () => {
    const withDefault = buildModuleSystemPrompt('macro-view');
    const withExplicit = buildModuleSystemPrompt('macro-view', 'political');
    expect(withDefault).toBe(withExplicit);
  });

  it('fandom 도메인의 macro-view도 오버라이드가 있으므로 문자열을 반환한다', () => {
    const result = buildModuleSystemPrompt('macro-view', 'fandom');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    // 팬덤 도메인 특화 내용이 포함되어야 함
    expect(result).toContain('팬덤');
  });

  it('fandom 도메인의 macro-view 프롬프트는 political 도메인과 다르다', () => {
    const politicalResult = buildModuleSystemPrompt('macro-view', 'political');
    const fandomResult = buildModuleSystemPrompt('macro-view', 'fandom');
    expect(fandomResult).not.toBe(politicalResult);
  });
});
