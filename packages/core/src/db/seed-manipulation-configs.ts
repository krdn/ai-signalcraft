// packages/core/src/db/seed-manipulation-configs.ts
import { resolve } from 'path';
import { config } from 'dotenv';
import { findMonorepoRoot } from '../queue/worker-config';
import { getDb } from '../db';
import { manipulationDomainConfigs } from './schema/manipulation';

// dotenv 로드 — apps/web/.env.local → .env 순서 (getDb() 호출 전 env 설정)
const root = findMonorepoRoot(process.cwd());
config({ path: resolve(root, 'apps/web/.env.local'), override: true });
config({ path: resolve(root, '.env') });

const POLITICAL_WEIGHTS = {
  burst: 0.18,
  similarity: 0.22,
  vote: 0.14,
  'media-sync': 0.16,
  'trend-shape': 0.1,
  'cross-platform': 0.12,
  temporal: 0.08,
} as const;

const POLITICAL_THRESHOLDS = {
  burst: { medium: 50, high: 70 },
  similarity: { medium: 55, high: 75 },
  vote: { medium: 50, high: 70 },
  'media-sync': { medium: 50, high: 65 },
  'trend-shape': { medium: 50, high: 70 },
  'cross-platform': { medium: 50, high: 70 },
  temporal: { medium: 50, high: 70 },
} as const;

const NARRATIVE_CONTEXT =
  '정치 도메인. 매체 동조화·크로스 플랫폼 캐스케이드를 강조한다. 단정적 표현 금지, 관찰된 패턴만 기술.';

async function seed() {
  const db = getDb();

  await db
    .insert(manipulationDomainConfigs)
    .values({
      domain: 'political',
      weights: POLITICAL_WEIGHTS,
      thresholds: POLITICAL_THRESHOLDS,
      baselineDays: 30,
      narrativeContext: NARRATIVE_CONTEXT,
    })
    .onConflictDoUpdate({
      target: manipulationDomainConfigs.domain,
      set: {
        weights: POLITICAL_WEIGHTS,
        thresholds: POLITICAL_THRESHOLDS,
        baselineDays: 30,
        narrativeContext: NARRATIVE_CONTEXT,
        updatedAt: new Date(),
      },
    });

  // eslint-disable-next-line no-console
  console.log('[seed-manipulation-configs] political 도메인 설정 적용 완료');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seed-manipulation-configs] 실패:', err);
  process.exit(1);
});
