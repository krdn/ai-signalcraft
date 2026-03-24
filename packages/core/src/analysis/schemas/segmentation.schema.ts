import { z } from 'zod';

// 모듈2: 집단별 반응 분석 스키마 (ANLZ-04)
export const SegmentationSchema = z.object({
  platformSegments: z.array(z.object({
    platform: z.string(),
    sentiment: z.enum(['positive', 'negative', 'mixed']),
    keyTopics: z.array(z.string()),
    volume: z.number(),
    characteristics: z.string(),
  })).describe('플랫폼별 반응 세분화'),
  audienceGroups: z.array(z.object({
    groupName: z.string(),
    type: z.enum(['core', 'opposition', 'swing']),
    characteristics: z.string(),
    sentiment: z.enum(['positive', 'negative', 'mixed']),
    influence: z.enum(['high', 'medium', 'low']),
  })).describe('집단별 반응 (Core/Opposition/Swing)'),
  highInfluenceGroup: z.object({
    name: z.string(),
    reason: z.string(),
  }).describe('가장 영향력 높은 집단'),
});

export type SegmentationResult = z.infer<typeof SegmentationSchema>;
