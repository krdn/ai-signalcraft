import { z } from 'zod';

// 팬덤 내러티브 경쟁 분석 결과 스키마
export const FandomNarrativeWarSchema = z.object({
  dominantNarratives: z
    .array(
      z.object({
        narrative: z
          .string()
          .describe('내러티브명 (예: "실력파 서사", "기획사 과실론", "비주얼 중심 프레임")'),
        description: z.string().describe('내러티브 상세 설명'),
        strength: z.number().describe('강도 0~100'),
        source: z.enum(['fans', 'anti-fans', 'media', 'general-public', 'company']),
        spreadPattern: z.string().describe('확산 패턴 (예: "팬 커뮤니티→일반 커뮤니티→언론")'),
      }),
    )
    .default([]),
  counterNarratives: z
    .array(
      z.object({
        narrative: z.string().describe('대응 내러티브명'),
        description: z.string().describe('상세 설명'),
        threatLevel: z.enum(['critical', 'high', 'medium', 'low']),
        originPlatform: z.string().describe('발원 플랫폼'),
      }),
    )
    .default([]),
  fanbaseRivalry: z.object({
    isActive: z.boolean().describe('팬덤 간 경쟁/갈등 활성화 여부'),
    rivalTargets: z.array(z.string()).default([]).describe('경쟁 팬덤/대상'),
    battlefronts: z
      .array(
        z.object({
          platform: z.string().describe('갈등 전장 플랫폼'),
          issue: z.string().describe('갈등 이슈'),
          currentStanding: z.enum(['winning', 'contested', 'losing']),
        }),
      )
      .default([]),
  }),
  battlefieldSummary: z.string().describe('전체 내러티브 전장 구도 요약'),
});

export type FandomNarrativeWarResult = z.infer<typeof FandomNarrativeWarSchema>;
