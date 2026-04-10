import { z } from 'zod';

// 컴백/신곡 반응 예측 결과 스키마
export const ReleaseReceptionPredictionSchema = z.object({
  predictedReception: z.enum(['explosive', 'positive', 'mixed', 'negative', 'controversial']),
  confidenceLevel: z.enum(['high', 'medium', 'low']),
  receptionScore: z.number().describe('예상 반응 점수 0~100'),
  successFactors: z
    .array(
      z.object({
        factor: z.string().describe('성공 요인'),
        currentStatus: z.enum(['strong', 'moderate', 'weak', 'unknown']),
        importance: z.enum(['critical', 'high', 'medium']),
      }),
    )
    .default([]),
  riskFactors: z
    .array(
      z.object({
        factor: z.string().describe('리스크 요인'),
        riskLevel: z.enum(['high', 'medium', 'low']),
        mitigation: z.string().describe('완화 방안'),
      }),
    )
    .default([]),
  crossPlatformOutlook: z
    .array(
      z.object({
        platform: z.string().describe('플랫폼명'),
        expectedSentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
        keyMetric: z
          .string()
          .describe('핵심 지표 (예: "초동 스트리밍 수", "유튜브 24시간 조회수")'),
      }),
    )
    .default([]),
  actionPlan: z
    .array(
      z.object({
        action: z.string().describe('실행 항목'),
        expectedImpact: z.string().describe('기대 효과'),
        priority: z.number().describe('우선순위'),
        timing: z.string().describe('실행 시점'),
      }),
    )
    .default([]),
  simulationSummary: z.string().describe('전체 시뮬레이션 요약'),
});

export type ReleaseReceptionPredictionResult = z.infer<typeof ReleaseReceptionPredictionSchema>;
