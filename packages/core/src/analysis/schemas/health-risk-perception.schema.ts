import { z } from 'zod';

// 헬스케어 도메인 Stage 4: 건강 위험 인식 편향 분석 스키마
export const HealthRiskPerceptionSchema = z.object({
  perceivedRiskLevel: z
    .enum(['overestimated', 'accurate', 'underestimated'])
    .catch('accurate')
    .describe('대중의 위험 인식 수준 (전문가 평가 대비)'),
  expertRiskVsPublicPerception: z
    .object({
      expertAssessment: z.string().catch('').describe('의학적·전문가 위험 평가 (데이터 기반)'),
      publicPerception: z.string().catch('').describe('대중의 위험 인식 (여론 기반)'),
      gap: z.string().catch('').describe('전문가와 대중 인식 간 간극'),
      gapMagnitude: z.enum(['large', 'moderate', 'small']).catch('moderate'),
    })
    .catch({ expertAssessment: '', publicPerception: '', gap: '', gapMagnitude: 'moderate' }),
  perceptionBiases: z
    .array(
      z.object({
        biasType: z
          .enum([
            'dread-factor',
            'unknown-risk',
            'normalcy-bias',
            'availability-heuristic',
            'other',
          ])
          .catch('other'),
        biasName: z.string().catch('').describe('편향 유형 한글 명칭'),
        description: z.string().catch('').describe('데이터에서 어떻게 나타나는지 구체적 설명'),
        affectedGroups: z.array(z.string()).default([]).describe('가장 강하게 영향받는 집단'),
        intensity: z.enum(['high', 'medium', 'low']).catch('medium'),
      }),
    )
    .default([])
    .describe('Risk Perception Theory 기반 편향 유형 목록'),
  misinformationPatterns: z
    .array(
      z.object({
        claim: z.string().catch('').describe('확산 중인 오정보 또는 과장된 주장'),
        spreadLevel: z.enum(['high', 'medium', 'low']).catch('medium'),
        correctionPriority: z.enum(['urgent', 'high', 'medium', 'low']).catch('medium'),
      }),
    )
    .default([])
    .describe('주요 오정보 또는 과장 주장 패턴'),
  communicationRecommendations: z
    .array(
      z.object({
        recommendation: z.string().catch(''),
        targetAudience: z.string().catch(''),
        channel: z.string().catch(''),
      }),
    )
    .default([])
    .describe('위험 인식 격차 해소를 위한 커뮤니케이션 권고'),
  summary: z.string().catch('').describe('건강 위험 인식 분석 종합 요약'),
});

export type HealthRiskPerceptionResult = z.infer<typeof HealthRiskPerceptionSchema>;
