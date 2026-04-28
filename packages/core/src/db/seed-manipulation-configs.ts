// packages/core/src/db/seed-manipulation-configs.ts
import { resolve } from 'path';
import { config } from 'dotenv';
import { findMonorepoRoot } from '../queue/worker-config';
import { getDb } from '../db';
import { manipulationDomainConfigs } from './schema/manipulation';
import type { SignalType } from './schema/manipulation';

// dotenv 로드 — apps/web/.env.local → .env 순서 (getDb() 호출 전 env 설정)
const root = findMonorepoRoot(process.cwd());
config({ path: resolve(root, 'apps/web/.env.local'), override: true });
config({ path: resolve(root, '.env') });

// satisfies 가드: SIGNAL_TYPES에 새 키가 추가되면 컴파일 에러로 누락 알림
const POLITICAL_WEIGHTS = {
  burst: 0.18,
  similarity: 0.22,
  vote: 0.14,
  'media-sync': 0.16,
  'trend-shape': 0.1,
  'cross-platform': 0.12,
  temporal: 0.08,
} as const satisfies Record<SignalType, number>;

const POLITICAL_THRESHOLDS = {
  burst: { medium: 50, high: 70 },
  similarity: { medium: 55, high: 75 },
  vote: { medium: 50, high: 70 },
  'media-sync': { medium: 50, high: 65 },
  'trend-shape': { medium: 50, high: 70 },
  'cross-platform': { medium: 50, high: 70 },
  temporal: { medium: 50, high: 70 },
} as const satisfies Record<SignalType, { medium: number; high: number }>;

const NARRATIVE_CONTEXT =
  '정치 도메인. 매체 동조화·크로스 플랫폼 캐스케이드를 강조한다. 단정적 표현 금지, 관찰된 패턴만 기술.';

// 공유 config — values()/set() 분기 위험 제거
const POLITICAL_CONFIG = {
  weights: POLITICAL_WEIGHTS,
  thresholds: POLITICAL_THRESHOLDS,
  baselineDays: 30,
  narrativeContext: NARRATIVE_CONTEXT,
} as const;

async function seed() {
  const db = getDb();

  await db
    .insert(manipulationDomainConfigs)
    .values({ domain: 'political', ...POLITICAL_CONFIG })
    .onConflictDoUpdate({
      target: manipulationDomainConfigs.domain,
      set: { ...POLITICAL_CONFIG, updatedAt: new Date() },
    });
}

seed()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('[seed-manipulation-configs] political 도메인 설정 적용 완료');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[seed-manipulation-configs] 실패:', err);
    process.exit(1);
  });
