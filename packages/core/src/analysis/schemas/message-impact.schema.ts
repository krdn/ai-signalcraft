import { z } from 'zod';

// 모듈4: 메시지 효과 분석 스키마 (DEEP-02)
// NOTE: .min()/.max()/.int() 제약은 Gemini structured output에서 누락됨
// (Google provider의 convertJSONSchemaToOpenAPISchema가 minimum/maximum/minItems를 전달하지 않음)
// 제약 조건은 .describe() 텍스트로만 전달하여 Gemini 호환성 보장
export const MessageImpactSchema = z.object({
  successMessages: z
    .array(
      z.object({
        content: z.string().describe('실제 발언 또는 기사 제목 인용'),
        source: z.string().describe('출처 플랫폼명'),
        impactScore: z.number().catch(0).describe('영향력 점수 1~10 정수'),
        reason: z.string().describe('긍정 반응 유발 이유'),
        spreadType: z.string().describe('확산 유형'),
      }),
    )
    .describe('긍정 반응을 유발한 성공 메시지 목록 (최소 1개)'),
  failureMessages: z
    .array(
      z.object({
        content: z.string().describe('실제 발언 또는 기사 제목 인용'),
        source: z.string().describe('출처 플랫폼명'),
        negativeScore: z.number().catch(0).describe('부정 점수 1~10 정수'),
        reason: z.string().describe('부정 반응 유발 이유'),
        damageType: z.string().describe('피해 유형'),
      }),
    )
    .describe('부정 반응을 유발한 실패 메시지 목록 (최소 1개)'),
  highSpreadContentTypes: z
    .array(
      z.object({
        type: z.string().describe('콘텐츠 유형명'),
        description: z.string().describe('해당 유형 설명'),
        exampleCount: z.number().describe('사례 수 (0 이상 정수)'),
      }),
    )
    .describe('확산력 높은 콘텐츠 유형 목록 (최소 1개)'),
});

export type MessageImpactResult = z.infer<typeof MessageImpactSchema>;
