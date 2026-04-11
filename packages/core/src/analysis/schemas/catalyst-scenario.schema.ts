import { z } from 'zod';

// 금융 도메인 Stage 4: 호재/악재 시나리오 스키마
export const CatalystScenarioSchema = z.object({
  scenarios: z
    .array(
      z.object({
        type: z
          .enum(['bull', 'bear', 'base'])
          .catch('base')
          .describe('시나리오 유형: bull=호재/강세, bear=악재/약세, base=기본'),
        typeName: z.string().catch(''),
        probability: z.number().min(0).max(1).catch(0.33).describe('발생 확률 (0~1)'),
        catalysts: z
          .array(z.string())
          .default([])
          .describe('이 시나리오를 촉발할 수 있는 이벤트 목록'),
        sentimentImpact: z.string().catch('').describe('투자 심리에 미치는 영향'),
        marketNarrative: z.string().catch('').describe('이 시나리오에서 형성될 시장 내러티브'),
        keyWatchPoints: z
          .array(z.string())
          .default([])
          .describe('이 시나리오 진행 여부를 확인할 지표'),
        timeframe: z.string().catch('').describe('예상 전개 기간'),
      }),
    )
    .min(3)
    .max(3)
    .default([])
    .describe('3개 시나리오 (bull/base/bear 순서 고정)'),
  mostLikelyScenario: z
    .enum(['bull', 'base', 'bear'])
    .catch('base')
    .describe('현재 여론 기반 가장 가능성 높은 시나리오'),
  sentimentMomentum: z
    .enum([
      'accelerating-bull',
      'decelerating-bull',
      'stable',
      'decelerating-bear',
      'accelerating-bear',
    ])
    .catch('stable')
    .describe('현재 심리 모멘텀 방향'),
  noiseVsSignal: z
    .object({
      isCurrentMoveNoise: z.boolean().catch(false),
      reasoning: z.string().catch('').describe('노이즈(단기 과잉반응) vs 시그널(구조적 변화) 판단'),
    })
    .catch({ isCurrentMoveNoise: false, reasoning: '' }),
  disclaimer: z.string().catch('이 시나리오 분석은 투자 자문이 아닙니다.').describe('면책 문구'),
  summary: z.string().catch('').describe('시나리오 분석 종합 요약'),
});

export type CatalystScenarioResult = z.infer<typeof CatalystScenarioSchema>;
