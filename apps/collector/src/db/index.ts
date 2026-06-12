import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getPool() {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      // 워커는 @xenova/transformers 임베딩 + BERT 감정분석을 같은 이벤트 루프에서 동기
      // CPU 추론으로 돌린다. 추론 중에는 acquire 콜백이 이벤트 루프로 못 돌아와
      // 5초 acquire 타임아웃이면 풀 여유가 있어도 "Connection terminated due to
      // connection timeout"이 만성적으로 발생한다. 추론 블록 길이를 흡수하도록 30초로 완화.
      connectionTimeoutMillis: 30000,
    });
    // idle client 소켓 에러(connect ETIMEDOUT 등)는 리스너가 없으면 unhandled
    // 'error' 이벤트로 승격되어 프로세스가 즉사한다 (이슈 #154 유형 A).
    // 풀이 해당 클라이언트를 폐기하고 다음 acquire에서 재연결하므로 로그만 남긴다.
    _pool.on('error', (err) => {
      console.error('[db] pg pool idle client error (풀이 재연결 처리):', err.message);
    });
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export type Database = ReturnType<typeof getDb>;
export { schema };
