/**
 * 배포 성공 후 draft release 를 published 로 전환.
 *
 * 사용: tsx scripts/publish-release.ts --gh-sha <sha>
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../src/db';
import { releases } from '../src/db/schema';

function parseArgs(): { ghSha: string } {
  const args = process.argv.slice(2);
  const i = args.indexOf('--gh-sha');
  const ghSha = i >= 0 ? args[i + 1] : undefined;
  if (!ghSha) throw new Error('Missing required arg: --gh-sha');
  return { ghSha };
}

async function main() {
  const { ghSha } = parseArgs();
  const db = getDb();

  const [updated] = await db
    .update(releases)
    .set({ status: 'published', publishedAt: new Date() })
    .where(and(eq(releases.gitShaTo, ghSha), eq(releases.status, 'draft')))
    .returning({ id: releases.id, version: releases.version });

  if (!updated) {
    console.warn(`[publish-release] No draft release found for ${ghSha}`);
    process.exit(0);
  }

  console.warn(`[publish-release] Published ${updated.version} (id=${updated.id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[publish-release] error:', err);
  process.exit(0);
});
