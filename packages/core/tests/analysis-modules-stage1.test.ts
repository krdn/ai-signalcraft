import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { macroViewModule } from '../src/analysis/modules/macro-view';
import { segmentationModule } from '../src/analysis/modules/segmentation';
import { sentimentFramingModule } from '../src/analysis/modules/sentiment-framing';
import { messageImpactModule } from '../src/analysis/modules/message-impact';
import {
  MacroViewSchema,
  SegmentationSchema,
  SentimentFramingSchema,
  MessageImpactSchema,
} from '../src/analysis/schemas';
import type { AnalysisInput } from '../src/analysis/types';

// 테스트용 mock 입력 데이터
const mockInput: AnalysisInput = {
  jobId: 1,
  keyword: '홍길동',
  articles: [
    {
      title: '홍길동 관련 뉴스 기사',
      content: '홍길동에 대한 여론이 변화하고 있다.',
      publisher: '한국일보',
      publishedAt: new Date('2026-03-20'),
      source: 'naver-news',
    },
  ],
  videos: [
    {
      title: '홍길동 분석 영상',
      description: '홍길동에 대한 분석',
      channelTitle: '뉴스채널',
      viewCount: 10000,
      likeCount: 500,
      publishedAt: new Date('2026-03-21'),
    },
  ],
  comments: [
    {
      content: '홍길동 잘한다',
      source: 'naver-news',
      author: '시민A',
      likeCount: 10,
      dislikeCount: 0,
      publishedAt: new Date('2026-03-21'),
    },
    {
      content: '홍길동 별로다',
      source: 'youtube',
      author: '시민B',
      likeCount: 5,
      dislikeCount: 3,
      publishedAt: new Date('2026-03-22'),
    },
  ],
  dateRange: {
    start: new Date('2026-03-18'),
    end: new Date('2026-03-24'),
  },
};

describe('Stage 1 분석 모듈', () => {
  describe('macroViewModule', () => {
    it('name이 macro-view이다', () => {
      expect(macroViewModule.name).toBe('macro-view');
    });

    it('provider가 openai이다', () => {
      expect(macroViewModule.provider).toBe('gemini');
    });

    it('schema가 z.ZodType이다', () => {
      expect(macroViewModule.schema).toBeInstanceOf(z.ZodType);
    });

    it('buildPrompt(mockInput)이 keyword를 포함한 문자열을 반환한다', () => {
      const prompt = macroViewModule.buildPrompt(mockInput);
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('홍길동');
    });

    it('buildSystemPrompt()가 비어있지 않은 문자열을 반환한다', () => {
      const systemPrompt = macroViewModule.buildSystemPrompt();
      expect(typeof systemPrompt).toBe('string');
      expect(systemPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('segmentationModule', () => {
    it('name이 segmentation이다', () => {
      expect(segmentationModule.name).toBe('segmentation');
    });

    it('provider가 openai이다', () => {
      expect(segmentationModule.provider).toBe('gemini');
    });

    it('buildPrompt(mockInput)이 keyword를 포함한 문자열을 반환한다', () => {
      const prompt = segmentationModule.buildPrompt(mockInput);
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('홍길동');
    });

    it('buildSystemPrompt()가 비어있지 않은 문자열을 반환한다', () => {
      const systemPrompt = segmentationModule.buildSystemPrompt();
      expect(typeof systemPrompt).toBe('string');
      expect(systemPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('sentimentFramingModule', () => {
    it('name이 sentiment-framing이다', () => {
      expect(sentimentFramingModule.name).toBe('sentiment-framing');
    });

    it('provider가 openai이다', () => {
      expect(sentimentFramingModule.provider).toBe('gemini');
    });

    it('buildPrompt(mockInput)이 keyword를 포함한 문자열을 반환한다', () => {
      const prompt = sentimentFramingModule.buildPrompt(mockInput);
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('홍길동');
    });

    it('buildSystemPrompt()가 비어있지 않은 문자열을 반환한다', () => {
      const systemPrompt = sentimentFramingModule.buildSystemPrompt();
      expect(typeof systemPrompt).toBe('string');
      expect(systemPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('messageImpactModule', () => {
    it('name이 message-impact이다', () => {
      expect(messageImpactModule.name).toBe('message-impact');
    });

    it('provider가 openai이다', () => {
      expect(messageImpactModule.provider).toBe('gemini');
    });

    it('buildPrompt(mockInput)이 keyword를 포함한 문자열을 반환한다', () => {
      const prompt = messageImpactModule.buildPrompt(mockInput);
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('홍길동');
    });

    it('buildSystemPrompt()가 비어있지 않은 문자열을 반환한다', () => {
      const systemPrompt = messageImpactModule.buildSystemPrompt();
      expect(typeof systemPrompt).toBe('string');
      expect(systemPrompt.length).toBeGreaterThan(0);
    });
  });
});

describe('Stage 1 Zod 스키마', () => {
  it('MacroViewSchema.parse()가 유효한 데이터에 성공한다', () => {
    const valid = {
      overallDirection: 'positive' as const,
      summary: '전반적으로 긍정적인 여론 흐름',
      timeline: [
        {
          date: '2026-03-20',
          event: '긍정적 기사 게재',
          impact: 'positive' as const,
          description: '주요 언론사에서 긍정적 보도',
        },
      ],
      inflectionPoints: [
        {
          date: '2026-03-21',
          description: '여론 변곡점 발생',
          beforeSentiment: 'neutral' as const,
          afterSentiment: 'positive' as const,
        },
      ],
      dailyMentionTrend: [
        {
          date: '2026-03-20',
          count: 150,
          sentimentRatio: { positive: 0.6, negative: 0.2, neutral: 0.2 },
        },
      ],
    };
    expect(() => MacroViewSchema.parse(valid)).not.toThrow();
  });

  it('SegmentationSchema.parse()가 유효한 데이터에 성공한다', () => {
    const valid = {
      platformSegments: [
        {
          platform: 'naver-news',
          sentiment: 'positive' as const,
          keyTopics: ['정책', '경제'],
          volume: 120,
          characteristics: '뉴스 댓글 중심',
        },
      ],
      audienceGroups: [
        {
          groupName: '지지층',
          type: 'core' as const,
          characteristics: '강력한 지지 기반',
          sentiment: 'positive' as const,
          influence: 'high' as const,
        },
      ],
      highInfluenceGroup: {
        name: '지지층',
        reason: '온라인 여론 주도',
      },
    };
    expect(() => SegmentationSchema.parse(valid)).not.toThrow();
  });

  it('SentimentFramingSchema.parse()가 유효한 데이터에 성공한다', () => {
    const valid = {
      sentimentRatio: { positive: 0.5, negative: 0.3, neutral: 0.2 },
      topKeywords: [{ keyword: '정책', count: 50, sentiment: 'positive' as const }],
      relatedKeywords: [
        {
          keyword: '정책',
          relatedTo: ['경제', '일자리'],
          coOccurrenceScore: 0.8,
          context: '경제 정책 관련 논의',
        },
      ],
      positiveFrames: [{ frame: '개혁', description: '개혁 리더', strength: 8 }],
      negativeFrames: [{ frame: '독단', description: '독단적 의사결정', strength: 6 }],
      frameConflict: {
        description: '개혁 vs 독단 프레임 충돌',
        dominantFrame: '개혁',
        challengingFrame: '독단',
      },
    };
    expect(() => SentimentFramingSchema.parse(valid)).not.toThrow();
  });

  it('MessageImpactSchema.parse()가 유효한 데이터에 성공한다', () => {
    const valid = {
      successMessages: [
        {
          content: '성과 발표 연설',
          source: 'naver-news',
          impactScore: 9,
          reason: '구체적 수치 제시',
          spreadType: '뉴스 확산',
        },
      ],
      failureMessages: [
        {
          content: '논란 발언',
          source: 'youtube',
          negativeScore: 7,
          reason: '맥락 무시 발언',
          damageType: 'SNS 확산',
        },
      ],
      highSpreadContentTypes: [
        {
          type: '짧은 클립',
          description: '15초 이내 요약 클립',
          exampleCount: 25,
        },
      ],
    };
    expect(() => MessageImpactSchema.parse(valid)).not.toThrow();
  });
});
