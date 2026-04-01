import { z } from 'zod';

// 모듈6: 기회 분석 (DEEP-04)
export const OpportunitySchema = z.object({
  positiveAssets: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        expandability: z.enum(['high', 'medium', 'low']),
        currentUtilization: z.enum(['fully', 'partially', 'unused']),
        recommendation: z.string(),
      }),
    )
    .describe('확장 가능한 긍정 요소'),
  untappedAreas: z
    .array(
      z.object({
        area: z.string(),
        potential: z.string(),
        approach: z.string(),
      }),
    )
    .describe('미활용 영역'),
  priorityOpportunity: z.object({
    title: z.string(),
    reason: z.string(),
    actionPlan: z.string(),
  }),
});

export type OpportunityResult = z.infer<typeof OpportunitySchema>;
