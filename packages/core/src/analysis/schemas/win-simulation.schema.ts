import { z } from 'zod';

// ADVN-04: 승리 확률 시뮬레이션 스키마
// 승리/패배 조건과 핵심 전략을 도출
export const WinSimulationSchema = z.object({
  winProbability: z.number().min(0).max(100),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  winConditions: z.array(z.object({
    condition: z.string(),
    currentStatus: z.enum(['met', 'partial', 'unmet']),
    importance: z.enum(['critical', 'high', 'medium']),
  })).min(3).max(7),
  loseConditions: z.array(z.object({
    condition: z.string(),
    currentRisk: z.enum(['high', 'medium', 'low']),
    mitigation: z.string(),
  })).min(2).max(5),
  keyStrategies: z.array(z.object({
    strategy: z.string(),
    expectedImpact: z.string(),
    priority: z.number(),
  })).min(3).max(5),
  simulationSummary: z.string(),
});

export type WinSimulationResult = z.infer<typeof WinSimulationSchema>;
