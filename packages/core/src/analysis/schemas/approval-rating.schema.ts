import { z } from 'zod';

// ADVN-01: AI 지지율 추정 스키마
// 감정 비율과 플랫폼 편향을 보정하여 범위(range)로 산출, 면책 문구 필수 포함
export const ApprovalRatingSchema = z.object({
  estimatedRange: z.object({
    min: z.number().describe('최소 지지율 0~100'),
    max: z.number().describe('최대 지지율 0~100'),
  }).describe('AI 추정 지지율 범위 (%)'),
  confidence: z.enum(['high', 'medium', 'low']),
  methodology: z.object({
    sentimentRatio: z.object({
      positive: z.number(),
      neutral: z.number(),
      negative: z.number(),
    }),
    platformBiasCorrection: z.array(z.object({
      platform: z.string(),
      biasDirection: z.enum(['left', 'right', 'neutral']),
      correctionFactor: z.number(),
    })),
    spreadFactor: z.number().describe('확산력 가중치'),
  }),
  disclaimer: z.string().describe('면책 문구 -- 반드시 포함'),
  reasoning: z.string(),
});

export type ApprovalRatingResult = z.infer<typeof ApprovalRatingSchema>;
