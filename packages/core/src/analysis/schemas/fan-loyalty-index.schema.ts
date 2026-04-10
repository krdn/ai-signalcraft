import { z } from 'zod';

// 팬덤 충성도 지수 결과 스키마
export const FanLoyaltyIndexSchema = z.object({
  loyaltyScore: z.object({
    overall: z.number().describe('종합 충성도 점수 0~100'),
    engagement: z.number().describe('참여도 0~100 (스트리밍, 조공, 투표 등 적극 활동)'),
    sentiment: z.number().describe('감정 점수 0~100 (긍정 비율 기반)'),
    advocacy: z.number().describe('옹호 의지 0~100 (비판에 대한 방어, 자발적 홍보)'),
  }),
  churnIndicators: z
    .array(
      z.object({
        signal: z
          .string()
          .describe('이탈 징후 신호 (예: "이전엔 팬이었는데", "실망", "다른 그룹으로 이관")'),
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        evidence: z.string().describe('데이터 근거'),
        affectedSegment: z.enum(['core-fan', 'casual-fan', 'general-public']),
      }),
    )
    .default([]),
  loyaltySegments: z
    .array(
      z.object({
        segment: z.enum(['devoted', 'active', 'passive', 'dormant', 'at-risk']),
        estimatedSize: z.string().describe('추정 규모 (예: "전체 팬의 30%")'),
        characteristics: z.string().describe('특성 설명'),
        churnRisk: z.enum(['high', 'medium', 'low']),
      }),
    )
    .default([]),
  viralAdvocacy: z.object({
    activeDefenders: z.string().describe('적극적 옹호자 특성 설명'),
    defensePatterns: z
      .array(z.string())
      .default([])
      .describe('방어 패턴 (예: "안티 댓글에 팩트 체크", "과거 성과 인용")'),
    organicPromotion: z
      .array(z.string())
      .default([])
      .describe('자발적 홍보 활동 (예: "지인에게 추천", "SNS에 MV 공유")'),
  }),
  recommendation: z.string().describe('충성도 유지/강화 권고'),
});

export type FanLoyaltyIndexResult = z.infer<typeof FanLoyaltyIndexSchema>;
