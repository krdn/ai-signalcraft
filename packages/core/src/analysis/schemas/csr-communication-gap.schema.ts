import { z } from 'zod';

export const CsrCommunicationGapSchema = z.object({
  overallHypocrisyScore: z
    .number()
    .min(0)
    .max(100)
    .catch(0)
    .describe('CSR 위선 점수 — 공약과 실천 간 격차 (0=완전 일치, 100=극도의 위선)'),
  esgDimensionGaps: z
    .array(
      z.object({
        dimension: z.enum(['E', 'S', 'G']).catch('S').describe('ESG 차원'),
        dimensionName: z.string().catch(''),
        claimedPosition: z.string().catch('').describe('기업이 주장하는 입장'),
        perceivedReality: z.string().catch('').describe('여론이 인식하는 현실'),
        gapScore: z.number().min(0).max(100).catch(0).describe('차원별 격차 점수'),
        publicReaction: z
          .enum(['backlash', 'skeptical', 'neutral', 'supportive'])
          .catch('skeptical'),
      }),
    )
    .default([]),
  greenwashingRisk: z
    .enum(['high', 'medium', 'low', 'none'])
    .catch('medium')
    .describe('그린워싱 리스크 수준'),
  credibilityIndex: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('CSR 신뢰도 지수 (100=완전 신뢰)'),
  keyHypocrisyTriggers: z
    .array(
      z.object({
        trigger: z.string().catch(''),
        publicSentiment: z.string().catch(''),
        reputationalImpact: z.enum(['severe', 'moderate', 'minor']).catch('moderate'),
      }),
    )
    .default([]),
  communicationRecommendation: z.string().catch('').describe('CSR 커뮤니케이션 개선 권고'),
  summary: z.string().catch(''),
});

export type CsrCommunicationGapResult = z.infer<typeof CsrCommunicationGapSchema>;
