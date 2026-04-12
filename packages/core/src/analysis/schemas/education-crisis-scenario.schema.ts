import { z } from 'zod';

// Education-ADVN-03: 교육 위기 시나리오 스키마
// Social Contract Theory(Rawls, 1971) + Institutional Reputation Theory(Fombrun, 1996) 기반
const EducationCrisisScenarioItemSchema = z.object({
  type: z
    .enum(['spread', 'control', 'reverse'])
    .catch('control')
    .describe('시나리오 유형: 확산(최악) / 통제(보통) / 역전(최선)'),
  label: z.string().catch('').describe('시나리오 한 줄 제목'),
  probability: z.number().min(0).max(100).catch(33).describe('발생 확률 (%)'),
  triggerConditions: z
    .array(z.string())
    .default([])
    .describe('이 시나리오를 촉발하는 교육기관 특화 이벤트'),
  timeline: z
    .object({
      shortTerm: z.string().catch('').describe('1~3개월 전개 양상'),
      midTerm: z.string().catch('').describe('3~12개월 전개 양상'),
      longTerm: z.string().catch('').describe('1~3년 전개 양상'),
    })
    .describe('단계별 여론 전개 경로'),
  reputationImpact: z
    .object({
      admissionsEffect: z.string().catch('').describe('입학 지원자 수·경쟁률 영향'),
      studentSatisfactionEffect: z.string().catch('').describe('재학생 만족도·이탈 영향'),
      mediaFrameShift: z.string().catch('').describe('언론 보도 프레임 변화'),
      socialContractBreach: z
        .enum(['severe', 'moderate', 'minimal', 'none'])
        .catch('moderate')
        .describe('교육 사회계약 위반 정도'),
    })
    .describe('평판 차원별 시나리오 영향'),
  keyActions: z
    .array(z.string())
    .default([])
    .describe('이 시나리오 실현/방지를 위해 기관이 취해야 할 즉각 행동'),
  recoveryPath: z.string().catch('').describe('평판 회복 가능 경로 및 소요 기간 추정'),
});

export const EducationCrisisScenarioSchema = z.object({
  scenarios: z
    .array(EducationCrisisScenarioItemSchema)
    .default([])
    .describe('3가지 시나리오 (spread → control → reverse 순)'),
  crisisRoot: z
    .object({
      primaryTrigger: z.string().catch('').describe('현재 가장 위험한 위기 씨앗'),
      contractBreachDimensions: z
        .array(z.string())
        .default([])
        .describe('교육 사회계약 위반이 감지되는 차원 (취업·교육품질·학비·비리 등)'),
      vulnerableStakeholders: z
        .array(z.string())
        .default([])
        .describe('위기에 가장 민감하게 반응할 이해관계자 집단'),
    })
    .describe('위기 근본 원인 분석'),
  goldenHourActions: z
    .array(z.string())
    .default([])
    .describe('골든타임(72시간) 내 반드시 실행해야 할 우선 조치'),
  recoveryFramework: z
    .object({
      shortTermGoals: z.array(z.string()).default([]).describe('단기(3개월) 회복 목표'),
      midTermGoals: z.array(z.string()).default([]).describe('중기(1년) 회복 목표'),
      longTermGoals: z.array(z.string()).default([]).describe('장기(3년) 신뢰 재건 목표'),
    })
    .describe('단계별 평판 회복 프레임워크'),
  summary: z.string().catch('').describe('교육 위기 시나리오 종합 요약'),
});

export type EducationCrisisScenarioResult = z.infer<typeof EducationCrisisScenarioSchema>;
