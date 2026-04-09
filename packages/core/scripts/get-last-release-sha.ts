/**
 * 가장 최근 release의 gitShaTo 출력 (stdout).
 * 없으면 기준 커밋(251ae56) 출력.
 *
 * 사용: tsx scripts/get-last-release-sha.ts
 */
import 'dotenv/config';
import { desc } from 'drizzle-orm';
import { getDb } from '../src/db';
import { releases } from '../src/db/schema';

const BASELINE_SHA = '251ae56';

async function main() {
  const db = getDb();
  const [latest] = await db
    .select({ gitShaTo: releases.gitShaTo })
    .from(releases)
    .orderBy(desc(releases.deployedAt))
    .limit(1);

  process.stdout.write(latest?.gitShaTo ?? BASELINE_SHA);
  process.exit(0);
}

main().catch((err) => {
  console.error('[get-last-release-sha] error:', err);
  // 실패 시에도 기준 커밋 출력하여 배포 파이프라인 보호
  process.stdout.write(BASELINE_SHA);
  process.exit(0);
});
