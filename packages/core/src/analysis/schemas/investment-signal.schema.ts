import { z } from 'zod';

// 금융 도메인 Stage 4: 투자 신호 종합 스키마
export const InvestmentSignalSchema = z.object({
  overallSignal: z
    .enum(['strong-buy', 'buy', 'hold', 'sell', 'strong-sell'])
    .catch('hold')
    .describe('종합 투자 신호 (여론 기반 — 투자 자문 아님)'),
  signalStrength: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('신호 강도 (0=매우 약함, 100=매우 강함)'),
  signalComponents: z
    .array(
      z.object({
        component: z.string().catch('').describe('신호 구성 요소'),
        signal: z.enum(['positive', 'negative', 'neutral']).catch('neutral'),
        weight: z.number().min(0).max(1).catch(0.2).describe('가중치'),
        rationale: z.string().catch(''),
      }),
    )
    .default([])
    .describe('신호 구성 요소 분해'),
  timeHorizon: z
    .object({
      shortTerm: z
        .object({
          signal: z.enum(['strong-buy', 'buy', 'hold', 'sell', 'strong-sell']).catch('hold'),
          rationale: z.string().catch(''),
          timeframe: z.string().catch('1~2주'),
        })
        .catch({ signal: 'hold', rationale: '', timeframe: '1~2주' }),
      mediumTerm: z
        .object({
          signal: z.enum(['strong-buy', 'buy', 'hold', 'sell', 'strong-sell']).catch('hold'),
          rationale: z.string().catch(''),
          timeframe: z.string().catch('1~3개월'),
        })
        .catch({ signal: 'hold', rationale: '', timeframe: '1~3개월' }),
    })
    .catch({
      shortTerm: { signal: 'hold', rationale: '', timeframe: '1~2주' },
      mediumTerm: { signal: 'hold', rationale: '', timeframe: '1~3개월' },
    })
    .describe('단기/중기 신호 구분'),
  keyRisks: z.array(z.string()).default([]).describe('현재 신호의 주요 리스크 요인'),
  keyOpportunities: z.array(z.string()).default([]).describe('현재 신호의 주요 기회 요인'),
  sentimentExtremeWarning: z
    .object({
      isExtreme: z.boolean().catch(false),
      direction: z.enum(['euphoric', 'panicking', 'none']).catch('none'),
      contraindicatorSignal: z
        .string()
        .catch('')
        .describe('극단적 심리 시 역발상 신호 (탐욕이면 매도, 공포이면 매수 시사)'),
    })
    .catch({ isExtreme: false, direction: 'none', contraindicatorSignal: '' }),
  disclaimer: z
    .string()
    .catch(
      '이 신호는 여론 데이터 기반의 참고 자료이며, 투자 자문이 아닙니다. 실제 투자는 공식 재무 분석과 전문 투자 자문을 기반으로 하세요.',
    )
    .describe('면책 문구 — 반드시 포함'),
  summary: z.string().catch('').describe('투자 신호 종합 요약'),
});

export type InvestmentSignalResult = z.infer<typeof InvestmentSignalSchema>;
