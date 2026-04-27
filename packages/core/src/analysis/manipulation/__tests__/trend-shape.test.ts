import { describe, it, expect } from 'vitest';
import { computeTrendShape } from '../signals/trend-shape';

describe('trend-shape signal', () => {
  it('자연 확산 (점진 상승 후 감소) 은 낮은 점수', () => {
    // 가우시안 모양: 1,2,4,7,10,12,10,7,4,2,1
    const series = [1, 2, 4, 7, 10, 12, 10, 7, 4, 2, 1].map((count, i) => ({
      ts: new Date(2026, 3, 27, i).toISOString(),
      count,
    }));
    const result = computeTrendShape(series);
    expect(result.score).toBeLessThan(45);
  });

  it('계단형 점프 (평평→급등→고원) 는 높은 점수', () => {
    const series = [1, 1, 1, 1, 1, 50, 52, 51, 49, 50, 1, 1, 1].map((count, i) => ({
      ts: new Date(2026, 3, 27, i).toISOString(),
      count,
    }));
    const result = computeTrendShape(series);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.metrics.jumpRatio).toBeGreaterThanOrEqual(20);
  });

  it('짧은 시리즈는 confidence 낮음', () => {
    const series = [{ ts: new Date().toISOString(), count: 5 }];
    const result = computeTrendShape(series);
    expect(result.confidence).toBeLessThan(0.3);
  });
});
