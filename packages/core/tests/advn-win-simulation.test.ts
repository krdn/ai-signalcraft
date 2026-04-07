import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';

describe('ADVN-04: WinSimulationSchema', () => {
  it('유효한 데이터를 파싱할 수 있다', async () => {
    const { WinSimulationSchema } = await import('@ai-signalcraft/insight-engine/schemas');

    const validData = {
      winProbability: 55,
      confidenceLevel: 'medium' as const,
      winConditions: [
        {
          condition: '경제 지표 개선 지속',
          currentStatus: 'partial' as const,
          importance: 'critical' as const,
        },
        {
          condition: '청년 정책 호응',
          currentStatus: 'unmet' as const,
          importance: 'high' as const,
        },
        {
          condition: '중도층 확보',
          currentStatus: 'partial' as const,
          importance: 'critical' as const,
        },
      ],
      loseConditions: [
        {
          condition: '추가 스캔들 발생',
          currentRisk: 'medium' as const,
          mitigation: '위기 대응 체계 강화',
        },
        { condition: '경제 악화', currentRisk: 'low' as const, mitigation: '경제 성과 지속 홍보' },
      ],
      keyStrategies: [
        { strategy: '중도층 타겟 메시지', expectedImpact: '지지율 3~5% 상승', priority: 1 },
        { strategy: '청년 정책 패키지', expectedImpact: '2030 지지율 개선', priority: 2 },
        { strategy: '경제 성과 홍보', expectedImpact: '이탈 방지', priority: 3 },
      ],
      simulationSummary: '현재 승리 확률 55%로 경합 상태. 중도층 확보가 핵심 변수.',
    };

    const result = WinSimulationSchema.parse(validData);
    expect(result.winProbability).toBe(55);
    expect(result.winConditions.length).toBeGreaterThanOrEqual(3);
    expect(result.loseConditions.length).toBeGreaterThanOrEqual(2);
  });

  it('winProbability가 number가 아니면 실패한다', async () => {
    const { WinSimulationSchema } = await import('@ai-signalcraft/insight-engine/schemas');

    expect(() =>
      WinSimulationSchema.parse({
        winProbability: 'invalid',
        confidenceLevel: 'medium',
        winConditions: [],
        loseConditions: [],
        keyStrategies: [],
        simulationSummary: 'test',
      }),
    ).toThrow(ZodError);
  });

  it('confidenceLevel이 유효하지 않은 enum이면 실패한다', async () => {
    const { WinSimulationSchema } = await import('@ai-signalcraft/insight-engine/schemas');

    expect(() =>
      WinSimulationSchema.parse({
        winProbability: 50,
        confidenceLevel: 'invalid',
        winConditions: [],
        loseConditions: [],
        keyStrategies: [],
        simulationSummary: 'test',
      }),
    ).toThrow(ZodError);
  });
});
