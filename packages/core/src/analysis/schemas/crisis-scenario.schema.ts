import { z } from 'zod';

// 개별 시나리오 공통 필드
const scenarioBase = {
  name: z.string(),
  probability: z.number().min(0).max(100),
  triggerConditions: z.array(z.string()),
  expectedOutcome: z.string(),
  responseStrategy: z.array(z.string()),
  timeframe: z.string(),
};

// ADVN-03: 위기 대응 시나리오 스키마
// 3개 시나리오: spread(확산/worst), control(통제/moderate), reverse(역전/best)
const scenarioSchema = z.object({
  type: z.enum(['spread', 'control', 'reverse']),
  ...scenarioBase,
});

export const CrisisScenarioSchema = z.object({
  scenarios: z.array(scenarioSchema).min(3).max(3),
  currentRiskLevel: z.enum(['critical', 'high', 'medium', 'low']),
  recommendedAction: z.string(),
});

export type CrisisScenarioResult = z.infer<typeof CrisisScenarioSchema>;
