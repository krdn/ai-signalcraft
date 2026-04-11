import { z } from 'zod';

// 기업 도메인 Stage 4: 이해관계자 영향력 매핑 스키마
export const StakeholderMapSchema = z.object({
  stakeholders: z
    .array(
      z.object({
        name: z.string().catch('').describe('이해관계자 집단명'),
        type: z
          .string()
          .catch('')
          .describe('유형 (investors/consumers/employees/regulators/media)'),
        powerLevel: z
          .enum(['high', 'medium', 'low'])
          .catch('medium')
          .describe('영향력(Power) 수준'),
        legitimacy: z
          .enum(['high', 'medium', 'low'])
          .catch('medium')
          .describe('합법성(Legitimacy) 수준'),
        urgency: z.enum(['high', 'medium', 'low']).catch('low').describe('긴급성(Urgency) 수준'),
        salienceScore: z
          .number()
          .min(0)
          .max(10)
          .catch(5)
          .describe('현출성 점수 (권력+합법성+긴급성 종합)'),
        currentSentiment: z.enum(['supportive', 'neutral', 'opposed', 'mixed']).catch('neutral'),
        keyExpectations: z.array(z.string()).default([]).describe('이해관계자의 핵심 기대사항'),
        keyGrievances: z.array(z.string()).default([]).describe('이해관계자의 핵심 불만'),
        engagementPriority: z
          .enum(['critical', 'high', 'medium', 'low'])
          .catch('medium')
          .describe('대응 우선순위'),
      }),
    )
    .default([])
    .describe('이해관계자별 상세 프로파일'),
  powerDynamics: z.string().catch('').describe('이해관계자 간 권력 역학 관계 및 연합 가능성'),
  criticalStakeholder: z
    .object({
      name: z.string().catch(''),
      reason: z.string().catch(''),
      immediateAction: z.string().catch('').describe('즉시 취해야 할 대응 조치'),
    })
    .catch({ name: '', reason: '', immediateAction: '' })
    .describe('가장 긴급하게 관리해야 할 이해관계자'),
  stakeholderMatrix: z
    .string()
    .catch('')
    .describe('이해관계자 매트릭스 해석 (고권력-고관심 등 4분면 분류)'),
  summary: z.string().catch('').describe('이해관계자 지도 종합 요약'),
});

export type StakeholderMapResult = z.infer<typeof StakeholderMapSchema>;
