import { z } from 'zod';

// 모듈1: 전체 여론 구조 분석 스키마 (ANLZ-01, ANLZ-03)
export const MacroViewSchema = z.object({
  overallDirection: z.enum(['positive', 'negative', 'mixed']).describe('전체 여론 방향성'),
  summary: z.string().describe('핵심 흐름 요약 3~5줄'),
  timeline: z
    .array(
      z.object({
        date: z.string(),
        event: z.string(),
        impact: z.enum(['positive', 'negative', 'neutral']),
        description: z.string(),
      }),
    )
    .describe('주요 이벤트 타임라인'),
  inflectionPoints: z
    .array(
      z.object({
        date: z.string(),
        description: z.string(),
        beforeSentiment: z.enum(['positive', 'negative', 'neutral']),
        afterSentiment: z.enum(['positive', 'negative', 'neutral']),
      }),
    )
    .describe('여론 변곡점'),
  dailyMentionTrend: z
    .array(
      z.object({
        date: z.string(),
        count: z.number(),
        sentimentRatio: z.object({
          positive: z.number(),
          negative: z.number(),
          neutral: z.number(),
        }),
      }),
    )
    .describe('일별 언급량 및 감성 추이'),
});

export type MacroViewResult = z.infer<typeof MacroViewSchema>;
