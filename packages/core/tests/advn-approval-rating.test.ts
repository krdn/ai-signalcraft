import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

describe('ADVN-01: ApprovalRatingSchema', () => {
  it('유효한 데이터를 파싱할 수 있다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas');

    const validData = {
      estimatedRange: { min: 35, max: 42 },
      confidence: 'medium' as const,
      methodology: {
        sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
        platformBiasCorrection: [
          { platform: '네이버 뉴스', biasDirection: 'right' as const, correctionFactor: 0.85 },
          { platform: '유튜브', biasDirection: 'left' as const, correctionFactor: 1.1 },
        ],
        spreadFactor: 0.7,
      },
      disclaimer: '이 추정치는 AI 분석 기반 참고용이며, 과학적 여론조사를 대체하지 않습니다.',
      reasoning: '긍정 감정 비율 40%와 플랫폼 편향 보정을 적용하여 범위를 산출했습니다.',
    };

    const result = ApprovalRatingSchema.parse(validData);
    expect(result.estimatedRange.min).toBe(35);
    expect(result.estimatedRange.max).toBe(42);
  });

  it('estimatedRange.min/max가 number가 아니면 실패한다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas');

    expect(() =>
      ApprovalRatingSchema.parse({
        estimatedRange: { min: 'invalid', max: 42 },
        confidence: 'medium',
        methodology: {
          sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
          platformBiasCorrection: [],
          spreadFactor: 0.7,
        },
        disclaimer: '면책 문구',
        reasoning: '이유',
      }),
    ).toThrow(ZodError);
  });

  it('estimatedRange 객체가 필수이다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas');

    expect(() =>
      ApprovalRatingSchema.parse({
        confidence: 'medium',
        methodology: {
          sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
          platformBiasCorrection: [],
          spreadFactor: 0.7,
        },
        disclaimer: '면책 문구',
        reasoning: '이유',
      }),
    ).toThrow(ZodError);
  });

  it('confidence 필드가 high|medium|low enum이다', async () => {
    const { ApprovalRatingSchema } = await import('../src/analysis/schemas');

    expect(() =>
      ApprovalRatingSchema.parse({
        estimatedRange: { min: 35, max: 42 },
        confidence: 'invalid',
        methodology: {
          sentimentRatio: { positive: 0.4, neutral: 0.3, negative: 0.3 },
          platformBiasCorrection: [],
          spreadFactor: 0.7,
        },
        disclaimer: '면책 문구',
        reasoning: '이유',
      }),
    ).toThrow(ZodError);
  });
});
