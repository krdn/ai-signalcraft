import { z } from 'zod';

// 모듈7: 전략 도출 (DEEP-05)
export const StrategySchema = z.object({
  targetStrategy: z
    .object({
      primaryTarget: z.string(),
      secondaryTargets: z.array(z.string()),
      approach: z.string(),
    })
    .describe('타겟 전략'),
  messageStrategy: z
    .object({
      coreMessage: z.string(),
      supportingMessages: z.array(z.string()),
      toneAndManner: z.string(),
    })
    .describe('메시지 전략'),
  contentStrategy: z
    .object({
      recommendedFormats: z.array(z.string()),
      keyTopics: z.array(z.string()),
      distributionChannels: z.array(z.string()),
    })
    .describe('콘텐츠 전략'),
  riskResponse: z
    .object({
      immediateActions: z.array(z.string()),
      preventiveActions: z.array(z.string()),
      contingencyPlan: z.string(),
    })
    .describe('리스크 대응'),
});

export type StrategyResult = z.infer<typeof StrategySchema>;
