/**
 * 파이프라인 성능 메트릭 수집기
 *
 * - Redis에 sorted set으로 최근 N개의 단계별 소요 시간 기록
 * - p50/p95/p99 퍼센타일 계산 가능
 * - OpenTelemetry 없이도 Stage별 레이턴시/성공률 트래킹
 *
 * 키 구조:
 *   metrics:duration:<stage>  — sorted set (score=timestamp, member=duration_ms)
 *   metrics:count:<stage>:<status>  — counter (completed/failed)
 *   metrics:cost:<provider>:<model>  — 토큰 사용량 누적
 */
import { getCacheRedis, getCachePrefix } from '../cache/redis-cache';

const RETENTION_SAMPLES = 1000; // 각 stage당 최근 1000개 샘플 유지
const METRICS_TTL_SEC = 7 * 24 * 60 * 60; // 7일

function key(...parts: string[]): string {
  return [getCachePrefix(), 'metrics', ...parts].filter(Boolean).join(':');
}

/**
 * Stage 소요 시간 기록. 성공/실패 카운터도 함께 증가.
 */
export async function recordStageDuration(
  stage: string,
  durationMs: number,
  status: 'completed' | 'failed' = 'completed',
): Promise<void> {
  try {
    const redis = getCacheRedis();
    const durationKey = key('duration', stage);
    const countKey = key('count', stage, status);
    const now = Date.now();

    // sorted set에 추가 (score=timestamp, member='ts:duration' for 유니크성)
    await (redis as any).zadd(durationKey, now, `${now}:${durationMs}`);
    // retention 초과분 삭제 (상위 N개만 유지)
    await (redis as any).zremrangebyrank(durationKey, 0, -RETENTION_SAMPLES - 1);
    await (redis as any).expire(durationKey, METRICS_TTL_SEC);

    // 성공/실패 카운터
    await (redis as any).incr(countKey);
    await (redis as any).expire(countKey, METRICS_TTL_SEC);
  } catch {
    // metrics 실패는 파이프라인을 방해하지 않음
  }
}

/**
 * LLM 토큰 사용량 기록
 */
export async function recordTokenUsage(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  try {
    const redis = getCacheRedis();
    const inputKey = key('tokens', provider, model, 'input');
    const outputKey = key('tokens', provider, model, 'output');

    await (redis as any).incrby(inputKey, Math.max(0, Math.floor(inputTokens)));
    await (redis as any).incrby(outputKey, Math.max(0, Math.floor(outputTokens)));
    await (redis as any).expire(inputKey, METRICS_TTL_SEC);
    await (redis as any).expire(outputKey, METRICS_TTL_SEC);
  } catch {
    // ignore
  }
}

/**
 * Stage 퍼센타일 조회 (p50, p95, p99)
 */
export async function getStagePercentiles(
  stage: string,
): Promise<{ p50: number; p95: number; p99: number; count: number } | null> {
  try {
    const redis = getCacheRedis();
    const durationKey = key('duration', stage);
    const members = (await (redis as any).zrange(durationKey, 0, -1)) as string[];

    if (!members || members.length === 0) return null;

    const durations = members
      .map((m) => {
        const parts = m.split(':');
        return Number(parts[1]);
      })
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    if (durations.length === 0) return null;

    const percentile = (p: number): number => {
      const idx = Math.min(durations.length - 1, Math.floor((durations.length - 1) * p));
      return durations[idx];
    };

    return {
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      count: durations.length,
    };
  } catch {
    return null;
  }
}

/**
 * 특정 stage의 성공/실패 카운트 조회
 */
export async function getStageCounts(
  stage: string,
): Promise<{ completed: number; failed: number }> {
  try {
    const redis = getCacheRedis();
    const completed = Number((await (redis as any).get(key('count', stage, 'completed'))) ?? 0);
    const failed = Number((await (redis as any).get(key('count', stage, 'failed'))) ?? 0);
    return { completed, failed };
  } catch {
    return { completed: 0, failed: 0 };
  }
}

/**
 * Prometheus 포맷으로 모든 메트릭 export
 * `/api/metrics` 엔드포인트에서 응답으로 반환
 */
export async function exportPrometheusMetrics(stages: string[]): Promise<string> {
  const lines: string[] = [];

  lines.push('# HELP ais_stage_duration_ms Stage execution duration in milliseconds');
  lines.push('# TYPE ais_stage_duration_ms summary');

  for (const stage of stages) {
    const p = await getStagePercentiles(stage);
    if (!p) continue;
    lines.push(`ais_stage_duration_ms{stage="${stage}",quantile="0.5"} ${p.p50}`);
    lines.push(`ais_stage_duration_ms{stage="${stage}",quantile="0.95"} ${p.p95}`);
    lines.push(`ais_stage_duration_ms{stage="${stage}",quantile="0.99"} ${p.p99}`);
    lines.push(`ais_stage_duration_ms_count{stage="${stage}"} ${p.count}`);
  }

  lines.push('# HELP ais_stage_total Number of stage executions by status');
  lines.push('# TYPE ais_stage_total counter');
  for (const stage of stages) {
    const counts = await getStageCounts(stage);
    lines.push(`ais_stage_total{stage="${stage}",status="completed"} ${counts.completed}`);
    lines.push(`ais_stage_total{stage="${stage}",status="failed"} ${counts.failed}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * 측정 헬퍼: 함수 실행을 감싸서 자동 기록
 */
export async function measureStage<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await recordStageDuration(stage, Date.now() - start, 'completed');
    return result;
  } catch (error) {
    await recordStageDuration(stage, Date.now() - start, 'failed');
    throw error;
  }
}
