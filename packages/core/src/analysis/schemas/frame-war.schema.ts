import { z } from 'zod';

// ADVN-02: 프레임 전쟁 분석 스키마
// 지배적/위협/반전 가능 프레임을 식별하여 구조화된 결과 생성
export const FrameWarSchema = z.object({
  dominantFrames: z.array(z.object({
    name: z.string(),
    description: z.string(),
    strength: z.number().min(0).max(100),
    supportingEvidence: z.array(z.string()),
  })).max(5).describe('지배적 프레임 TOP 5'),
  threateningFrames: z.array(z.object({
    name: z.string(),
    description: z.string(),
    threatLevel: z.enum(['critical', 'high', 'medium', 'low']),
    counterStrategy: z.string(),
  })).max(5),
  reversibleFrames: z.array(z.object({
    name: z.string(),
    currentPerception: z.string(),
    potentialShift: z.string(),
    requiredAction: z.string(),
  })).max(3).describe('반전 가능 프레임'),
  battlefieldSummary: z.string(),
});

export type FrameWarResult = z.infer<typeof FrameWarSchema>;
