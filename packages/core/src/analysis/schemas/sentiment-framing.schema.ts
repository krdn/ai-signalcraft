import { z } from 'zod';

// 모듈3: 감정 및 프레임 분석 스키마 (ANLZ-01, ANLZ-02, DEEP-01)
export const SentimentFramingSchema = z.object({
  sentimentRatio: z.object({
    positive: z.number().describe('0~1'),
    negative: z.number().describe('0~1'),
    neutral: z.number().describe('0~1'),
  }).describe('감정 비율'),
  topKeywords: z.array(z.object({
    keyword: z.string(),
    count: z.number(),
    sentiment: z.enum(['positive', 'negative', 'neutral']),
  })).describe('반복 키워드 TOP 20'),
  relatedKeywords: z.array(z.object({
    keyword: z.string(),
    relatedTo: z.array(z.string()).describe('연관 키워드 목록'),
    coOccurrenceScore: z.number().describe('0~1 동시출현 빈도'),
    context: z.string().describe('연관 맥락 설명'),
  })).describe('연관어 네트워크 (ANLZ-02)'),
  positiveFrames: z.array(z.object({
    frame: z.string(),
    description: z.string(),
    strength: z.number().describe('1~10'),
  })).max(5).describe('긍정 프레임 TOP5'),
  negativeFrames: z.array(z.object({
    frame: z.string(),
    description: z.string(),
    strength: z.number().describe('1~10'),
  })).max(5).describe('부정 프레임 TOP5'),
  frameConflict: z.object({
    description: z.string(),
    dominantFrame: z.string(),
    challengingFrame: z.string(),
  }).describe('프레임 충돌 구조'),
});

export type SentimentFramingResult = z.infer<typeof SentimentFramingSchema>;
