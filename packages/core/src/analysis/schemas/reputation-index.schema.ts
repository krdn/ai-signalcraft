import { z } from 'zod';

// PR/기업 도메인 Stage 4: 브랜드/기관 평판 지수 스키마
export const ReputationIndexSchema = z.object({
  overallScore: z.number().min(0).max(100).catch(50).describe('종합 평판 지수 (0=최저, 100=최고)'),
  trend: z.enum(['improving', 'stable', 'declining']).catch('stable').describe('평판 추세'),
  dimensions: z
    .array(
      z.object({
        dimension: z.string().catch('').describe('평판 차원 (예: 제품/서비스, 리더십, ESG 등)'),
        score: z.number().min(0).max(100).catch(50),
        trend: z.enum(['improving', 'stable', 'declining']).catch('stable'),
        keyFindings: z.string().catch('').describe('해당 차원의 핵심 발견'),
        evidences: z.array(z.string()).default([]).describe('근거 데이터 요약'),
      }),
    )
    .default([])
    .describe('차원별 평판 점수 (RepTrak 모델 기반)'),
  stakeholderPerceptions: z
    .array(
      z.object({
        stakeholder: z.string().catch('').describe('이해관계자 집단'),
        sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).catch('neutral'),
        keyConcerns: z.array(z.string()).default([]),
        keyStrengths: z.array(z.string()).default([]),
      }),
    )
    .default([])
    .describe('이해관계자별 인식'),
  reputationGaps: z
    .array(
      z.object({
        gap: z.string().catch('').describe('평판 취약 지점'),
        severity: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
        recommendation: z.string().catch('').describe('개선 권고 사항'),
      }),
    )
    .default([])
    .describe('평판 취약 지점 및 개선 필요 영역'),
  benchmarkContext: z.string().catch('').describe('업계 평균 대비 위치 또는 이전 기간 대비 변화'),
  summary: z.string().catch('').describe('평판 지수 종합 요약'),
});

export type ReputationIndexResult = z.infer<typeof ReputationIndexSchema>;
