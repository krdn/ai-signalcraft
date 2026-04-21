import { sql } from 'drizzle-orm';
import { getDb } from '../index';

/**
 * 하이퍼테이블의 필수 UNIQUE INDEX 존재를 확인.
 *
 * raw_items에 `raw_items_dedup_uniq (source, source_id, item_type, time)`가 없으면
 * executor의 `ON CONFLICT (source, source_id, item_type, time) DO NOTHING`이
 * "there is no unique or exclusion constraint matching the ON CONFLICT specification"으로 실패하며
 * 모든 수집 run이 failed로 쌓인다 (2026-04-20 dcinside, 2026-04-21 이재명 구독 전체 소스 장애 사례).
 *
 * 운영 환경에서 `pnpm db:push` 뒤 `pnpm db:migrate-timescale`이 누락되는 사고가 반복되므로
 * 워커 부팅 시 이 검증으로 즉시 실패(exit 1)시켜 장애를 조기에 노출한다.
 */
export type HypertableVerificationResult = {
  ok: boolean;
  missing: string[];
};

const REQUIRED_UNIQUE_INDEXES = [
  {
    tableName: 'raw_items',
    indexName: 'raw_items_dedup_uniq',
    hint: 'ON CONFLICT (source, source_id, item_type, time) DO NOTHING',
  },
] as const;

export async function verifyHypertableConstraints(): Promise<HypertableVerificationResult> {
  const db = getDb();
  const missing: string[] = [];

  for (const { tableName, indexName, hint } of REQUIRED_UNIQUE_INDEXES) {
    const rows = await db.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = ${tableName} AND indexname = ${indexName}
    `);
    if (rows.rows.length === 0) {
      missing.push(`${tableName}.${indexName} (required for: ${hint})`);
    }
  }

  return { ok: missing.length === 0, missing };
}

/**
 * 부팅 단계에서 호출해 누락 시 프로세스를 종료.
 * `softFail=true`면 경고만 출력하고 진행(HTTP 서버처럼 읽기만 하는 프로세스용).
 */
export async function assertHypertableConstraints(options?: { softFail?: boolean }): Promise<void> {
  const { ok, missing } = await verifyHypertableConstraints();
  if (ok) return;

  const lines = [
    '[db-verify] ✗ hypertable UNIQUE INDEX missing:',
    ...missing.map((m) => `  - ${m}`),
    '  run: pnpm --filter @ai-signalcraft/collector db:migrate-timescale',
  ];
  const message = lines.join('\n');

  if (options?.softFail) {
    console.error(message);
    return;
  }
  console.error(message);
  process.exit(1);
}
