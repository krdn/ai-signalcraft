import { z } from 'zod';

// 모듈2: 집단별 반응 분석 스키마 (ANLZ-04)
export const SegmentationSchema = z.object({
  platformSegments: z
    .array(
      z.object({
        platform: z.string().catch(''),
        sentiment: z.enum(['positive', 'negative', 'mixed']).catch('mixed'),
        keyTopics: z.array(z.string()).default([]),
        volume: z.number().catch(0),
        characteristics: z.string().catch(''),
      }),
    )
    .default([])
    .describe('플랫폼별 반응 세분화'),
  audienceGroups: z
    .array(
      z.object({
        groupName: z.string().catch(''),
        // z.string()으로 완화: 도메인별 집단 타입이 다름 (정치: core/opposition/swing,
        // 팬덤: core-fan/casual-fan/anti-fan/general-public, PR: advocates/critics/neutrals/media 등)
        // 기존 z.enum(['core','opposition','swing'])은 다른 도메인 결과를 모두 'swing'으로 강제 변환하는 버그 유발
        type: z.string().catch('swing'),
        characteristics: z.string().catch(''),
        sentiment: z.enum(['positive', 'negative', 'mixed']).catch('mixed'),
        influence: z.enum(['high', 'medium', 'low']).catch('medium'),
      }),
    )
    .default([])
    .describe('집단별 반응 (Core/Opposition/Swing)'),
  highInfluenceGroup: z
    .object({
      name: z.string().catch('미확인'),
      reason: z.string().catch('데이터 부족'),
    })
    .catch({ name: '미확인', reason: '데이터 부족' })
    .describe('가장 영향력 높은 집단'),
});

export type SegmentationResult = z.infer<typeof SegmentationSchema>;

/** 도메인별 허용 집단 타입 (AI 프롬프트 및 UI 검증용) */
export const SEGMENT_TYPES_BY_DOMAIN: Record<string, string[]> = {
  political: ['core', 'opposition', 'swing'],
  fandom: ['core-fan', 'casual-fan', 'anti-fan', 'general-public'],
  pr: ['advocates', 'critics', 'neutrals', 'media'],
  corporate: ['investors', 'consumers', 'employees', 'regulators', 'media'],
  policy: ['supporters', 'skeptics', 'neutrals', 'experts'],
  finance: ['bulls', 'bears', 'swing-traders', 'retail', 'institutional'],
  healthcare: ['patients', 'caregivers', 'clinicians', 'policymakers', 'public'],
  'public-sector': ['residents', 'businesses', 'civil-society', 'media'],
  education: ['students', 'parents', 'faculty', 'employers', 'alumni'],
  sports: ['die-hard-fans', 'fair-weather-fans', 'anti-fans', 'casual-viewers'],
  legal: ['clients', 'opponents', 'judges-media', 'public'],
  retail: ['franchisees', 'consumers', 'competitors', 'regulators'],
};
