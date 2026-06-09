# BullMQ Orphaned Job 자동 복구 설계

**날짜**: 2026-04-24
**상태**: 승인됨
**문제**: Worker 컨테이너 재시작 시 진행 중이던 BullMQ job이 orphaned 상태가 되어 수집이 멈추는 현상이 주기적으로 발생

## 근본 원인 분석

1. **Docker graceful shutdown 불충분**: `stop_grace_period` 미설정 → Docker 기본 10초 후 SIGKILL → Worker가 정리할 시간 없음
2. **PID 1 signal 전달 문제**: `tsx`가 PID 1로 직접 실행, init 프로세스(tini) 없음 → signal 전달 불안정
3. **Stalled job 재실행 비활성화**: Core collector worker `maxStalledCount: 0` → stall 감지해도 재실행 안 함
4. **Startup recovery 미흡**: Core는 `startup-cleanup.ts`가 있으나 Collector 시스템(`collector:*`)은 복구 로직 없음

## 해결 방안: BullMQ 네이티브 복구 강화 (방안 A)

BullMQ 자체 기능을 최대한 활용. 수집 파이프라인이 이미 멱등성을 보장하므로 재실행이 안전함.

---

### 레이어 1: Docker 안전망

**docker-compose.prod.yml** 변경:

```yaml
worker:
  stop_grace_period: 60s
  healthcheck:
    test: ['CMD-SHELL', 'redis-cli -h redis -p 6379 ping | grep PONG']
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 30s

collector-worker:
  stop_grace_period: 60s
  healthcheck:
    test: ['CMD-SHELL', 'redis-cli -h redis -p 6379 ping | grep PONG']
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 30s

collector-scheduler:
  stop_grace_period: 30s
```

**Dockerfile** 변경:

두 Dockerfile 모두 `tini` init 프로세스 추가:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends tini ...
ENTRYPOINT ["tini", "--"]
CMD ["tsx", "..."]
```

---

### 레이어 2: Stalled Job 정책 재설정

**Core collector worker** (`packages/core/src/queue/workers.ts`):

| 파라미터          | Before | After |
| ----------------- | ------ | ----- |
| `maxStalledCount` | 0      | 1     |

근거: dayCount cap 우회 위험은 executor 레벨에서 이미 처리. 수집은 TimescaleDB `ON CONFLICT`로 멱등성 보장.

**Collector worker** (`apps/collector/src/queue/worker-process.ts`):

| 파라미터          | Before          | After          |
| ----------------- | --------------- | -------------- |
| `lockDuration`    | 300,000 (5분)   | 600,000 (10분) |
| `stalledInterval` | 60,000 (1분)    | 120,000 (2분)  |
| `maxStalledCount` | 미설정 (기본 1) | 1 (명시적)     |

YouTube 대량 수집(수천 건 비디오+댓글+임베딩)은 5분 이상 소요될 수 있으므로 lockDuration 증가.

---

### 레이어 3: Startup Recovery

#### Collector Worker — 신규 파일

**`apps/collector/src/queue/startup-recovery.ts`**:

```
1. Redis SCAN으로 collector:collect-* 패턴 매칭
2. 각 해시에서 finishedOn 부재 + processedOn 존재 → orphaned 판정
3. data 필드를 읽어 동일 data로 새 job을 해당 큐에 Queue.add()
4. 원본 해시는 DEL로 정리
5. 로그: "[startup-recovery] collect-youtube: N개 고아 job 재큐잉"
```

실행 시퀀스:

```
main()
  → assertHypertableConstraints()
  → recoverOrphanedJobs()     // 신규
  → startAllWorkers()
  → shutdown 핸들러 등록
```

#### Core Worker — 기존 파일 확장

**`packages/core/src/queue/startup-cleanup.ts`** 확장:

기존 로직(waiting/delayed에서 cancelled/failed job 제거)은 유지. 추가:

```
1. 각 큐(collectors, pipeline, analysis)에서 active 상태 job 조회
2. finishedOn이 없는 job → 재큐잉 (같은 data로 새 job)
3. 원본 job은 제거
```

Analysis job은 이미 실행된 모듈 결과가 DB에 저장되어 있어 재실행 시 건너뛰는 로직이 존재하므로 안전.

---

### 레이어 4: 모니터링/알림

**Worker health heartbeat** (`packages/core/src/queue/worker-health.ts` — 신규):

- 5분 간격으로 Redis에 heartbeat 기록
- 키: `{prefix}:worker-health:{hostname}`
- 값: `{ timestamp, activeJobs, waitingJobs, uptime }`
- TTL: 15분 (heartbeat 3회 누락 시 만료)
- 모니터 페이지(`/subscriptions/monitor`)에 Worker health 섹션 추가

**Recovery 로그 알림**:

- orphaned job 재큐잉 시 `[startup-recovery]` 접두어로 로그 출력
- 재큐잉 수 > 0이면 `console.warn` 레벨

**범위 제한**: heartbeat 기록 + 모니터 페이지 표시까지만. 자동 장애 복구(restart)는 향후 필요시 추가.

---

## 변경 파일 요약

| 파일                                           | 변경 유형                            | 레이어 |
| ---------------------------------------------- | ------------------------------------ | ------ |
| `docker/docker-compose.prod.yml`               | 수정                                 | 1      |
| `Dockerfile`                                   | 수정 (tini 추가)                     | 1      |
| `apps/collector/Dockerfile`                    | 수정 (tini 추가)                     | 1      |
| `packages/core/src/queue/workers.ts`           | 수정 (maxStalledCount)               | 2      |
| `apps/collector/src/queue/worker-process.ts`   | 수정 (lockDuration, maxStalledCount) | 2      |
| `apps/collector/src/queue/startup-recovery.ts` | 신규                                 | 3      |
| `packages/core/src/queue/startup-cleanup.ts`   | 수정 (active job 복구 추가)          | 3      |
| `packages/core/src/queue/worker-health.ts`     | 신규                                 | 4      |

## 멱등성 보장 근거

- **수집**: TimescaleDB `ON CONFLICT DO NOTHING` → 재실행해도 중복 없음
- **정규화/저장**: 같은 raw_items ID로 upsert → 멱등
- **분석**: 이미 완료된 모듈은 결과가 DB에 있으므로 재실행 시 스킵
