import { z } from 'zod';

// ADVN-02: 프레임 전쟁 분석 스키마
// 지배적/위협/반전 가능 프레임을 식별하여 구조화된 결과 생성
export const FrameWarSchema = z.object({
  dominantFrames: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        strength: z.number().describe('강도 0~100'),
        supportingEvidence: z.array(z.string()),
      }),
    )
    .describe('지배적 프레임 TOP 5 (최대 5개)'),
  threateningFrames: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        threatLevel: z.enum(['critical', 'high', 'medium', 'low']),
        counterStrategy: z.string(),
      }),
    )
    .describe('위협 프레임 (최대 5개)'),
  reversibleFrames: z
    .array(
      z.object({
        name: z.string(),
        currentPerception: z.string(),
        potentialShift: z.string(),
        requiredAction: z.string(),
      }),
    )
    .describe('반전 가능 프레임 (최대 3개)'),
  battlefieldSummary: z.string(),
});

export type FrameWarResult = z.infer<typeof FrameWarSchema>;
