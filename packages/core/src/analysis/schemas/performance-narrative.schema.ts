import { z } from 'zod';

// 스포츠 도메인 Stage 4: 성과 내러티브 분석 스키마
export const PerformanceNarrativeSchema = z.object({
  performanceSentimentCorrelation: z
    .object({
      description: z.string().catch('').describe('성적 변화와 여론 온도 간 상관관계 설명'),
      correlationStrength: z.enum(['strong', 'moderate', 'weak']).catch('moderate'),
      lag: z
        .string()
        .catch('')
        .describe('성적 변화 후 여론 반응까지의 시간 지연 (예: 경기 직후, 1~2일 후)'),
    })
    .catch({ description: '', correlationStrength: 'moderate', lag: '' }),
  narrativeArcs: z
    .array(
      z.object({
        arc: z.string().catch('').describe('내러티브 호 (예: "부활 서사", "몰락 스토리")'),
        dominance: z.enum(['dominant', 'emerging', 'fading']).catch('emerging'),
        fanReactionType: z
          .enum(['birging', 'corfing', 'mixed'])
          .catch('mixed')
          .describe('BIRGing(반사 영광)/CORFing(반사 실패 회피) 패턴'),
        description: z.string().catch(''),
      }),
    )
    .default([])
    .describe('주요 서사 호 및 팬 반응 패턴'),
  keyPerformanceDrivers: z
    .array(
      z.object({
        driver: z.string().catch('').describe('여론을 움직인 주요 성과 요인'),
        impact: z.enum(['positive', 'negative', 'mixed']).catch('mixed'),
        magnitude: z.enum(['high', 'medium', 'low']).catch('medium'),
      }),
    )
    .default([])
    .describe('여론 변화를 유발한 핵심 성과 요인'),
  mediaFraming: z
    .object({
      dominantFrame: z.string().catch('').describe('언론이 주로 채택한 성과 프레임'),
      fanCommunityFrame: z.string().catch('').describe('팬 커뮤니티의 자체 해석 프레임'),
      frameDivergence: z.string().catch('').describe('미디어와 팬 커뮤니티 프레임 간 차이점'),
    })
    .catch({ dominantFrame: '', fanCommunityFrame: '', frameDivergence: '' }),
  momentumAssessment: z
    .object({
      currentMomentum: z.enum(['positive', 'negative', 'neutral']).catch('neutral'),
      stabilityIndex: z
        .number()
        .min(0)
        .max(100)
        .catch(50)
        .describe('팬덤 여론 안정성 지수 (0=매우 변동적, 100=매우 안정적)'),
      outlookDescription: z.string().catch('').describe('현재 모멘텀 전망'),
    })
    .catch({ currentMomentum: 'neutral', stabilityIndex: 50, outlookDescription: '' }),
  summary: z.string().catch('').describe('성과 내러티브 종합 요약'),
});

export type PerformanceNarrativeResult = z.infer<typeof PerformanceNarrativeSchema>;
