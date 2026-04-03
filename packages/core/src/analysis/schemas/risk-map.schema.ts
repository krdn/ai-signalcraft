import { z } from 'zod';

// 모듈5: 리스크 맵 분석 (DEEP-03)
export const RiskMapSchema = z.object({
  topRisks: z
    .array(
      z.object({
        rank: z.number().catch(0),
        title: z.string().catch(''),
        description: z.string().catch(''),
        impactLevel: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
        spreadProbability: z.number().catch(0).describe('0~1 확산 가능성'),
        currentStatus: z.string().catch(''),
        triggerConditions: z.array(z.string()).catch([]),
      }),
    )
    .catch([])
    .describe('Top 3~5 리스크 (최대 5개)'),
  overallRiskLevel: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
  riskTrend: z.enum(['increasing', 'stable', 'decreasing']).catch('stable'),
});

export type RiskMapResult = z.infer<typeof RiskMapSchema>;
