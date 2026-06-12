import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

// lazy 초기화 -- Worker 프로세스에서 dotenv 로드 전 ESM import 호이스팅 대응
// getDb()로 호출 시점에 process.env를 읽어 DB 연결 생성
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

// idle client 소켓 에러(connect ETIMEDOUT 등)는 리스너가 없으면 unhandled
// 'error' 이벤트로 승격되어 프로세스가 즉사한다 (이슈 #154 동일 결함).
// 풀이 해당 클라이언트를 폐기하고 다음 acquire에서 재연결하므로 로그만 남긴다.
function attachPoolErrorLogger(pool: pg.Pool, label: string): pg.Pool {
  pool.on('error', (err) => {
    console.error(`[db:${label}] pg pool idle client error (풀이 재연결 처리):`, err.message);
  });
  return pool;
}

function getPool() {
  if (!_pool) {
    _pool = attachPoolErrorLogger(
      new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }),
      'lazy',
    );
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

// Next.js 환경 전용 — process.env가 이미 주입되어 있으므로 즉시 초기화 안전
// DrizzleAdapter 등 instanceof 검사가 필요한 곳에서 사용
// 주의: Worker 프로세스에서는 이 export 대신 getDb()를 사용할 것
export const db = drizzle(
  attachPoolErrorLogger(
    new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    }),
    'eager',
  ),
  { schema },
);
export type Database = typeof db;
