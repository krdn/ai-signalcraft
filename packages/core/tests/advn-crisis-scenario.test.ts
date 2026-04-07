import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

describe('ADVN-03: CrisisScenarioSchema', () => {
  it('유효한 데이터를 파싱할 수 있다 (3개 시나리오: spread/control/reverse)', async () => {
    const { CrisisScenarioSchema } = await import('@ai-signalcraft/insight-engine/schemas');

    const validData = {
      scenarios: [
        {
          type: 'spread' as const,
          name: '위기 확산 시나리오',
          probability: 30,
          triggerConditions: ['추가 폭로', '야당 공세 강화'],
          expectedOutcome: '지지율 10% 하락',
          responseStrategy: ['신속 대응팀 구성', '사실 관계 정리'],
          timeframe: '1~2주',
        },
        {
          type: 'control' as const,
          name: '위기 통제 시나리오',
          probability: 50,
          triggerConditions: ['미디어 관심 감소', '이슈 대체'],
          expectedOutcome: '현재 수준 유지',
          responseStrategy: ['적극 해명', '의제 전환'],
          timeframe: '2~4주',
        },
        {
          type: 'reverse' as const,
          name: '위기 역전 시나리오',
          probability: 20,
          triggerConditions: ['유리한 사실 확인', '여론 반전'],
          expectedOutcome: '지지율 5% 반등',
          responseStrategy: ['적극 공세', '성과 홍보'],
          timeframe: '3~6주',
        },
      ],
      currentRiskLevel: 'medium' as const,
      recommendedAction: '현재 통제 시나리오에 집중하되 확산 대비 필요',
    };

    const result = CrisisScenarioSchema.parse(validData);
    expect(result.scenarios).toHaveLength(3);
    expect(result.scenarios[0].type).toBe('spread');
    expect(result.scenarios[1].type).toBe('control');
    expect(result.scenarios[2].type).toBe('reverse');
  });

  it('currentRiskLevel이 유효하지 않은 enum이면 실패한다', async () => {
    const { CrisisScenarioSchema } = await import('@ai-signalcraft/insight-engine/schemas');

    expect(() =>
      CrisisScenarioSchema.parse({
        scenarios: [
          {
            type: 'spread',
            name: 'test',
            probability: 30,
            triggerConditions: [],
            expectedOutcome: 'test',
            responseStrategy: [],
            timeframe: '1주',
          },
        ],
        currentRiskLevel: 'invalid',
        recommendedAction: 'test',
      }),
    ).toThrow(ZodError);
  });
});
