import { z } from 'zod';

// 모듈5: 리스크 맵 분석 (DEEP-03)
export const RiskMapSchema = z.object({
  topRisks: z.array(z.object({
    rank: z.number(),
    title: z.string(),
    description: z.string(),
    impactLevel: z.enum(['critical', 'high', 'medium', 'low']),
    spreadProbability: z.number().describe('0~1 확산 가능성'),
    currentStatus: z.string(),
    triggerConditions: z.array(z.string()),
  })).describe('Top 3~5 리스크 (최대 5개)'),
  overallRiskLevel: z.enum(['critical', 'high', 'medium', 'low']),
  riskTrend: z.enum(['increasing', 'stable', 'decreasing']),
});

export type RiskMapResult = z.infer<typeof RiskMapSchema>;
