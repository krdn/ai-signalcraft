import { z } from 'zod';

// Education-ADVN-01: 기관 평판 지수 스키마
// Fombrun(1996) Institutional Reputation Theory + Spence(1973) Signaling Theory 기반
export const InstitutionalReputationIndexSchema = z.object({
  reputationIndex: z
    .number()
    .min(0)
    .max(100)
    .catch(50)
    .describe('종합 기관 평판 지수 (0=최저, 100=최고)'),
  trend: z.enum(['improving', 'stable', 'declining']).catch('stable').describe('평판 추세'),
  dimensionScores: z
    .array(
      z.object({
        dimension: z
          .string()
          .catch('')
          .describe('평판 차원 (교육품질 / 연구력 / 취업률 / 학생생활)'),
        score: z.number().min(0).max(100).catch(50),
        trend: z.enum(['improving', 'stable', 'declining']).catch('stable'),
        keyFindings: z.string().catch('').describe('해당 차원 핵심 발견'),
        evidences: z.array(z.string()).default([]).describe('근거 데이터 요약'),
      }),
    )
    .default([])
    .describe('4차원별 평판 점수 (교육품질·연구력·취업률·학생생활)'),
  groupPerceptions: z
    .array(
      z.object({
        group: z
          .string()
          .catch('')
          .describe('이해관계자 집단 (지원자 / 재학생 / 졸업생 / 일반대중)'),
        sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).catch('neutral'),
        keyConcerns: z.array(z.string()).default([]).describe('주요 우려 사항'),
        keyStrengths: z.array(z.string()).default([]).describe('강점으로 언급되는 항목'),
        perceptionGap: z.string().catch('').describe('공식 신호와 실제 인식 간 간극'),
      }),
    )
    .default([])
    .describe('4집단별 인식 차이 (지원자·재학생·졸업생·일반대중)'),
  competitivePosition: z
    .object({
      relativeScore: z
        .number()
        .min(-100)
        .max(100)
        .catch(0)
        .describe('경쟁 기관 대비 상대 점수 (양수=우위, 음수=열세)'),
      strengths: z.array(z.string()).default([]).describe('경쟁 우위 영역'),
      weaknesses: z.array(z.string()).default([]).describe('경쟁 열위 영역'),
      differentiators: z.array(z.string()).default([]).describe('차별화 가능 포인트'),
    })
    .describe('경쟁 교육기관 대비 포지션'),
  signalingGaps: z
    .array(
      z.object({
        signal: z.string().catch('').describe('기관이 발신하는 공식 신호 (순위·취업률 등)'),
        reception: z.string().catch('').describe('이해관계자가 실제로 수신하는 메시지'),
        gapSeverity: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
        recommendation: z.string().catch('').describe('신호-수신 간극 해소 방안'),
      }),
    )
    .default([])
    .describe('Signaling Theory 기반 공식 신호 vs 수신 간극'),
  earlyWarnings: z
    .array(z.string())
    .default([])
    .describe('부정 키워드(비리·폐과·구조조정) 조기 경고 신호'),
  summary: z.string().catch('').describe('기관 평판 지수 종합 요약'),
});

export type InstitutionalReputationIndexResult = z.infer<typeof InstitutionalReputationIndexSchema>;
