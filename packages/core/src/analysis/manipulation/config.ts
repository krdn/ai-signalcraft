import { eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { manipulationDomainConfigs, SIGNAL_TYPES } from '../../db/schema/manipulation';
import type { DomainConfig, DomainWeights, DomainThresholds } from './types';

/**
 * domain 이름으로 manipulation_domain_configs 조회 → DomainConfig 변환.
 * 없으면 'political' 기본 도메인으로 폴백 (Phase 1 seed 보장).
 */
export async function resolveDomainConfig(domain: string): Promise<DomainConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(manipulationDomainConfigs)
    .where(eq(manipulationDomainConfigs.domain, domain))
    .limit(1);

  if (!row) {
    if (domain === 'political') {
      throw new Error(
        'manipulation_domain_configs: political 시드가 없습니다. pnpm seed:manipulation-configs 실행 필요',
      );
    }
    return resolveDomainConfig('political');
  }

  return {
    domain: row.domain,
    weights: row.weights as DomainWeights,
    thresholds: row.thresholds as DomainThresholds,
    baselineDays: row.baselineDays,
    narrativeContext: row.narrativeContext,
  };
}

export const REQUIRED_SIGNAL_KEYS = SIGNAL_TYPES;
