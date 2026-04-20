import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from '../db';
import { rawItems } from '../db/schema';

/**
 * raw_items에 누적된 중복 행 정리 CLI.
 *
 * 중복 기준: (source, source_id, item_type)이 같은 여러 행.
 * 정책: fetched_at이 가장 이른 행만 남기고 나머지 DELETE.
 *
 * 사용법:
 *   pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts --dry-run
 *   pnpm --filter @ai-signalcraft/collector exec tsx src/scripts/dedup-raw-items.ts
 *
 * 압축된 TimescaleDB 청크의 행은 DELETE가 실패할 수 있다(제약).
 * 이 경우 에러 로그만 남기고 다음 그룹으로 진행한다.
 */

type DupGroup = {
  source: string;
  sourceId: string;
  itemType: string;
  cnt: number;
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = getDb();

  console.warn(`[dedup] mode=${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);

  const groupsRaw = await db.execute(sql`
    SELECT source, source_id AS "sourceId", item_type AS "itemType", COUNT(*)::int AS cnt
    FROM raw_items
    GROUP BY source, source_id, item_type
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 1000
  `);
  const groups = groupsRaw.rows as unknown as DupGroup[];

  if (groups.length === 0) {
    console.warn('[dedup] 중복 그룹 없음. 종료.');
    return;
  }

  const totalExtraRows = groups.reduce((s, g) => s + (g.cnt - 1), 0);
  console.warn(`[dedup] 중복 그룹 ${groups.length}개, 삭제 대상 행 ${totalExtraRows}개`);
  console.warn('[dedup] 상위 5개 그룹:');
  for (const g of groups.slice(0, 5)) {
    console.warn(`  - ${g.source} / ${g.itemType} / ${g.sourceId}: ${g.cnt}건`);
  }

  if (groups.length === 1000) {
    console.warn('[dedup] 경고: 1000개 상한 도달. 잔여 중복이 있을 수 있음. 완료 후 재실행 필요.');
  }

  if (dryRun) {
    console.warn('[dedup] dry-run 종료. 실제 삭제하려면 --dry-run 플래그 없이 실행.');
    return;
  }

  let deleted = 0;
  let failed = 0;

  for (const g of groups) {
    try {
      // TimescaleDB 압축 청크는 ctid 접근을 거부하므로 자연 복합키로 삭제.
      // MIN(time) 한 행만 남기고 나머지 time 값들을 DELETE.
      const res = await db.execute(sql`
        DELETE FROM ${rawItems}
        WHERE source = ${g.source}
          AND source_id = ${g.sourceId}
          AND item_type = ${g.itemType}
          AND time > (
            SELECT MIN(time) FROM ${rawItems}
            WHERE source = ${g.source}
              AND source_id = ${g.sourceId}
              AND item_type = ${g.itemType}
          )
      `);
      const rowCount = (res as unknown as { rowCount?: number }).rowCount ?? 0;
      deleted += rowCount;
    } catch (err) {
      failed++;
      console.warn(
        `[dedup] 삭제 실패 ${g.source}/${g.itemType}/${g.sourceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  console.warn(`[dedup] 완료. 삭제 ${deleted}개, 실패 그룹 ${failed}개.`);

  if (failed > 0 && deleted === 0) {
    console.error('[dedup] 모든 그룹 실패. 연결 또는 권한 문제를 확인하세요.');
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('[dedup] fatal:', err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
