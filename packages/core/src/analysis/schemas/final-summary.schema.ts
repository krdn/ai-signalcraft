import { z } from 'zod';

// 모듈8: 최종 전략 요약 (REPT-02)
export const FinalSummarySchema = z.object({
  oneLiner: z.string().describe('현재 상태 + 승부 핵심 한 줄 요약'),
  currentState: z.object({
    summary: z.string(),
    sentiment: z.enum(['positive', 'negative', 'mixed']),
    keyFactor: z.string(),
  }),
  criticalActions: z.array(z.object({
    priority: z.number(),
    action: z.string(),
    expectedImpact: z.string(),
    timeline: z.string(),
  })).describe('최우선 실행 과제 (최대 5개)'),
  outlook: z.object({
    shortTerm: z.string(),
    mediumTerm: z.string(),
    keyVariable: z.string(),
  }),
});

export type FinalSummaryResult = z.infer<typeof FinalSummarySchema>;
