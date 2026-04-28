// packages/core/scripts/manipulation-dryrun.ts
// 내부 검증용 dryrun CLI — 외부 노출 없음.
// stub loader로 7개 신호를 모두 0점 처리해 manipulation_runs DB write path가
// 깨지지 않는지만 확인.
// --useReal --subscriptionId=N: 실제 collector 호출로 end-to-end 검증.
import { resolve } from 'path';
import { config as loadDotenv } from 'dotenv';
import { eq } from 'drizzle-orm';
import { findMonorepoRoot } from '../src/queue/worker-config';
import { getDb } from '../src/db';
import { manipulationDomainConfigs } from '../src/db/schema/manipulation';
import {
  runManipulationDetection,
  persistRun,
  type ManipulationDataLoader,
  type DomainConfig,
} from '../src/analysis/manipulation';

// dotenv 로드 — apps/web/.env.local → .env 순서 (getDb() 호출 전 env 설정)
// seed-manipulation-configs.ts 동일 패턴: worktree 환경에서도 .env 위치 정합성 확보
const root = findMonorepoRoot(process.cwd());
loadDotenv({ path: resolve(root, 'apps/web/.env.local'), override: true });
loadDotenv({ path: resolve(root, '.env') });

async function main() {
  const useReal = process.argv.includes('--useReal');
  const subscriptionIdArg = process.argv.find((a) => a.startsWith('--subscriptionId='));
  const subscriptionId = subscriptionIdArg ? Number(subscriptionIdArg.split('=')[1]) : null;

  const jobIdArg =
    process.argv.find((a) => a.startsWith('--jobId='))?.split('=')[1] ?? process.argv[2];
  const domainArg =
    process.argv.find((a) => a.startsWith('--domain='))?.split('=')[1] ??
    process.argv[3] ??
    'political';

  if (!jobIdArg) {
    console.error(
      '사용법: tsx scripts/manipulation-dryrun.ts --jobId=N [--domain=political] [--useReal --subscriptionId=N]',
    );
    process.exit(2);
  }
  const jobId = Number(jobIdArg);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    console.error(`jobId는 양의 정수여야 합니다: ${jobIdArg}`);
    process.exit(2);
  }

  if (useReal && (!subscriptionId || subscriptionId <= 0)) {
    console.error('--useReal 사용 시 --subscriptionId=N (양의 정수) 필수');
    process.exit(1);
  }

  const db = getDb();

  const cfgRows = await db
    .select()
    .from(manipulationDomainConfigs)
    .where(eq(manipulationDomainConfigs.domain, domainArg));
  if (cfgRows.length === 0) {
    console.error(`도메인 설정 없음: ${domainArg}. 먼저 db:seed-manipulation 실행`);
    process.exit(2);
  }
  const config: DomainConfig = {
    domain: cfgRows[0].domain,
    weights: cfgRows[0].weights,
    thresholds: cfgRows[0].thresholds,
    baselineDays: cfgRows[0].baselineDays,
    narrativeContext: cfgRows[0].narrativeContext,
  };

  let loader: ManipulationDataLoader;
  if (useReal) {
    const { createCollectorManipulationLoader } =
      await import('../src/analysis/manipulation/loaders/collector-loader');
    const { getCollectorClient } = await import('../src/collector-client');
    const dateRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };
    loader = createCollectorManipulationLoader({
      client: getCollectorClient(),
      subscriptionId: subscriptionId!,
      sources: [],
      dateRange,
      baselineDays: config.baselineDays,
    });
    console.log(`[dryrun] real collector loader (subscriptionId=${subscriptionId})`);
  } else {
    loader = {
      loadComments: async () => [],
      loadVotes: async () => [],
      loadEmbeddedComments: async () => [],
      loadEmbeddedArticles: async () => [],
      loadTrendSeries: async () => [],
      loadTemporalBaselines: async () => ({}),
    };
    console.log('[dryrun] empty mock loader');
  }

  const t0 = Date.now();
  const out = await runManipulationDetection({
    jobId,
    subscriptionId,
    config,
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    },
    loader,
  });

  const runId = await persistRun(db, {
    jobId,
    subscriptionId,
    output: out,
    weightsVersion: `v1-${cfgRows[0].domain}`,
  });

  const elapsed = Date.now() - t0;
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        runId,
        jobId,
        elapsedMs: elapsed,
        manipulationScore: out.aggregate.manipulationScore,
        confidenceFactor: out.aggregate.confidenceFactor,
        signalScores: out.aggregate.signalScores,
        signalCount: out.signals.length,
        evidenceCount: out.signals.reduce((n, s) => n + s.evidence.length, 0),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('[manipulation-dryrun] 실패:', err);
  process.exit(1);
});
