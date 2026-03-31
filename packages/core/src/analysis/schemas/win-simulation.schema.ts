import { z } from 'zod';

// ADVN-04: 승리 확률 시뮬레이션 스키마
// 승리/패배 조건과 핵심 전략을 도출
export const WinSimulationSchema = z.object({
  winProbability: z.number().describe('승리 확률 0~100'),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  winConditions: z.array(z.object({
    condition: z.string(),
    currentStatus: z.enum(['met', 'partial', 'unmet']),
    importance: z.enum(['critical', 'high', 'medium']),
  })).describe('승리 조건 3~7개'),
  loseConditions: z.array(z.object({
    condition: z.string(),
    currentRisk: z.enum(['high', 'medium', 'low']),
    mitigation: z.string(),
  })).describe('패배 조건 2~5개'),
  keyStrategies: z.array(z.object({
    strategy: z.string(),
    expectedImpact: z.string(),
    priority: z.number(),
  })).describe('핵심 전략 3~5개'),
  simulationSummary: z.string(),
});

export type WinSimulationResult = z.infer<typeof WinSimulationSchema>;
