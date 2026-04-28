import { SIGNAL_TYPES } from '../../db/schema/manipulation';
import { clamp } from './utils/stats';
import type { SignalResult, SignalType, DomainConfig } from './types';

export type AggregateResult = {
  manipulationScore: number;
  confidenceFactor: number;
  signalScores: Record<SignalType, number>;
};

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
  let confN = 0;
  const signalScores: Record<SignalType, number> = {} as Record<SignalType, number>;

  for (const t of SIGNAL_TYPES) {
    const r = byType.get(t);
    const score = r?.score ?? 0;
    const conf = r?.confidence ?? 0;
    signalScores[t] = score;
    weighted += score * config.weights[t];
    confSum += conf;
    confN += 1;
  }

  const confidenceFactor = confN === 0 ? 0 : confSum / confN;
  const manipulationScore = clamp(weighted * confidenceFactor, 0, 100);

  return {
    manipulationScore,
    confidenceFactor,
    signalScores,
  };
}
