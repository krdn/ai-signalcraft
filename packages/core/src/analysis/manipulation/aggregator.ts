import { SIGNAL_TYPES } from '../../db/schema/manipulation';
import { clamp } from './utils/stats';
import type { SignalResult, SignalType, DomainConfig } from './types';

export type AggregateResult = {
  manipulationScore: number;
  confidenceFactor: number;
  signalScores: Record<SignalType, number>;
};

/**
 * 7개 신호 결과를 단일 manipulation 점수로 집계.
 *
 * - 누락 신호: score=0, confidence=0 처리 → confidenceFactor 희석 패널티
 *   (예: 3개만 들어오면 confidenceFactor = 3/7 ≈ 0.43)
 * - weighted = Σ(score × weight). weights 합이 1이 아니면 그대로 반영
 * - manipulationScore = clamp(weighted × confidenceFactor, 0, 100)
 * - signalScores: SIGNAL_TYPES 모든 키 보장 (Task 14 persist 의존)
 */
export function aggregate(signals: SignalResult[], config: DomainConfig): AggregateResult {
  for (const t of SIGNAL_TYPES) {
    if (typeof config.weights[t] !== 'number') {
      throw new Error(`aggregate: 가중치 누락 신호 ${t}`);
    }
  }

  const byType = new Map<SignalType, SignalResult>();
  for (const s of signals) byType.set(s.signal, s);

  let weighted = 0;
  let confSum = 0;
  const signalScores = Object.fromEntries(SIGNAL_TYPES.map((t) => [t, 0])) as Record<
    SignalType,
    number
  >;

  for (const t of SIGNAL_TYPES) {
    const r = byType.get(t);
    const score = r?.score ?? 0;
    const conf = r?.confidence ?? 0;
    signalScores[t] = score;
    weighted += score * config.weights[t];
    confSum += conf;
  }

  const confidenceFactor = confSum / SIGNAL_TYPES.length;
  const manipulationScore = clamp(weighted * confidenceFactor, 0, 100);

  return {
    manipulationScore,
    confidenceFactor,
    signalScores,
  };
}
