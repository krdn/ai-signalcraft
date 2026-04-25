import pg from 'pg';

/**
 * Collector DB(ais_collection / timescaledb 5435)용 pg.Pool.
 *
 * @ai-signalcraft/core의 drizzle 핸들은 legacy DATABASE_URL(ai_signalcraft)에 묶여 있으므로
 * 신규 raw_items 갱신은 별도 풀을 사용한다. 쿼리는 SELECT 1건 + UPDATE 1건뿐이라
 * drizzle 없이 raw pg로 충분하다.
 *
 * 환경변수 COLLECTOR_DATABASE_URL이 설정되어 있어야 한다 (Docker compose env).
 */
let _pool: pg.Pool | null = null;

export function getCollectorDb(): pg.Pool {
  if (_pool) return _pool;
  const url = process.env.COLLECTOR_DATABASE_URL;
  if (!url) {
    throw new Error('COLLECTOR_DATABASE_URL is not set — required for raw_items transcript writes');
  }
  _pool = new pg.Pool({
    connectionString: url,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  _pool.on('error', (err) => {
    console.error('[whisper-worker:collector-db] pool error:', err.message);
  });
  return _pool;
}

export async function closeCollectorDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
