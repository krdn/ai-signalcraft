/**
 * 단일 모듈 재실행 — Job N의 macro-view만 다시 돌려 결과를 analysis_results에 UPSERT.
 *
 * 사용:
 *   cd packages/core
 *   set -a; source ../../apps/web/.env.local; set +a
 *   AIS_MODULE_CACHE=off pnpm exec tsx scripts/rerun-macro-view.ts <jobId>
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { collectionJobs } from '../src/db/schema';
import {
  loadAnalysisInput,
  loadAnalysisInputViaCollector,
  shouldUseCollectorLoader,
} from '../src/analysis/data-loader';
import { runModule } from '../src/analysis/runner';
import { macroViewModule } from '../src/analysis/modules/macro-view';

async function main() {
  const jobIdArg = process.argv[2];
  if (!jobIdArg) {
    console.error('usage: rerun-macro-view.ts <jobId>');
    process.exit(2);
  }
  const jobId = Number(jobIdArg);
  if (!Number.isFinite(jobId)) {
    console.error('jobId must be numeric');
    process.exit(2);
  }

  const db = getDb();
  const [job] = await db.select().from(collectionJobs).where(eq(collectionJobs.id, jobId)).limit(1);
  if (!job) {
    console.error(`job ${jobId} not found`);
    process.exit(1);
  }
  console.log(`[rerun] job=${jobId} keyword=${job.keyword} status=${job.status}`);

  const jobOptions = (job.options as Record<string, unknown>) || {};
  const isCollectorPath = Boolean(jobOptions.useCollectorLoader) || shouldUseCollectorLoader();
  console.log(`[rerun] loader=${isCollectorPath ? 'collector' : 'legacy'}`);

  const loadResult = isCollectorPath
    ? await loadAnalysisInputViaCollector(jobId)
    : await loadAnalysisInput(jobId);
  const input = loadResult.input;
  console.log(
    `[rerun] input articles=${input.articles.length} videos=${input.videos.length} comments=${input.comments.length}`,
  );

  const result = await runModule(macroViewModule, input);
  console.log(`[rerun] result status=${result.status}`);
  if (result.status === 'failed') {
    console.error(`[rerun] error: ${result.errorMessage}`);
    process.exit(1);
  }
  if (result.usage) {
    console.log(
      `[rerun] usage input=${result.usage.inputTokens} output=${result.usage.outputTokens} total=${result.usage.totalTokens}`,
    );
  }
}

main().catch((err) => {
  console.error('[rerun] fatal:', err);
  process.exit(1);
});
