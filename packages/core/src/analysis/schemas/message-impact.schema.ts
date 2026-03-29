import { z } from 'zod';

// 모듈4: 메시지 효과 분석 스키마 (DEEP-02)
export const MessageImpactSchema = z.object({
  successMessages: z.array(z.object({
    content: z.string().describe('실제 발언 또는 기사 제목 인용'),
    source: z.string().describe('출처 플랫폼명'),
    impactScore: z.number().int().min(1).max(10).describe('영향력 점수 1~10'),
    reason: z.string().describe('긍정 반응 유발 이유'),
    spreadType: z.string().describe('확산 유형'),
  })).min(1).describe('긍정 반응을 유발한 성공 메시지 목록'),
  failureMessages: z.array(z.object({
    content: z.string().describe('실제 발언 또는 기사 제목 인용'),
    source: z.string().describe('출처 플랫폼명'),
    negativeScore: z.number().int().min(1).max(10).describe('부정 점수 1~10'),
    reason: z.string().describe('부정 반응 유발 이유'),
    damageType: z.string().describe('피해 유형'),
  })).min(1).describe('부정 반응을 유발한 실패 메시지 목록'),
  highSpreadContentTypes: z.array(z.object({
    type: z.string().describe('콘텐츠 유형명'),
    description: z.string().describe('해당 유형 설명'),
    exampleCount: z.number().int().min(0).describe('사례 수'),
  })).min(1).describe('확산력 높은 콘텐츠 유형 목록'),
});

export type MessageImpactResult = z.infer<typeof MessageImpactSchema>;
