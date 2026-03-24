import { z } from 'zod';

// 모듈4: 메시지 효과 분석 스키마 (DEEP-02)
export const MessageImpactSchema = z.object({
  successMessages: z.array(z.object({
    content: z.string(),
    source: z.string(),
    impactScore: z.number().describe('1~10'),
    reason: z.string(),
    spreadType: z.string(),
  })).describe('성공 메시지'),
  failureMessages: z.array(z.object({
    content: z.string(),
    source: z.string(),
    negativeScore: z.number().describe('1~10'),
    reason: z.string(),
    damageType: z.string(),
  })).describe('실패 메시지'),
  highSpreadContentTypes: z.array(z.object({
    type: z.string(),
    description: z.string(),
    exampleCount: z.number(),
  })).describe('확산력 높은 콘텐츠 유형'),
});

export type MessageImpactResult = z.infer<typeof MessageImpactSchema>;
