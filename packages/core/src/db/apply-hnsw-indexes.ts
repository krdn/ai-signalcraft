/**
 * HNSW 인덱스 적용 스크립트
 * 실행: pnpm tsx packages/core/src/db/apply-hnsw-indexes.ts
 *
 * 멱등: 이미 인덱스 존재 시 skip. CONCURRENTLY라 lock 없이 적용 가능.
 */
import { Pool } from 'pg';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL 환경변수가 필요합니다');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

    console.log('[hnsw] articles 인덱스 빌드 시작 (수십 초 ~ 수 분 소요 가능)');
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS articles_embedding_hnsw_cosine
        ON articles
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `);
    console.log('[hnsw] articles 인덱스 완료');

    console.log('[hnsw] comments 인덱스 빌드 시작');
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS comments_embedding_hnsw_cosine
        ON comments
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `);
    console.log('[hnsw] comments 인덱스 완료');

    // 인덱스 상태 출력
    const res = await pool.query(`
      SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
      FROM pg_indexes
      JOIN pg_class ON pg_class.relname = pg_indexes.indexname
      WHERE indexname LIKE '%embedding_hnsw%'
    `);
    console.log('\n[hnsw] 생성된 인덱스:');
    for (const row of res.rows) {
      console.log(`  ${row.indexname}: ${row.size}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[hnsw] 실패:', err);
  process.exit(1);
});
