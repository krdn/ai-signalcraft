import { z } from 'zod';

// 금융 도메인 Stage 4: 투자 심리 지수 스키마 (Baker & Wurgler, 2006 기반)
export const MarketSentimentIndexSchema = z.object({
  sentimentIndex: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('투자 심리 지수 (0=극단적 공포, 50=중립, 100=극단적 탐욕)'),
  sentimentLabel: z
    .enum(['extreme-fear', 'fear', 'neutral', 'greed', 'extreme-greed'])
    .catch('neutral')
    .describe('투자 심리 레이블'),
  trend: z.enum(['improving', 'stable', 'deteriorating']).catch('stable').describe('심리 추세'),
  investorSegmentSentiment: z
    .array(
      z.object({
        segment: z.string().catch('').describe('투자자 집단 (개인/기관/외국인 등)'),
        sentiment: z.enum(['bullish', 'bearish', 'neutral', 'mixed']).catch('neutral'),
        intensity: z.enum(['high', 'medium', 'low']).catch('medium'),
        keyDrivers: z.array(z.string()).default([]).describe('해당 집단의 심리를 움직인 요인'),
      }),
    )
    .default([])
    .describe('투자자 집단별 심리'),
  behavioralBiases: z
    .array(
      z.object({
        bias: z
          .enum([
            'loss-aversion',
            'anchoring',
            'herding',
            'confirmation-bias',
            'availability-heuristic',
            'overconfidence',
            'other',
          ])
          .catch('other'),
        biasName: z.string().catch('').describe('편향 한글 명칭'),
        evidence: z.string().catch('').describe('여론 데이터에서의 구체적 근거'),
        affectedSegment: z.string().catch(''),
      }),
    )
    .default([])
    .describe('행동 재무학 편향 패턴 식별'),
  sentimentSignals: z
    .object({
      contraindicators: z
        .array(z.string())
        .default([])
        .describe('역발상 신호 (극단적 낙관=매도 신호, 극단적 비관=매수 신호)'),
      momentumIndicators: z.array(z.string()).default([]).describe('추세 추종 신호'),
    })
    .catch({ contraindicators: [], momentumIndicators: [] }),
  disclaimer: z
    .string()
    .catch(
      '이 분석은 투자 자문이 아닙니다. 시장 심리 참고 자료이며, 실제 투자 결정에는 공식 금융 데이터와 전문 투자 자문을 활용하세요.',
    )
    .describe('면책 문구 — 반드시 포함'),
  summary: z.string().catch('').describe('투자 심리 지수 종합 요약'),
});

export type MarketSentimentIndexResult = z.infer<typeof MarketSentimentIndexSchema>;
