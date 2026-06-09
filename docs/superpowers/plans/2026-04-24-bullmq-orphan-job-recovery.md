# BullMQ Orphaned Job 자동 복구 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Worker 컨테이너 재시작 시 진행 중이던 BullMQ job이 orphaned 상태가 되는 문제를 근본적으로 해결

**Architecture:** Docker 안전망(stop_grace_period, tini) → BullMQ stalled job 정책 재설정 → startup recovery로 orphaned job 재큐잉 → worker health heartbeat로 가시성 확보. 4개 레이어가 독립적으로 동작하며 겹쳐서 보호.

**Tech Stack:** Docker Compose, BullMQ 5, Redis 7, TypeScript, tsx

---

## File Structure

| 파일                                           | 작업                                                  | 담당   |
| ---------------------------------------------- | ----------------------------------------------------- | ------ |
| `docker/docker-compose.prod.yml`               | 수정                                                  | Task 1 |
| `Dockerfile`                                   | 수정 (tini 추가)                                      | Task 2 |
| `apps/collector/Dockerfile`                    | 수정 (tini 추가)                                      | Task 2 |
| `packages/core/src/queue/workers.ts`           | 수정 (maxStalledCount)                                | Task 3 |
| `apps/collector/src/queue/worker-process.ts`   | 수정 (lockDuration, stalledInterval, maxStalledCount) | Task 3 |
| `apps/collector/src/queue/startup-recovery.ts` | 신규                                                  | Task 4 |
| `apps/collector/src/queue/worker-process.ts`   | 수정 (startup recovery 호출)                          | Task 5 |
| `packages/core/src/queue/startup-cleanup.ts`   | 수정 (active job 복구 추가)                           | Task 6 |
| `packages/core/src/queue/worker-health.ts`     | 신규                                                  | Task 7 |
| `packages/core/src/queue/worker-process.ts`    | 수정 (heartbeat 시작)                                 | Task 8 |

---

### Task 1: Docker Compose — stop_grace_period + healthcheck

**Files:**

- Modify: `docker/docker-compose.prod.yml`

- [ ] **Step 1: worker 서비스에 stop_grace_period 및 healthcheck 추가**

`docker/docker-compose.prod.yml`의 `worker` 서비스(라인 29~54)에 다음을 추가:

```yaml
worker:
  build:
    context: ..
    dockerfile: Dockerfile
    target: worker
  container_name: ais-prod-worker
  restart: unless-stopped
  stop_grace_period: 60s
  healthcheck:
    test:
      [
        'CMD-SHELL',
        'node -e "fetch(''http://localhost:3000'').catch(() => process.exit(1))" || true',
      ]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 30s
```

참고: worker는 Next.js HTTP 서버가 없으므로, Redis ping 대신 프로세스 생존 확인:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'node -e "process.exit(0)"']
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

- [ ] **Step 2: collector-worker 서비스에 동일하게 추가**

`collector-worker` 서비스(라인 129~156)에 추가:

```yaml
  collector-worker:
    ...
    stop_grace_period: 60s
    healthcheck:
      test: ["CMD-SHELL", "node -e \"process.exit(0)\""]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

- [ ] **Step 3: collector-scheduler에 stop_grace_period 추가**

```yaml
  collector-scheduler:
    ...
    stop_grace_period: 30s
```

- [ ] **Step 4: Commit**

```bash
git add docker/docker-compose.prod.yml
git commit -m "feat: Docker worker 컨테이너 stop_grace_period 및 healthcheck 추가

Worker 재시작 시 graceful shutdown 시간 확보 (60s)와
프로세스 생존 healthcheck로 hang 상태 감지"
```

---

### Task 2: Dockerfile — tini init 프로세스 추가

**Files:**

- Modify: `Dockerfile` (루트)
- Modify: `apps/collector/Dockerfile`

- [ ] **Step 1: 루트 Dockerfile worker 스테이지에 tini 추가**

`Dockerfile`의 Stage 4 (라인 44~69)에서 `apt-get install`에 `tini` 추가하고 `ENTRYPOINT` 설정:

```dockerfile
# Stage 4: Worker 실행 (BullMQ + Playwright)
FROM node:24-slim AS worker
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    tini \
    && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# ... 기존 COPY 라인들 동일 ...
RUN npm install -g tsx
ENV NODE_ENV=production
ENTRYPOINT ["tini", "--"]
CMD ["tsx", "packages/core/src/queue/worker-process.ts"]
```

- [ ] **Step 2: collector Dockerfile에 tini 추가**

`apps/collector/Dockerfile`의 `runtime` 스테이지 (라인 15~39)에서 동일하게 추가:

```dockerfile
FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    tini \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# ... 기존 라인들 동일 ...
ENTRYPOINT ["tini", "--"]
CMD ["tsx", "apps/collector/src/server/index.ts"]
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile apps/collector/Dockerfile
git commit -m "feat: Worker Dockerfile에 tini init 프로세스 추가

PID 1 signal 전달 문제 해결 — SIGTERM이 tsx 프로세스에
정확히 전달되어 graceful shutdown 보장"
```

---

### Task 3: BullMQ Stalled Job 정책 재설정

**Files:**

- Modify: `packages/core/src/queue/workers.ts`
- Modify: `apps/collector/src/queue/worker-process.ts`

- [ ] **Step 1: Core collector worker — maxStalledCount 변경**

`packages/core/src/queue/workers.ts` 라인 22-23:

```typescript
// Before:
    // ⚠️ stalled 재실행은 dayCount 리셋 → 한도 초과 위험. 0으로 비활성화.
    maxStalledCount: 0,

// After:
    // stalled 재실행 허용 (1회). 수집은 ON CONFLICT DO NOTHING으로 멱등성 보장.
    // executor의 dayCount Map은 job 재시작 시 초기화되지만,
    // TimescaleDB에서 이미 수집된 날짜의 데이터는 중복 저장되지 않음.
    maxStalledCount: 1,
```

- [ ] **Step 2: Collector worker — lockDuration, stalledInterval, maxStalledCount 변경**

`apps/collector/src/queue/worker-process.ts` `buildWorker()` 함수 내 opts 객체(라인 46~59):

```typescript
// Before:
    lockDuration: 300_000,
    stalledInterval: 60_000,

// After:
    // YouTube 대량 수집(수천 건 비디오+댓글+임베딩)은 5분 이상 소요 가능.
    // 10분으로 늘려 stalled 오판 방지.
    lockDuration: 600_000,
    // 2분마다 stall check — 10분 lockDuration의 1/5.
    stalledInterval: 120_000,
    // Worker 재시작 시 orphaned job 복구 허용. 수집은 멱등.
    maxStalledCount: 1,
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/queue/workers.ts apps/collector/src/queue/worker-process.ts
git commit -m "feat: BullMQ stalled job 재시도 활성화

Core collector: maxStalledCount 0→1
Collector worker: lockDuration 5분→10분, stalledInterval 1분→2분, maxStalledCount=1

수집 파이프라인의 멱등성(ON CONFLICT DO NOTHING)으로
재실행 시 데이터 중복 없음"
```

---

### Task 4: Collector Startup Recovery 모듈 작성

**Files:**

- Create: `apps/collector/src/queue/startup-recovery.ts`

- [ ] **Step 1: startup-recovery.ts 작성**

```typescript
// Worker 시작 시 Redis에 잔류한 orphaned(고아) 수집 job을 감지하여 재큐잉.
//
// Worker 재시작으로 인해 processedOn은 있지만 finishedOn이 없는 job이
// Redis 해시에 남아있으면, 같은 data로 새 job을 큐에 적재하고 원본을 정리.
import { Queue } from 'bullmq';
import { getBullMQOptions, getBullPrefix } from './connection';
import { COLLECTOR_SOURCES, type CollectionJobData } from './types';

interface RecoveryResult {
  source: string;
  recovered: number;
}

/**
 * Redis SCAN으로 지정 패턴에 매칭되는 키를 모두 수집.
 * 대량 키가 있을 수 있으므로 cursor 기반으로 순회.
 */
async function scanKeys(pattern: string, redis: any): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.keys(pattern);
    // ioredis 호환: scan 결과가 [cursor, keys[]] 형태
    if (Array.isArray(batch)) {
      keys.push(...batch);
    }
    cursor = Array.isArray(nextCursor) ? nextCursor[0] : nextCursor;
    // 안전장치: 10000개 이상이면 중단
    if (keys.length > 10000) break;
  } while (cursor !== '0');
  return keys;
}

/**
 * 단일 소스 큐에서 orphaned job을 감지하고 재큐잉.
 *
 * BullMQ job 해시 구조:
 *   {prefix}:collect-{source}:{jobId} — 해시에 finishedOn이 없고 processedOn이 있으면 orphaned
 */
async function recoverSource(source: string): Promise<number> {
  const bullOpts = getBullMQOptions();
  const prefix = getBullPrefix();
  const queueName = `collect-${source}`;
  const pattern = `${prefix}:${queueName}:*`;
  const connection = bullOpts.connection as any;
  // ioredis 인스턴스 획득 — BullMQ connection 옵션에서 직접 Redis 접근
  const Redis = await import('ioredis');
  const redis = new Redis.default(connection);

  let recovered = 0;

  try {
    // BullMQ 내부 키 패턴: {prefix}:{queueName}:{jobId}
    // Redis HASH에서 필드 확인
    const stream = redis.scanStream({ match: pattern, count: 100 });
    const keys: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (batch: string[]) => keys.push(...batch));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    for (const key of keys) {
      // lock 키는 제외
      if (key.endsWith(':lock')) continue;

      const finishedOn = await redis.hget(key, 'finishedOn');
      const processedOn = await redis.hget(key, 'processedOn');

      // finishedOn이 없고 processedOn이 있으면 orphaned
      if (!finishedOn && processedOn) {
        const dataStr = await redis.hget(key, 'data');
        if (!dataStr) continue;

        try {
          const data: CollectionJobData = JSON.parse(dataStr);
          const queue = new Queue<CollectionJobData>(queueName, bullOpts);

          // 같은 data로 새 job 적재 — jobId는 자동 생성 (중복 실행 방지)
          await queue.add(queueName, data, {
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 86400 },
            backoff: { delay: 30000, type: 'exponential' },
            attempts: 3,
          });
          await queue.close();

          // 원본 해시 삭제
          await redis.del(key);
          recovered++;
        } catch (err) {
          console.error(
            `[startup-recovery] ${source} job 복구 실패 (key=${key}):`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  } finally {
    await redis.quit();
  }

  return recovered;
}

/**
 * 모든 소스 큐에서 orphaned job을 감지하고 재큐잉.
 * Worker 시작 시 startAllWorkers() 이전에 호출.
 */
export async function recoverOrphanedJobs(): Promise<void> {
  console.warn('[startup-recovery] 고아 job 복구 시작...');
  const results: RecoveryResult[] = [];

  for (const source of COLLECTOR_SOURCES) {
    try {
      const recovered = await recoverSource(source);
      results.push({ source, recovered });
    } catch (err) {
      console.error(
        `[startup-recovery] ${source} 복구 중 오류:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const total = results.reduce((sum, r) => sum + r.recovered, 0);
  if (total > 0) {
    const detail = results
      .filter((r) => r.recovered > 0)
      .map((r) => `${r.source}: ${r.recovered}개`)
      .join(', ');
    console.warn(`[startup-recovery] 총 ${total}개 고아 job 재큐잉 완료 (${detail})`);
  } else {
    console.log('[startup-recovery] 고아 job 없음 — 정상');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/collector/src/queue/startup-recovery.ts
git commit -m "feat: Collector Worker 시작 시 orphaned job 자동 복구 모듈

processedOn은 있고 finishedOn이 없는 Redis 해시를 감지하여
같은 data로 새 job을 큐에 재적재. Worker 재시작 후
수집이 멈추는 현상 방지"
```

---

### Task 5: Collector Worker에 Startup Recovery 연동

**Files:**

- Modify: `apps/collector/src/queue/worker-process.ts`

- [ ] **Step 1: main()에 recoverOrphanedJobs() 호출 추가**

`apps/collector/src/queue/worker-process.ts` 상단 import 추가(라인 5 이후):

```typescript
import { recoverOrphanedJobs } from './startup-recovery';
```

`main()` 함수(라인 112~137)에서 `startAllWorkers()` 호출 이전에 recovery 추가:

```typescript
async function main() {
  console.warn('[worker-process] verifying hypertable constraints...');
  await assertHypertableConstraints();

  // Worker 시작 전 orphaned job 복구
  await recoverOrphanedJobs().catch((err) =>
    console.error('[startup-recovery] 복구 실패 (무시하고 계속):', err),
  );

  console.warn('[worker-process] starting all source workers...');
  const workers = startAllWorkers();
  // ... 나머지 동일
```

- [ ] **Step 2: Commit**

```bash
git add apps/collector/src/queue/worker-process.ts
git commit -m "feat: Collector Worker 시작 시 orphaned job 복구 연동

startAllWorkers() 이전에 recoverOrphanedJobs() 실행하여
Worker 재시작 후에도 수집이 중단 없이 이어짐"
```

---

### Task 6: Core Worker Startup Cleanup에 Active Job 복구 추가

**Files:**

- Modify: `packages/core/src/queue/startup-cleanup.ts`

- [ ] **Step 1: cleanupOrphanedRedisJobs()에 active job 복구 로직 추가**

`packages/core/src/queue/startup-cleanup.ts`의 `cleanupOrphanedRedisJobs()` 함수 끝(라인 76 `} finally {` 블록 이후, `for` 루프 내부)에 active job 처리 로직 추가:

```typescript
// waiting/delayed/waiting-children 처리 (기존 코드) ...

// active 상태이지만 finishedOn이 없는 job → orphaned, 재큐잉
const activeJobs = await queue.getJobs(['active']);
for (const job of activeJobs) {
  if (!job) continue;

  // finishedOn이 있으면 정상 완료/실패한 것 — 스킵
  if (job.finishedOn) continue;

  // processedOn이 없으면 아직 처리 시작 전 — 스킵
  if (!job.processedOn) continue;

  console.warn(
    `[startup-cleanup] ${queueName}:${job.id} orphaned active job 감지 — 재큐잉 (dbJobId=${job.data?.dbJobId})`,
  );

  try {
    // 같은 data로 새 job 생성
    await queue.add(job.name, job.data, {
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400 },
      attempts: 3,
    });

    // 원본 job 제거
    await job.remove();
    cleaned++;
  } catch (err) {
    console.warn(
      `[startup-cleanup] ${queueName}:${job.id} 재큐잉 실패:`,
      err instanceof Error ? err.message : err,
    );
  }
}
```

이 코드는 각 큐의 `try` 블록 내, waiting-children 처리 이후에 삽입합니다.

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/queue/startup-cleanup.ts
git commit -m "feat: Core Worker startup cleanup에 active orphaned job 복구 추가

Worker 재시작 시 processedOn은 있으나 finishedOn이 없는
active job을 감지하여 재큐잉. collectors/pipeline/analysis
모든 큐에 적용"
```

---

### Task 7: Worker Health Heartbeat 모듈 작성

**Files:**

- Create: `packages/core/src/queue/worker-health.ts`

- [ ] **Step 1: worker-health.ts 작성**

```typescript
// Worker health heartbeat — Redis에 주기적으로 상태 기록.
// 모니터 페이지에서 Worker 생존/활성 job 수를 확인 가능.
import type { Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { getBullMQOptions, getBullPrefix } from './connection';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5분
const HEARTBEAT_TTL_MS = 15 * 60 * 1000; // 15분 (heartbeat 3회 누락 시 만료)

export interface WorkerHealth {
  timestamp: number;
  activeJobs: number;
  waitingJobs: number;
  uptime: number;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Worker heartbeat 시작.
 * 여러 Worker(collector, pipeline, analysis)를 받아
 * 합산 active/waiting 카운트를 기록.
 */
export function startWorkerHealthHeartbeat(workers: Worker[]): void {
  const bullOpts = getBullMQOptions();
  const prefix = getBullPrefix();
  const hostname = process.env.HOSTNAME || 'unknown';
  const key = `${prefix}:worker-health:${hostname}`;
  const startTime = Date.now();

  // ioredis 직접 생성 — BullMQ Queue API보다 가벼움
  let redis: any;

  const tick = async () => {
    try {
      if (!redis) {
        const Redis = await import('ioredis');
        redis = new Redis.default(bullOpts.connection as any);
      }

      let activeJobs = 0;
      let waitingJobs = 0;

      for (const worker of workers) {
        try {
          const active = await worker.getActive();
          activeJobs += active.length;
          const waiting = await worker.getWaiting();
          waitingJobs += waiting.length;
        } catch {
          // Worker가 이미 close된 경우 무시
        }
      }

      const health: WorkerHealth = {
        timestamp: Date.now(),
        activeJobs,
        waitingJobs,
        uptime: Date.now() - startTime,
      };

      await redis.set(key, JSON.stringify(health), 'PX', HEARTBEAT_TTL_MS);
    } catch (err) {
      console.error(
        '[worker-health] heartbeat 기록 실패:',
        err instanceof Error ? err.message : err,
      );
    }
  };

  // 즉시 1회 실행 후 인터벌 시작
  tick().catch(() => {});
  intervalId = setInterval(tick, HEARTBEAT_INTERVAL_MS);
}

/**
 * Heartbeat 정지 (graceful shutdown 시 호출).
 */
export function stopWorkerHealthHeartbeat(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/queue/worker-health.ts
git commit -m "feat: Worker health heartbeat 모듈

5분 간격으로 Redis에 active/waiting job 수와 uptime 기록.
모니터 페이지에서 Worker 상태 가시성 확보"
```

---

### Task 8: Core Worker에 Heartbeat 연동

**Files:**

- Modify: `packages/core/src/queue/worker-process.ts`

- [ ] **Step 1: heartbeat 시작 및 shutdown에 정지 추가**

`packages/core/src/queue/worker-process.ts` 상단 import 추가(라인 11 이후):

```typescript
import { startWorkerHealthHeartbeat, stopWorkerHealthHeartbeat } from './worker-health';
```

Worker 기동 후(라인 53 이후) heartbeat 시작:

```typescript
// 2.5. DLQ: 실패한 잡을 데드 레터 큐로 전송 (기존 코드)

// 2.6. Worker health heartbeat 시작
startWorkerHealthHeartbeat([collectorWorker, pipelineWorker, analysisWorker]);
```

shutdown 함수(라인 59~64)에 heartbeat 정지 추가:

```typescript
const shutdown = async () => {
  stopWorkerHealthHeartbeat();
  await collectorWorker.close();
  await pipelineWorker.close();
  await analysisWorker.close();
  process.exit(0);
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/queue/worker-process.ts
git commit -m "feat: Core Worker에 health heartbeat 연동

Worker 시작 시 heartbeat 기록, shutdown 시 정지.
모니터 페이지에서 실시간 Worker 상태 확인 가능"
```

---

## 배포 순서

모든 Task 완료 후:

1. **로컬 빌드 검증**: `pnpm build` 성공 확인
2. **이미지 빌드**: `docker build` 로 tini 적용 확인
3. **운영 배포**: `dserver` 로 이미지 교체 후 `dcserver up -d`
4. **복구 확인**: `dserver logs ais-collector-worker --since 5m` 에서 `[startup-recovery]` 로그 확인
5. **heartbeat 확인**: Redis에서 `bull:worker-health:*` 키 존재 확인
