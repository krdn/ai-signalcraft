import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

// lazy 초기화 -- Worker 프로세스에서 dotenv 로드 전 ESM import 호이스팅 대응
// getDb()로 호출 시점에 process.env를 읽어 DB 연결 생성
let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getPool() {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
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

// Next.js 환경에서는 process.env가 이미 주입되어 있으므로 즉시 초기화 안전
// DrizzleAdapter 등 instanceof 검사가 필요한 곳에서 사용
export const db = drizzle(
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  { schema },
);
export type Database = typeof db;
