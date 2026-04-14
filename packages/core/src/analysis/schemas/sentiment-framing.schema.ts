import { z } from 'zod';

// 모듈3: 감정 및 프레임 분석 스키마 (ANLZ-01, ANLZ-02, DEEP-01)
export const SentimentFramingSchema = z.object({
  sentimentRatio: z
    .object({
      positive: z.number().describe('0~1'),
      negative: z.number().describe('0~1'),
      neutral: z.number().describe('0~1'),
    })
    .describe('감정 비율'),
  topKeywords: z
    .array(
      z.object({
        keyword: z.string().catch(''),
        count: z.number().catch(0),
        sentiment: z.enum(['positive', 'negative', 'neutral']).catch('neutral'),
      }),
    )
    .default([])
    .describe('반복 키워드 TOP 20 — 반드시 1개 이상 포함'),
  relatedKeywords: z
    .array(
      z
        .object({
          keyword: z.string().catch(''),
          relatedTo: z.array(z.string().catch('')).catch([]).describe('연관 키워드 목록'),
          coOccurrenceScore: z.number().catch(0).describe('0~1 동시출현 빈도'),
          context: z.string().catch('').describe('연관 맥락 설명'),
        })
        .catch({ keyword: '', relatedTo: [], coOccurrenceScore: 0, context: '' }),
    )
    .default([])
    .describe(
      '연관어 네트워크 (ANLZ-02) — topKeywords에서 함께 등장하는 키워드 쌍을 반드시 추출할 것',
    ),
  positiveFrames: z
    .array(
      z.object({
        frame: z.string().catch(''),
        description: z.string().catch(''),
        strength: z.number().catch(0).describe('1~10'),
      }),
    )
    .default([])
    .describe('긍정 프레임 TOP5 (최대 5개, 없으면 빈 배열)'),
  negativeFrames: z
    .array(
      z.object({
        frame: z.string().catch(''),
        description: z.string().catch(''),
        strength: z.number().catch(0).describe('1~10'),
      }),
    )
    .default([])
    .describe('부정 프레임 TOP5 (최대 5개, 없으면 빈 배열)'),
  frameConflict: z
    .object({
      description: z.string().catch('프레임 충돌 정보 없음'),
      dominantFrame: z.string().catch('미확인'),
      challengingFrame: z.string().catch('미확인'),
    })
    .catch({
      description: '프레임 충돌 정보 없음',
      dominantFrame: '미확인',
      challengingFrame: '미확인',
    })
    .describe('프레임 충돌 구조'),
});

export type SentimentFramingResult = z.infer<typeof SentimentFramingSchema>;
