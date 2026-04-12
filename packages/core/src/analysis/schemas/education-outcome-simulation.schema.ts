import { z } from 'zod';

// Education-ADVN-04: 교육기관 목표 달성 시뮬레이션 스키마
// Rankings Dynamics(Espeland & Sauder, 2007) + Institutional Reputation Theory(Fombrun, 1996) 기반
export const EducationOutcomeSimulationSchema = z.object({
  recoveryProbability: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('교육기관 신뢰·평판 회복 확률 (0~100%)'),
  probabilityBasis: z.string().catch('').describe('확률 산출 근거 요약'),
  winConditions: z
    .array(
      z.object({
        condition: z.string().catch('').describe('목표 달성 조건'),
        status: z.enum(['met', 'partial', 'unmet']).catch('partial'),
        evidence: z.string().catch('').describe('현재 여론에서 해당 조건 충족 근거'),
        requiredAction: z.string().catch('').describe('미충족 시 필요한 추가 행동'),
      }),
    )
    .default([])
    .describe('평판 목표 달성 조건 체크리스트'),
  strategicPriorities: z
    .array(
      z.object({
        priority: z.number().min(1).max(10).catch(5).describe('우선순위 순번'),
        action: z.string().catch('').describe('전략적 행동'),
        targetGroup: z.string().catch('').describe('대상 이해관계자 집단'),
        expectedImpact: z.string().catch('').describe('예상 효과 (정량적 표현)'),
        timeframe: z.string().catch('').describe('실행 기간'),
      }),
    )
    .default([])
    .describe('승리 확률 극대화를 위한 전략 우선순위 (strategy 모듈 재배치)'),
  differentiationOpportunities: z
    .array(
      z.object({
        area: z.string().catch('').describe('차별화 가능 영역'),
        currentState: z.string().catch('').describe('현재 여론상 위치'),
        targetState: z.string().catch('').describe('목표 위치'),
        approach: z.string().catch('').describe('차별화 접근 방법'),
      }),
    )
    .default([])
    .describe('경쟁 교육기관 대비 차별화 포지셔닝 기회'),
  riskAdjustments: z
    .array(
      z.object({
        risk: z.string().catch('').describe('확률을 낮추는 리스크 요인'),
        probabilityImpact: z.number().min(-50).max(0).catch(-5).describe('확률 감소 기여분 (%)'),
        mitigation: z.string().catch('').describe('리스크 완화 방법'),
      }),
    )
    .default([])
    .describe('주요 리스크 요인과 확률에 대한 부정적 영향'),
  optimisticScenario: z
    .object({
      probability: z.number().min(0).max(100).catch(30),
      description: z.string().catch('').describe('최선 시나리오 하 목표 달성 경로'),
      keyDriver: z.string().catch('').describe('최선 시나리오를 이끄는 핵심 변수'),
    })
    .describe('낙관 시나리오'),
  pessimisticScenario: z
    .object({
      probability: z.number().min(0).max(100).catch(30),
      description: z.string().catch('').describe('최악 시나리오 하 전개 경로'),
      keyRisk: z.string().catch('').describe('최악 시나리오를 촉발하는 핵심 위험'),
    })
    .describe('비관 시나리오'),
  summary: z.string().catch('').describe('교육기관 목표 달성 시뮬레이션 종합 요약'),
});

export type EducationOutcomeSimulationResult = z.infer<typeof EducationOutcomeSimulationSchema>;
