import { z } from 'zod';

export const QuantitativeDeltaSchema = z.object({
  sentiment: z.object({
    before: z.object({
      positive: z.number(),
      negative: z.number(),
      neutral: z.number(),
    }),
    after: z.object({
      positive: z.number(),
      negative: z.number(),
      neutral: z.number(),
    }),
    delta: z.object({
      positive: z.number(),
      negative: z.number(),
      neutral: z.number(),
    }),
  }),
  mentions: z.object({
    before: z.number(),
    after: z.number(),
    delta: z.number(),
    deltaPercent: z.number(),
  }),
  keywords: z.object({
    appeared: z.array(z.string()),
    disappeared: z.array(z.string()),
    rising: z.array(
      z.object({ keyword: z.string(), beforeCount: z.number(), afterCount: z.number() }),
    ),
    declining: z.array(
      z.object({ keyword: z.string(), beforeCount: z.number(), afterCount: z.number() }),
    ),
  }),
  overallDirection: z.object({
    before: z.string(),
    after: z.string(),
  }),
  collectionStats: z.object({
    newArticles: z.number(),
    newComments: z.number(),
    totalArticles: z.number(),
    totalComments: z.number(),
  }),
});

export type QuantitativeDelta = z.infer<typeof QuantitativeDeltaSchema>;

export const QualitativeInterpretationSchema = z.object({
  summary: z.string().describe('변화 요약 (2~3문장)'),
  keyDrivers: z.array(z.string()).describe('변화의 핵심 동인'),
  riskAlerts: z.array(z.string()).describe('새로 부상한 위험 신호'),
  opportunities: z.array(z.string()).describe('새로 발견된 기회'),
});

export type QualitativeInterpretation = z.infer<typeof QualitativeInterpretationSchema>;
