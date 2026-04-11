import { z } from 'zod';

// 스포츠 도메인 Stage 4: 시즌 전망 예측 스키마
export const SeasonOutlookPredictionSchema = z.object({
  overallOutlook: z
    .enum(['very-positive', 'positive', 'neutral', 'negative', 'very-negative'])
    .catch('neutral')
    .describe('시즌 전망 종합 평가'),
  fanExpectationLevel: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('팬 기대치 지수 (0=매우 낮음, 100=매우 높음)'),
  fanEngagementForecast: z
    .object({
      trend: z.enum(['increasing', 'stable', 'decreasing']).catch('stable'),
      confidence: z.enum(['high', 'medium', 'low']).catch('medium'),
      description: z.string().catch('').describe('팬 참여도 예측 근거'),
    })
    .catch({ trend: 'stable', confidence: 'medium', description: '' }),
  keyWatchPoints: z
    .array(
      z.object({
        watchPoint: z.string().catch('').describe('주목해야 할 핵심 관전 포인트'),
        fanInterestLevel: z.enum(['high', 'medium', 'low']).catch('medium'),
        narrativePotential: z.string().catch('').describe('이 요인이 만들어낼 수 있는 서사'),
      }),
    )
    .default([])
    .describe('팬덤 주목 포인트 목록'),
  riskFactors: z
    .array(
      z.object({
        risk: z.string().catch('').describe('팬 이탈 또는 여론 악화 위험 요인'),
        probability: z.number().min(0).max(1).catch(0.3),
        impact: z.enum(['high', 'medium', 'low']).catch('medium'),
        mitigationSuggestion: z.string().catch(''),
      }),
    )
    .default([])
    .describe('시즌 전망 리스크 요인'),
  opportunityFactors: z
    .array(
      z.object({
        opportunity: z.string().catch('').describe('팬 유입 또는 여론 호전 기회 요인'),
        activationSuggestion: z.string().catch('').describe('기회 활용 방안'),
      }),
    )
    .default([])
    .describe('시즌 여론 호전 기회 요인'),
  competitorComparison: z.string().catch('').describe('경쟁 팀/선수 대비 여론 포지션'),
  disclaimer: z
    .string()
    .catch('이 예측은 현재 여론 데이터 기반이며, 실제 성적에 따라 크게 달라질 수 있습니다.')
    .describe('면책 문구'),
  summary: z.string().catch('').describe('시즌 전망 종합 요약'),
});

export type SeasonOutlookPredictionResult = z.infer<typeof SeasonOutlookPredictionSchema>;
