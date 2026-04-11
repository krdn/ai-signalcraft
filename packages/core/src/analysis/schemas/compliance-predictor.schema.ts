import { z } from 'zod';

// 헬스케어 도메인 Stage 4: 의료 순응도 예측 스키마 (Health Belief Model 기반)
export const CompliancePredictorSchema = z.object({
  overallComplianceProbability: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('전체 의료 순응 예측 확률 (%)'),
  hbmFactors: z
    .object({
      perceivedSusceptibility: z
        .object({
          level: z.enum(['high', 'medium', 'low']).catch('medium'),
          evidence: z.string().catch('').describe('여론 데이터에서의 근거'),
        })
        .catch({ level: 'medium', evidence: '' })
        .describe('인지된 취약성 (나도 걸릴 수 있다는 인식)'),
      perceivedSeverity: z
        .object({
          level: z.enum(['high', 'medium', 'low']).catch('medium'),
          evidence: z.string().catch(''),
        })
        .catch({ level: 'medium', evidence: '' })
        .describe('인지된 심각성'),
      perceivedBenefits: z
        .object({
          level: z.enum(['high', 'medium', 'low']).catch('medium'),
          evidence: z.string().catch(''),
        })
        .catch({ level: 'medium', evidence: '' })
        .describe('인지된 이익 (치료/예방의 효과)'),
      perceivedBarriers: z
        .array(
          z.object({
            barrier: z.string().catch(''),
            severity: z.enum(['high', 'medium', 'low']).catch('medium'),
          }),
        )
        .default([])
        .describe('인지된 장벽 (비용, 부작용 두려움, 접근성 등)'),
      cuesToAction: z
        .array(z.string())
        .default([])
        .describe('행동 유발 계기 (의사 권고, 미디어 캠페인 등)'),
      selfEfficacy: z
        .object({
          level: z.enum(['high', 'medium', 'low']).catch('medium'),
          evidence: z.string().catch(''),
        })
        .catch({ level: 'medium', evidence: '' })
        .describe('자기효능감 (스스로 할 수 있다는 믿음)'),
    })
    .catch({
      perceivedSusceptibility: { level: 'medium', evidence: '' },
      perceivedSeverity: { level: 'medium', evidence: '' },
      perceivedBenefits: { level: 'medium', evidence: '' },
      perceivedBarriers: [],
      cuesToAction: [],
      selfEfficacy: { level: 'medium', evidence: '' },
    })
    .describe('HBM 6요인 분석'),
  segmentCompliance: z
    .array(
      z.object({
        segment: z.string().catch('').describe('집단명 (환자/보호자/일반대중 등)'),
        complianceProbability: z.number().min(0).max(100).catch(50),
        keyBarriers: z.array(z.string()).default([]),
        keyMotivators: z.array(z.string()).default([]),
      }),
    )
    .default([])
    .describe('집단별 순응 예측'),
  interventionRecommendations: z
    .array(
      z.object({
        intervention: z.string().catch(''),
        targetFactor: z.string().catch('').describe('개입이 타겟하는 HBM 요인'),
        expectedImpact: z.string().catch(''),
        priority: z.enum(['high', 'medium', 'low']).catch('medium'),
      }),
    )
    .default([])
    .describe('순응도 향상 개입 권고'),
  summary: z.string().catch('').describe('의료 순응도 예측 종합 요약'),
});

export type CompliancePredictorResult = z.infer<typeof CompliancePredictorSchema>;
