import { z } from 'zod';

export const MediaFramingDominanceSchema = z.object({
  dominantFrame: z.string().catch('').describe('지배적 미디어 프레임 명칭'),
  dominantFrameScore: z.number().min(0).max(100).catch(0).describe('지배적 프레임 점수 (0~100)'),
  frames: z
    .array(
      z.object({
        frameName: z.string().catch(''),
        frameType: z
          .enum(['diagnostic', 'prognostic', 'motivational'])
          .catch('diagnostic')
          .describe(
            'Entman 프레임 유형: diagnostic=문제정의, prognostic=해결방향, motivational=행동촉구',
          ),
        dominanceScore: z.number().min(0).max(100).catch(0),
        mediaOutlets: z.array(z.string()).default([]).describe('이 프레임을 주로 사용하는 미디어'),
        sampleHeadlines: z.array(z.string()).default([]),
        agendaSettingImpact: z
          .enum(['high', 'medium', 'low'])
          .catch('medium')
          .describe('의제설정 영향력 (McCombs & Shaw)'),
      }),
    )
    .default([]),
  frameContestLevel: z
    .enum(['dominant', 'contested', 'fragmented'])
    .catch('contested')
    .describe('프레임 경합 수준: dominant=단일지배, contested=경합, fragmented=분산'),
  frameShiftRisk: z
    .number()
    .min(0)
    .max(100)
    .catch(0)
    .describe('프레임 전환 위험도 — 현재 프레임이 부정으로 역전될 확률'),
  corporateNarrativeGap: z
    .string()
    .catch('')
    .describe('기업 공식 서사와 미디어 프레임 간 간극 요약'),
  recommendation: z.string().catch('').describe('프레임 관리 권고사항'),
  summary: z.string().catch(''),
});

export type MediaFramingDominanceResult = z.infer<typeof MediaFramingDominanceSchema>;
