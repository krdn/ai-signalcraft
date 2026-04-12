import { z } from 'zod';

// Education-ADVN-02: 교육 여론 프레임 스키마
// Signaling Theory(Spence, 1973) + Rankings Dynamics(Espeland & Sauder, 2007) 기반
export const EducationOpinionFrameSchema = z.object({
  dominantFrame: z
    .object({
      name: z.string().catch('').describe('지배 프레임 명칭'),
      description: z.string().catch('').describe('프레임 내용 요약'),
      strength: z.number().min(0).max(100).catch(50).describe('프레임 강도 (0~100)'),
      mainCarriers: z
        .array(z.string())
        .default([])
        .describe('주요 확산 주체 (학부모/수험생/졸업생 등)'),
      platforms: z.array(z.string()).default([]).describe('우세한 플랫폼'),
    })
    .describe('현재 교육기관 논의를 주도하는 프레임'),
  challengingFrames: z
    .array(
      z.object({
        name: z.string().catch('').describe('도전 프레임 명칭'),
        description: z.string().catch('').describe('프레임 내용 요약'),
        strength: z.number().min(0).max(100).catch(30),
        source: z.string().catch('').describe('프레임 발원 집단'),
        spreadRisk: z.enum(['high', 'medium', 'low']).catch('medium').describe('확산 위험도'),
      }),
    )
    .default([])
    .describe('재학생·비판 세력이 확산시키는 도전 프레임'),
  institutionOfficialFrame: z
    .object({
      name: z.string().catch('').describe('기관 공식 프레임 명칭'),
      description: z.string().catch('').describe('기관이 강조하는 메시지/프레임'),
      strength: z.number().min(0).max(100).catch(50),
      credibilityScore: z.number().min(0).max(100).catch(50).describe('이해관계자 신뢰도 평가'),
      gaps: z.array(z.string()).default([]).describe('공식 프레임과 학생 경험 간 괴리'),
    })
    .describe('교육기관 공식 입장 및 홍보 프레임'),
  frameDynamics: z
    .object({
      currentBalance: z
        .enum(['institution_dominant', 'contested', 'student_dominant'])
        .catch('contested')
        .describe('현재 프레임 세력 균형'),
      trendDirection: z
        .enum(['institution_gaining', 'stable', 'student_gaining'])
        .catch('stable')
        .describe('세력 변화 방향'),
      flashpoints: z
        .array(z.string())
        .default([])
        .describe('프레임 충돌이 가장 격화되는 이슈/플랫폼'),
      turningConditions: z
        .array(z.string())
        .default([])
        .describe('프레임 역전 조건 (기관에 유리한 전환 트리거)'),
    })
    .describe('프레임 세력 역학 분석'),
  rankingFrameImpact: z
    .object({
      currentNarrative: z.string().catch('').describe('순위 변동이 현재 프레임에 미치는 영향'),
      stakeholderReactions: z
        .array(
          z.object({
            group: z.string().catch(''),
            reaction: z.string().catch(''),
            frameShift: z.string().catch('').describe('해당 집단의 프레임 전환 방향'),
          }),
        )
        .default([])
        .describe('이해관계자별 순위 관련 프레임 반응'),
    })
    .describe('Rankings Dynamics 이론 적용 — 순위와 프레임 연동 분석'),
  keyMessages: z
    .object({
      forAdmissions: z
        .array(z.string())
        .default([])
        .describe('입시 지원자·학부모 대상 효과적인 대응 메시지'),
      forStudents: z.array(z.string()).default([]).describe('재학생 신뢰 회복 메시지'),
      framesToAvoid: z.array(z.string()).default([]).describe('역효과를 낳는 기관 메시지 유형'),
    })
    .describe('프레임 분석 기반 커뮤니케이션 전략'),
  summary: z.string().catch('').describe('교육 여론 프레임 분석 종합 요약'),
});

export type EducationOpinionFrameResult = z.infer<typeof EducationOpinionFrameSchema>;
