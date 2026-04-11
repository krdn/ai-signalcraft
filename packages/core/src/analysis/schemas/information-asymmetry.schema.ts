import { z } from 'zod';

// 금융 도메인 Stage 4: 정보 비대칭 분석 스키마 (Information Cascade Theory 기반)
export const InformationAsymmetrySchema = z.object({
  asymmetryLevel: z
    .enum(['high', 'medium', 'low'])
    .catch('medium')
    .describe('정보 비대칭 수준 (기관 vs 개인 투자자 간 정보 격차)'),
  informationCascades: z
    .array(
      z.object({
        cascade: z.string().catch('').describe('정보 폭포 현상 설명'),
        origin: z.string().catch('').describe('정보 폭포 시작점 (플랫폼/집단)'),
        spreadPath: z.string().catch('').describe('확산 경로'),
        magnitude: z.enum(['high', 'medium', 'low']).catch('medium'),
      }),
    )
    .default([])
    .describe('식별된 정보 폭포 현상'),
  leadingIndicators: z
    .array(
      z.object({
        indicator: z
          .string()
          .catch('')
          .describe('선행 지표 (일반 뉴스 반영 전에 나타난 여론 신호)'),
        platform: z.string().catch('').describe('최초 발화 플랫폼'),
        significance: z.enum(['high', 'medium', 'low']).catch('medium'),
        lagTime: z.string().catch('').describe('주류 미디어/시장 반영까지 예상 시간'),
      }),
    )
    .default([])
    .describe('선행 지표 목록 (정보 비대칭 활용 신호)'),
  informationVacuums: z
    .array(
      z.object({
        vacuum: z.string().catch('').describe('정보 공백 영역 (소문·루머가 채우는 영역)'),
        rumorRisk: z.enum(['high', 'medium', 'low']).catch('medium'),
        fillRecommendation: z.string().catch('').describe('공식 정보로 채워야 할 내용'),
      }),
    )
    .default([])
    .describe('정보 공백 및 루머 위험 영역'),
  smartMoneySignals: z
    .array(z.string())
    .default([])
    .describe('정보력 우위 투자자(기관)의 행동 신호 (역방향 포지션 등)'),
  disclaimer: z
    .string()
    .catch('이 분석은 투자 자문이 아닙니다. 시장 여론 참고 자료입니다.')
    .describe('면책 문구'),
  summary: z.string().catch('').describe('정보 비대칭 분석 종합 요약'),
});

export type InformationAsymmetryResult = z.infer<typeof InformationAsymmetrySchema>;
