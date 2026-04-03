import { z } from 'zod';

// ADVN-04: 승리 확률 시뮬레이션 스키마
// 승리/패배 조건과 핵심 전략을 도출
export const WinSimulationSchema = z.object({
  winProbability: z.number().catch(0).describe('승리 확률 0~100'),
  confidenceLevel: z.enum(['high', 'medium', 'low']).catch('low'),
  winConditions: z
    .array(
      z.object({
        condition: z.string().catch(''),
        currentStatus: z.enum(['met', 'partial', 'unmet']).catch('unmet'),
        importance: z.enum(['critical', 'high', 'medium']).catch('medium'),
      }),
    )
    .catch([])
    .describe('승리 조건 3~7개'),
  loseConditions: z
    .array(
      z.object({
        condition: z.string().catch(''),
        currentRisk: z.enum(['high', 'medium', 'low']).catch('medium'),
        mitigation: z.string().catch(''),
      }),
    )
    .catch([])
    .describe('패배 조건 2~5개'),
  keyStrategies: z
    .array(
      z.object({
        strategy: z.string().catch(''),
        expectedImpact: z.string().catch(''),
        priority: z.number().catch(0),
      }),
    )
    .catch([])
    .describe('핵심 전략 3~5개'),
  simulationSummary: z.string().catch(''),
});

export type WinSimulationResult = z.infer<typeof WinSimulationSchema>;
