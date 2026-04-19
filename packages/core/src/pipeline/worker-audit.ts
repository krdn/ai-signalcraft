import Redis from 'ioredis';
import { getRedisConnection } from '../queue/connection';

const AUDIT_KEY = 'ais:worker-audit-log';
const MAX_ENTRIES = 100;

export interface AuditEntry {
  timestamp: string;
  action: string;
  target: string;
  result: string;
  count?: number;
}

let _auditRedis: Redis | null = null;

function getAuditRedis(): Redis {
  if (!_auditRedis) {
    const connOpts = getRedisConnection();
    _auditRedis = new Redis({
      host: (connOpts as any).host ?? 'localhost',
      port: (connOpts as any).port ?? 6379,
      ...((connOpts as any).password ? { password: (connOpts as any).password } : {}),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return _auditRedis;
}

export async function writeAuditLog(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  try {
    const redis = getAuditRedis();
    const record: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    await redis.lpush(AUDIT_KEY, JSON.stringify(record));
    await redis.ltrim(AUDIT_KEY, 0, MAX_ENTRIES - 1);
  } catch {
    // 감사 로그 실패가 메인 작업을 방해하면 안 됨
  }
}

export async function getAuditLogs(limit: number = 50): Promise<AuditEntry[]> {
  try {
    const redis = getAuditRedis();
    const raw = await redis.lrange(AUDIT_KEY, 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as AuditEntry);
  } catch {
    return [];
  }
}
