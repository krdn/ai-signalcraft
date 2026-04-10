import { z } from 'zod';

// 팬덤 위기 시나리오 결과 스키마 (CrisisScenarioSchema 구조 재사용)
export const FandomCrisisScenarioSchema = z.object({
  scenarios: z
    .array(
      z.object({
        type: z.enum(['spread', 'control', 'reverse']),
        name: z.string().describe('시나리오명'),
        probability: z.number().describe('발생 확률 0~100'),
        triggerConditions: z
          .array(z.string())
          .describe(
            '트리거 조건 (예: "열애 루머 대형 언론 보도", "표절 의혹 전문가 검증 결과 발표")',
          ),
        expectedOutcome: z
          .string()
          .describe('예상 결과 (정량 포함, 예: "스트리밍 30% 하락", "팬카페 탈퇴 급증")'),
        responseStrategy: z.array(z.string()).describe('대응 전략'),
        timeframe: z.string().describe('예상 전개 기간'),
      }),
    )
    .describe('정확히 3개 시나리오 (spread/control/reverse)'),
  currentRiskLevel: z.enum(['critical', 'high', 'medium', 'low']),
  recommendedAction: z.string().describe('종합 권장 조치'),
});

export type FandomCrisisScenarioResult = z.infer<typeof FandomCrisisScenarioSchema>;
