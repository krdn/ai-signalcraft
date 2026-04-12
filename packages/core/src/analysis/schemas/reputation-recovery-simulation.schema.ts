import { z } from 'zod';

export const ReputationRecoverySimulationSchema = z.object({
  recoveryProbability: z.number().min(0).max(100).catch(0).describe('평판 회복 달성 확률 (%)'),
  targetReputationScore: z.number().min(0).max(100).catch(60).describe('목표 RepTrak 점수'),
  baselineScore: z.number().min(0).max(100).catch(0).describe('현재 reputation-index 기반선 점수'),
  recoveryTimelineMonths: z.number().min(1).catch(12).describe('목표 달성 예상 기간 (개월)'),
  recoveryPhases: z
    .array(
      z.object({
        phase: z.number().min(1).max(4).catch(1),
        phaseName: z.string().catch(''),
        durationMonths: z.number().min(1).catch(3),
        keyActions: z.array(z.string()).default([]),
        expectedScoreGain: z.number().catch(0),
        criticalStakeholders: z.array(z.string()).default([]),
        successIndicator: z.string().catch(''),
      }),
    )
    .default([]),
  crisisTypeInfluence: z
    .object({
      crisisType: z.enum(['victim', 'accidental', 'preventable']).catch('accidental'),
      recoveryMultiplier: z
        .number()
        .catch(1.0)
        .describe('위기 유형에 따른 회복 난이도 배수 (1.0=보통, >1.0=어려움)'),
      recommendedStrategy: z.string().catch(''),
    })
    .catch({ crisisType: 'accidental', recoveryMultiplier: 1.0, recommendedStrategy: '' }),
  sloRecoveryConditions: z
    .array(
      z.object({
        condition: z.string().catch(''),
        currentStatus: z.enum(['met', 'partial', 'unmet']).catch('unmet'),
        actionRequired: z.string().catch(''),
      }),
    )
    .default([])
    .describe('사회적 운영 허가(SLO) 회복 조건'),
  keyObstacles: z
    .array(
      z.object({
        obstacle: z.string().catch(''),
        source: z.string().catch(''),
        mitigationStrategy: z.string().catch(''),
      }),
    )
    .default([])
    .describe('risk-map 기반 회복 장애 조건'),
  simulationSummary: z.string().catch(''),
});

export type ReputationRecoverySimulationResult = z.infer<typeof ReputationRecoverySimulationSchema>;
