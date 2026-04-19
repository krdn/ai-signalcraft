import 'dotenv/config';
import pg from 'pg';

/**
 * TimescaleDB 전용 DDL 적용 스크립트.
 *
 * 실행 순서:
 *   1) pnpm --filter @ai-signalcraft/collector db:push  (Drizzle 스키마 → 일반 테이블 생성)
 *   2) pnpm --filter @ai-signalcraft/collector db:migrate-timescale  (이 스크립트)
 *
 * 동작:
 *   - TimescaleDB + pgvector 확장 생성
 *   - collection_runs, raw_items, fetch_errors 를 하이퍼테이블로 전환
 *   - 압축/보존 정책 설정
 *   - pgvector ivfflat 인덱스 생성
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    console.log('[timescale] CREATE EXTENSION timescaledb, vector');
    await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

    const hypertables = [
      { table: 'collection_runs', interval: '7 days' },
      { table: 'raw_items', interval: '30 days' },
      { table: 'fetch_errors', interval: '7 days' },
    ];

    for (const { table, interval } of hypertables) {
      console.log(`[timescale] create_hypertable(${table}, chunk=${interval})`);
      await client.query(
        `SELECT create_hypertable($1, 'time',
           chunk_time_interval => INTERVAL '${interval}',
           if_not_exists => TRUE,
           migrate_data => TRUE);`,
        [table],
      );
    }

    // raw_items: UNIQUE(source, source_id, item_type) — 하이퍼테이블은 UNIQUE가 시간 컬럼 포함 필요
    // 따라서 논리적 중복은 애플리케이션 레이어 + (source, source_id, item_type, time) 복합 인덱스로 해결
    console.log('[timescale] unique dedup index on raw_items');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS raw_items_dedup_uniq
      ON raw_items (source, source_id, item_type, time);
    `);

    console.log('[timescale] pgvector ivfflat index on raw_items.embedding');
    await client.query(`
      CREATE INDEX IF NOT EXISTS raw_items_embedding_ivfflat
      ON raw_items USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);

    console.log('[timescale] compression policy (raw_items, 7 days)');
    await client.query(`
      ALTER TABLE raw_items SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'source, subscription_id',
        timescaledb.compress_orderby = 'time DESC'
      );
    `);
    await client.query(
      `SELECT add_compression_policy('raw_items', INTERVAL '7 days', if_not_exists => TRUE);`,
    );

    console.log('[timescale] retention policies');
    await client.query(
      `SELECT add_retention_policy('collection_runs', INTERVAL '90 days', if_not_exists => TRUE);`,
    );
    await client.query(
      `SELECT add_retention_policy('raw_items', INTERVAL '365 days', if_not_exists => TRUE);`,
    );
    await client.query(
      `SELECT add_retention_policy('fetch_errors', INTERVAL '30 days', if_not_exists => TRUE);`,
    );

    console.log('[timescale] ✓ done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[timescale] failed:', err);
  process.exit(1);
});
