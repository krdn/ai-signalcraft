import { z } from 'zod';

// 모듈7: 전략 도출 (DEEP-05)
export const StrategySchema = z.object({
  targetStrategy: z
    .object({
      primaryTarget: z.string().catch(''),
      secondaryTargets: z.array(z.string()).catch([]),
      approach: z.string().catch(''),
    })
    .catch({ primaryTarget: '', secondaryTargets: [], approach: '' })
    .describe('타겟 전략'),
  messageStrategy: z
    .object({
      coreMessage: z.string().catch(''),
      supportingMessages: z.array(z.string()).catch([]),
      toneAndManner: z.string().catch(''),
    })
    .catch({ coreMessage: '', supportingMessages: [], toneAndManner: '' })
    .describe('메시지 전략'),
  contentStrategy: z
    .object({
      recommendedFormats: z.array(z.string()).catch([]),
      keyTopics: z.array(z.string()).catch([]),
      distributionChannels: z.array(z.string()).catch([]),
    })
    .catch({ recommendedFormats: [], keyTopics: [], distributionChannels: [] })
    .describe('콘텐츠 전략'),
  riskResponse: z
    .object({
      immediateActions: z.array(z.string()).catch([]),
      preventiveActions: z.array(z.string()).catch([]),
      contingencyPlan: z.string().catch(''),
    })
    .catch({ immediateActions: [], preventiveActions: [], contingencyPlan: '' })
    .describe('리스크 대응'),
});

export type StrategyResult = z.infer<typeof StrategySchema>;
