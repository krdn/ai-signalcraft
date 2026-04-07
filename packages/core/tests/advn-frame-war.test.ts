import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

describe('ADVN-02: FrameWarSchema', () => {
  it('유효한 데이터를 파싱할 수 있다', async () => {
    const { FrameWarSchema } = await import('../src/analysis/schemas/frame-war.schema');

    const validData = {
      dominantFrames: [
        {
          name: '경제 성과 프레임',
          description: '경제 지표 개선을 강조',
          strength: 75,
          supportingEvidence: ['GDP 성장률 보도', '고용 지표 개선 기사'],
        },
      ],
      threateningFrames: [
        {
          name: '도덕성 프레임',
          description: '윤리적 문제 제기',
          threatLevel: 'high' as const,
          counterStrategy: '투명성 강화 대응',
        },
      ],
      reversibleFrames: [
        {
          name: '세대 갈등 프레임',
          currentPerception: '기성세대 편향',
          potentialShift: '청년 정책 통한 반전',
          requiredAction: '청년 타겟 정책 발표',
        },
      ],
      battlefieldSummary: '경제 프레임이 지배적이나 도덕성 프레임의 위협이 증가 추세',
    };

    const result = FrameWarSchema.parse(validData);
    expect(result.dominantFrames).toHaveLength(1);
    expect(result.threateningFrames).toHaveLength(1);
    expect(result.reversibleFrames).toHaveLength(1);
  });

  it('battlefieldSummary가 빈 문자열이면 실패한다', async () => {
    const { FrameWarSchema } = await import('../src/analysis/schemas/frame-war.schema');

    expect(() =>
      FrameWarSchema.parse({
        dominantFrames: [
          { name: 'test', description: 'test', strength: 75, supportingEvidence: [] },
        ],
        threateningFrames: [],
        reversibleFrames: [],
        battlefieldSummary: '',
      }),
    ).toThrow(ZodError);
  });
});
