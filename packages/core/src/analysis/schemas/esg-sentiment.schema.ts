import { z } from 'zod';

// 기업/유통 도메인 Stage 4: ESG 차원별 여론 분석 스키마
export const EsgSentimentSchema = z.object({
  overallEsgSentiment: z
    .enum(['positive', 'negative', 'neutral', 'mixed'])
    .catch('neutral')
    .describe('ESG 전반 여론 방향'),
  dimensions: z
    .object({
      environmental: z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).catch('neutral'),
        score: z.number().min(0).max(100).catch(50).describe('환경(E) 여론 점수'),
        keyIssues: z.array(z.string()).default([]).describe('주요 환경 이슈'),
        positiveFactors: z.array(z.string()).default([]),
        negativeFactors: z.array(z.string()).default([]),
        summary: z.string().catch(''),
      }),
      social: z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).catch('neutral'),
        score: z.number().min(0).max(100).catch(50).describe('사회(S) 여론 점수'),
        keyIssues: z
          .array(z.string())
          .default([])
          .describe('주요 사회 이슈 (노동, 다양성, 지역사회)'),
        positiveFactors: z.array(z.string()).default([]),
        negativeFactors: z.array(z.string()).default([]),
        summary: z.string().catch(''),
      }),
      governance: z.object({
        sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).catch('neutral'),
        score: z.number().min(0).max(100).catch(50).describe('지배구조(G) 여론 점수'),
        keyIssues: z.array(z.string()).default([]).describe('주요 지배구조 이슈 (투명성, 반부패)'),
        positiveFactors: z.array(z.string()).default([]),
        negativeFactors: z.array(z.string()).default([]),
        summary: z.string().catch(''),
      }),
    })
    .catch({
      environmental: {
        sentiment: 'neutral',
        score: 50,
        keyIssues: [],
        positiveFactors: [],
        negativeFactors: [],
        summary: '',
      },
      social: {
        sentiment: 'neutral',
        score: 50,
        keyIssues: [],
        positiveFactors: [],
        negativeFactors: [],
        summary: '',
      },
      governance: {
        sentiment: 'neutral',
        score: 50,
        keyIssues: [],
        positiveFactors: [],
        negativeFactors: [],
        summary: '',
      },
    })
    .describe('ESG 3차원별 분석'),
  esgRisks: z
    .array(
      z.object({
        dimension: z.enum(['E', 'S', 'G']).catch('S'),
        risk: z.string().catch(''),
        severity: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
        stakeholderImpact: z
          .string()
          .catch('')
          .describe('어떤 이해관계자 집단이 가장 민감하게 반응하는가'),
      }),
    )
    .default([])
    .describe('ESG 관련 주요 리스크'),
  esgOpportunities: z
    .array(
      z.object({
        dimension: z.enum(['E', 'S', 'G']).catch('S'),
        opportunity: z.string().catch(''),
        potentialImpact: z.string().catch(''),
      }),
    )
    .default([])
    .describe('ESG 관련 여론 강화 기회'),
  regulatoryRisk: z
    .enum(['high', 'medium', 'low'])
    .catch('low')
    .describe('규제 리스크 수준 (ESG 규제 미준수 가능성)'),
  summary: z.string().catch('').describe('ESG 여론 종합 요약'),
});

export type EsgSentimentResult = z.infer<typeof EsgSentimentSchema>;
