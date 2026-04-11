import { z } from 'zod';

// PR 도메인 Stage 4: SCCT 기반 위기 유형 분류 스키마
export const CrisisTypeClassifierSchema = z.object({
  crisisType: z
    .enum(['victim', 'accidental', 'preventable'])
    .catch('accidental')
    .describe('SCCT 위기 유형: victim=희생자형, accidental=사고형, preventable=예방가능형'),
  crisisTypeName: z.string().catch('사고형 위기').describe('위기 유형 한글 명칭'),
  crisisTypeDescription: z.string().catch('').describe('위기 유형 특성 설명'),
  responsibilityLevel: z.enum(['low', 'medium', 'high']).catch('medium').describe('귀속 책임 수준'),
  recommendedStrategies: z
    .array(
      z.object({
        strategy: z
          .enum(['denial', 'evasion', 'reduction', 'corrective-action', 'mortification'])
          .catch('corrective-action'),
        strategyName: z.string().catch('').describe('전략 한글 명칭'),
        rationale: z.string().catch('').describe('이 전략을 권고하는 이유'),
        priority: z.number().min(1).max(5).catch(3).describe('우선순위 (1=최우선)'),
      }),
    )
    .default([])
    .describe('Image Repair Theory 기반 권고 대응 전략 목록'),
  crisisHistory: z
    .array(
      z.object({
        event: z.string().catch(''),
        date: z.string().catch(''),
        impact: z.enum(['positive', 'negative', 'neutral']).catch('negative'),
      }),
    )
    .default([])
    .describe('관련 과거 위기 이력'),
  goldenTimeWindow: z
    .object({
      hoursRemaining: z.number().catch(72).describe('골든타임 잔여 시간(시간 단위)'),
      urgencyLevel: z.enum(['critical', 'high', 'medium', 'low']).catch('high'),
      rationale: z.string().catch('').describe('골든타임 판단 근거'),
    })
    .catch({ hoursRemaining: 72, urgencyLevel: 'high', rationale: '' })
    .describe('위기 대응 골든타임 평가'),
  summary: z.string().catch('').describe('위기 유형 분류 종합 요약'),
});

export type CrisisTypeClassifierResult = z.infer<typeof CrisisTypeClassifierSchema>;
